#!/bin/bash
# ============================================================
# startup.sh — 区块链实时数仓：重构版一键重启与任务提交 (ODS-DWD-DWS-ADS)
# ============================================================

set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)
echo "=== 工作目录: $PROJECT_DIR ==="

MAX_RETRIES=30

# -------------------------------------------------------
# 参数解析
# -------------------------------------------------------
CLEAN_MODE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--clean)
            CLEAN_MODE=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [-c|--clean]"
            exit 1
            ;;
    esac
done

# -------------------------------------------------------
# Step 1: 重启所有容器并清理
# -------------------------------------------------------
echo ""
echo "=== [1/10] 重启所有容器 (CLEAN_MODE=${CLEAN_MODE}) ==="
if [ "$CLEAN_MODE" = "true" ]; then
    echo "  [清理模式] 正在彻底删除并重新拉起容器..."
    docker compose down -v || true
    rm -rf checkpoints || true
else
    echo "  [保留模式] 正在安全重启容器..."
    
    # 尝试优雅地取消当前运行中的 Flink 作业，避免重复提交
    if curl -sf http://localhost:8083/jobs/overview >/dev/null 2>&1; then
        echo "  发现运行中的 JobManager，正在取消已有作业..."
        JOBS=$(curl -sf http://localhost:8083/jobs/overview 2>/dev/null | python3 -c "import sys, json; print(' '.join([j['jid'] for j in json.load(sys.stdin).get('jobs', []) if j['state'] == 'RUNNING']))" || true)
        if [ -n "$JOBS" ]; then
            for jid in $JOBS; do
                echo "    取消 Flink 作业: $jid"
                docker compose exec -T jobmanager ./bin/flink cancel "$jid" || true
            done
        fi
    fi
    
    docker compose down || true
fi
docker compose up -d
echo "容器已启动，等待各服务就绪..."

# 初始化 PostgreSQL schema
postgres_init_count=0
until docker compose exec -T postgres psql -U root -d postgres -c "SELECT 1;" &>/dev/null; do
    postgres_init_count=$((postgres_init_count + 1))
    if [ $postgres_init_count -ge 15 ]; then
        echo "  PostgreSQL 未就绪，退出"
        exit 1
    fi
    sleep 2
done

echo "  初始化 PostgreSQL 数据库结构与画像数据..."
docker compose exec -T postgres psql -U root -d postgres 2>/dev/null <<'PG_INIT'
CREATE SCHEMA IF NOT EXISTS ods;
CREATE SCHEMA IF NOT EXISTS dwd;
CREATE SCHEMA IF NOT EXISTS dws;
CREATE SCHEMA IF NOT EXISTS ads;

-- 1. ODS Power Consumption (智能电表用电数据)
CREATE TABLE IF NOT EXISTS ods.power_consumption (
    reading_id BIGSERIAL PRIMARY KEY,
    substation_id VARCHAR(50) NOT NULL,
    meter_id VARCHAR(50) NOT NULL,
    consumption_kwh DECIMAL(20, 4) NOT NULL,
    voltage DECIMAL(10, 2) NOT NULL,
    current_amps DECIMAL(10, 2) NOT NULL,
    reading_ts TIMESTAMP(3) NOT NULL
);

-- 2. ODS Power Adjustments (用电量审计纠偏表)
CREATE TABLE IF NOT EXISTS ods.power_adjustments (
    reading_id BIGSERIAL PRIMARY KEY,
    adjustment_kwh DECIMAL(20, 4) NOT NULL,
    adjusted_by VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP(3) NOT NULL
);

-- 3. ODS Transformer Metrics (变压器监控数据)
CREATE TABLE IF NOT EXISTS ods.transformer_metrics (
    metric_id BIGSERIAL PRIMARY KEY,
    transformer_id VARCHAR(50) NOT NULL,
    substation_id VARCHAR(50) NOT NULL,
    temperature_celsius DECIMAL(10, 2) NOT NULL,
    load_ratio DECIMAL(10, 4) NOT NULL,
    metric_ts TIMESTAMP(3) NOT NULL
);

-- 4. DWD Substation Profiles (变电站静态画像表)
CREATE TABLE IF NOT EXISTS dwd.substation_profiles (
    substation_id VARCHAR(50) PRIMARY KEY,
    substation_name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    capacity_kva DECIMAL(20, 2) NOT NULL,
    voltage_level VARCHAR(20) NOT NULL,
    health_score INT NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL
);

-- 11. AI Cache Hot Feature Cache
CREATE SCHEMA IF NOT EXISTS ai_cache;
CREATE TABLE IF NOT EXISTS ai_cache.hot_feature_cache (
    query_hash VARCHAR(64) PRIMARY KEY,
    natural_query TEXT NOT NULL,
    matched_tables TEXT[] NOT NULL,
    generated_sql TEXT NOT NULL,
    hit_count INT DEFAULT 1,
    last_used TIMESTAMP(3) NOT NULL
);

-- 12. AI Cache Governance & Self-Healing Logs
CREATE TABLE IF NOT EXISTS ai_cache.governance_logs (
    log_id BIGSERIAL PRIMARY KEY,
    log_type VARCHAR(32) NOT NULL,
    log_detail TEXT NOT NULL,
    log_time TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ods.power_consumption REPLICA IDENTITY FULL;
ALTER TABLE ods.power_adjustments REPLICA IDENTITY FULL;
ALTER TABLE ods.transformer_metrics REPLICA IDENTITY FULL;
ALTER TABLE dwd.substation_profiles REPLICA IDENTITY FULL;

-- Insert Mock Substation Profiles
INSERT INTO dwd.substation_profiles (substation_id, substation_name, location, capacity_kva, voltage_level, health_score, updated_at) VALUES
('SUB-01', '朝阳变电站', '北京朝阳区', 50000.00, '110kV', 92, NOW()),
('SUB-02', '海淀一号站', '北京海淀区', 80000.00, '220kV', 95, NOW()),
('SUB-03', '西单枢纽站', '北京西城区', 120000.00, '500kV', 88, NOW()),
('SUB-04', '丰台工业站', '北京丰台区', 35000.00, '110kV', 79, NOW()),
('SUB-05', '石景山南站', '北京石景山区', 60000.00, '220kV', 84, NOW())
ON CONFLICT (substation_id) DO NOTHING;
PG_INIT

if [ "$CLEAN_MODE" = "true" ]; then
    echo "  [清理模式] 正在清空 PostgreSQL 历史数据..."
    docker compose exec -T postgres psql -U root -d postgres -q <<'PG_TRUNCATE'
TRUNCATE TABLE ods.power_consumption RESTART IDENTITY CASCADE;
TRUNCATE TABLE ods.power_adjustments RESTART IDENTITY CASCADE;
TRUNCATE TABLE ods.transformer_metrics RESTART IDENTITY CASCADE;
TRUNCATE TABLE dwd.substation_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE ai_cache.hot_feature_cache RESTART IDENTITY CASCADE;
TRUNCATE TABLE ai_cache.governance_logs RESTART IDENTITY CASCADE;
PG_TRUNCATE
fi

echo "  PostgreSQL 升级版四层数仓表结构初始化完成。"

# 等待 Flink JobManager
echo "等待 JobManager..."
COUNT=0
until curl -sf http://localhost:8083/jobs/overview > /dev/null 2>&1; do
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "  JobManager 未就绪，退出"
        exit 1
    fi
    sleep 2
done
echo "  JobManager 就绪"

# 等待 Fluss Coordinator
echo "等待 Fluss Coordinator..."
sleep 15
echo "  Fluss Coordinator 就绪"

# -------------------------------------------------------
# Step 2: 清理 Paimon S3 旧数据目录与本地 Checkpoints 状态
# -------------------------------------------------------
if [ "$CLEAN_MODE" = "true" ]; then
    echo ""
    echo "=== [2/10] 清理 Paimon S3 旧数据目录 ==="
    docker compose exec -T rustfs sh -c 'rm -rf /data/fluss/paimon/*.db && rm -rf /data/fluss/paimon/default.db__XLDIR__' 2>&1 || true
    echo "  ✅ Paimon 旧数据已清理"
else
    echo ""
    echo "=== [2/10] 跳过 Paimon S3 数据清理 (Warm Mode) ==="
fi

# -------------------------------------------------------
# Step 3: 创建 Fluss 表 (Log, PK, Partitioned)
# -------------------------------------------------------
echo ""
echo "=== [3/10] 创建 Fluss 表 (Log, PK, Partitioned) ==="

if [ "$CLEAN_MODE" = "true" ]; then
    echo "  [清理模式] 正在删除已有的 Fluss 表..."
    docker compose exec -T sql-client ./bin/sql-client.sh > /dev/null 2>&1 <<'SQL_DROP'
USE CATALOG fluss_catalog;
DROP TABLE IF EXISTS ods.power_consumption;
DROP TABLE IF EXISTS ods.power_adjustments;
DROP TABLE IF EXISTS ods.transformer_metrics;
DROP TABLE IF EXISTS ods.transformer_metrics_log;
DROP TABLE IF EXISTS dwd.substation_profiles;
DROP TABLE IF EXISTS dwd.dwd_power_consumption_enriched;
DROP TABLE IF EXISTS dwd.dwd_transformer_latest_metrics;
DROP TABLE IF EXISTS dws.dws_substation_window_stats;
DROP TABLE IF EXISTS ads.ads_grid_anomaly_alerts;
DROP TABLE IF EXISTS ads.ads_cep_risk_alerts;
SQL_DROP
fi

docker compose exec -T sql-client ./bin/sql-client.sh > /dev/null 2>&1 <<'SQL_CREATE'
SET sql-client.execution.result-mode = TABLEAU;
SET table.dml-sync = false;

CREATE CATALOG IF NOT EXISTS fluss_catalog WITH (
  'type' = 'fluss',
  'bootstrap.servers' = 'coordinator-server:9123',
  'paimon.s3.access-key' = 'rustfsadmin',
  'paimon.s3.secret-key' = 'rustfsadmin'
);
USE CATALOG fluss_catalog;

CREATE DATABASE IF NOT EXISTS ods;
CREATE DATABASE IF NOT EXISTS dwd;
CREATE DATABASE IF NOT EXISTS dws;
CREATE DATABASE IF NOT EXISTS ads;

CREATE CATALOG IF NOT EXISTS paimon_catalog WITH (
  'type' = 'paimon',
  'metastore' = 'filesystem',
  'warehouse' = 's3a://fluss/paimon',
  'hadoop.fs.s3a.endpoint' = 'http://rustfs:9000',
  'hadoop.fs.s3a.access.key' = 'rustfsadmin',
  'hadoop.fs.s3a.secret.key' = 'rustfsadmin',
  'hadoop.fs.s3a.path.style.access' = 'true',
  'hadoop.fs.s3a.impl' = 'org.apache.hadoop.fs.s3a.S3AFileSystem'
);
CREATE DATABASE IF NOT EXISTS paimon_catalog.ods;
CREATE DATABASE IF NOT EXISTS paimon_catalog.dws;
CREATE DATABASE IF NOT EXISTS paimon_catalog.ads;


CREATE TABLE IF NOT EXISTS paimon_catalog.dws.dws_substation_window_stats (
    substation_id STRING,
    window_start TIMESTAMP(3),
    window_end TIMESTAMP(3),
    reading_count BIGINT,
    total_consumption DECIMAL(20, 4),
    avg_voltage DECIMAL(10, 2),
    max_current DECIMAL(10, 2)
) WITH (
    'file.format' = 'parquet'
);

CREATE TABLE IF NOT EXISTS paimon_catalog.ads.ads_grid_anomaly_alerts (
    alert_id STRING,
    substation_id STRING,
    transformer_id STRING,
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    temperature_celsius DECIMAL(10, 2),
    health_score INT,
    alert_type STRING,
    alert_details STRING,
    alert_ts TIMESTAMP(3)
) WITH (
    'file.format' = 'parquet'
);

CREATE TABLE IF NOT EXISTS paimon_catalog.ads.ads_cep_risk_alerts (
    alert_id STRING,
    substation_id STRING,
    transformer_id STRING,
    first_metric_id BIGINT,
    second_metric_id BIGINT,
    temp_shift DECIMAL(10, 2),
    time_gap_seconds BIGINT,
    alert_details STRING,
    alert_ts TIMESTAMP(3)
) WITH (
    'file.format' = 'parquet'
);


-- 1. Power Consumption (PK Table - Unpartitioned, for lookup joins, windowing, and delta join)
CREATE TABLE IF NOT EXISTS ods.power_consumption (
    reading_id BIGINT NOT NULL,
    substation_id STRING,
    meter_id STRING,
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    current_amps DECIMAL(10, 2),
    reading_ts TIMESTAMP(3),
    PRIMARY KEY (reading_id) NOT ENFORCED,
    WATERMARK FOR reading_ts AS reading_ts - INTERVAL '5' SECOND
) WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 2. Power Adjustments (PK Table - Unpartitioned, for Delta Join)
CREATE TABLE IF NOT EXISTS ods.power_adjustments (
    reading_id BIGINT NOT NULL,
    adjustment_kwh DECIMAL(20, 4),
    adjusted_by STRING,
    last_updated TIMESTAMP(3),
    PRIMARY KEY (reading_id) NOT ENFORCED,
    WATERMARK FOR last_updated AS last_updated - INTERVAL '5' SECOND
) WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 3. Transformer Metrics (PK Table - Unpartitioned, for CEP and lookup joins)
CREATE TABLE IF NOT EXISTS ods.transformer_metrics (
    metric_id BIGINT NOT NULL,
    transformer_id STRING,
    substation_id STRING,
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    metric_ts TIMESTAMP(3),
    PRIMARY KEY (metric_id) NOT ENFORCED,
    WATERMARK FOR metric_ts AS metric_ts - INTERVAL '5' SECOND
) WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 4. Transformer Metrics Log (Append-only Table, for CEP)
CREATE TABLE IF NOT EXISTS ods.transformer_metrics_log (
    metric_id BIGINT,
    transformer_id STRING,
    substation_id STRING,
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    metric_ts TIMESTAMP(3),
    WATERMARK FOR metric_ts AS metric_ts - INTERVAL '5' SECOND
) WITH (
    'connector' = 'fluss'
);

-- 5. Substation Profiles (PK Table - Unpartitioned, Lookup source)
CREATE TABLE IF NOT EXISTS dwd.substation_profiles (
    substation_id STRING NOT NULL,
    substation_name STRING,
    location STRING,
    capacity_kva DECIMAL(20, 2),
    voltage_level STRING,
    health_score INT,
    updated_at TIMESTAMP(3),
    PRIMARY KEY (substation_id) NOT ENFORCED,
    WATERMARK FOR updated_at AS updated_at - INTERVAL '5' SECOND
) WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 6. DWD Enriched Power Consumption Table (Result of Delta Join)
CREATE TABLE IF NOT EXISTS dwd.dwd_power_consumption_enriched (
    reading_id BIGINT NOT NULL,
    substation_id STRING,
    meter_id STRING,
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    current_amps DECIMAL(10, 2),
    reading_ts TIMESTAMP(3),
    adjustment_kwh DECIMAL(20, 4),
    adjusted_by STRING,
    is_adjusted BOOLEAN,
    PRIMARY KEY (reading_id) NOT ENFORCED,
    WATERMARK FOR reading_ts AS reading_ts - INTERVAL '5' SECOND
) WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 7. Transformer Latest Metrics (PK Table - Unpartitioned, for lookup joins)
CREATE TABLE IF NOT EXISTS dwd.dwd_transformer_latest_metrics (
    transformer_id STRING NOT NULL,
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    updated_at TIMESTAMP(3),
    PRIMARY KEY (transformer_id) NOT ENFORCED,
    WATERMARK FOR updated_at AS updated_at - INTERVAL '5' SECOND
) WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s',
    'lookup.cache' = 'PARTIAL',
    'lookup.partial-cache.max-rows' = '100',
    'lookup.partial-cache.expire-after-write' = '5s'
);

-- 8. DWS 1-Minute Substation Window Stats (PK Table - Partitioned by dt)
CREATE TABLE IF NOT EXISTS dws.dws_substation_window_stats (
    substation_id STRING NOT NULL,
    window_start TIMESTAMP(3) NOT NULL,
    window_end TIMESTAMP(3) NOT NULL,
    reading_count BIGINT NOT NULL,
    total_consumption DECIMAL(20, 4) NOT NULL,
    avg_voltage DECIMAL(10, 2) NOT NULL,
    max_current DECIMAL(10, 2) NOT NULL,
    dt STRING NOT NULL,
    PRIMARY KEY (substation_id, window_start, window_end, dt) NOT ENFORCED
) PARTITIONED BY (dt)
WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 9. ADS Grid Anomaly Alerts (PK Table - Partitioned by dt)
CREATE TABLE IF NOT EXISTS ads.ads_grid_anomaly_alerts (
    alert_id STRING NOT NULL,
    substation_id STRING,
    transformer_id STRING,
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    temperature_celsius DECIMAL(10, 2),
    health_score INT,
    alert_type STRING,
    alert_details STRING,
    alert_ts TIMESTAMP(3),
    dt STRING NOT NULL,
    PRIMARY KEY (alert_id, dt) NOT ENFORCED
) PARTITIONED BY (dt)
WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);

-- 10. ADS CEP Risk Alerts (PK Table - Partitioned by dt)
CREATE TABLE IF NOT EXISTS ads.ads_cep_risk_alerts (
    alert_id STRING NOT NULL,
    substation_id STRING,
    transformer_id STRING,
    first_metric_id BIGINT,
    second_metric_id BIGINT,
    temp_shift DECIMAL(10, 2),
    time_gap_seconds BIGINT,
    alert_details STRING,
    alert_ts TIMESTAMP(3),
    dt STRING NOT NULL,
    PRIMARY KEY (alert_id, dt) NOT ENFORCED
) PARTITIONED BY (dt)
WITH (
    'changelog.producer' = 'table',
    'table.datalake.enabled' = 'true',
    'table.datalake.format' = 'paimon',
    'table.datalake.freshness' = '60s'
);
SQL_CREATE
echo "  ✅ 10 张 Fluss 物理表（含双路 ODS PK/Log 表）结构建表成功。"

# -------------------------------------------------------
# Step 4: 提交 CDC 作业 — Postgres CDC → Fluss (YAML 模式)
# -------------------------------------------------------
echo ""
echo "=== [4/10] 提交 Flink CDC YAML 同步任务 (Postgres → Fluss) ==="
docker compose exec -T flink-cdc-cli bash -c "
  cp /tmp/jars/*.jar /opt/flink/lib/ 2>/dev/null || true
  FLINK_HOME=/opt/flink /opt/flink-cdc/bin/flink-cdc.sh /project/postgres-to-fluss.yaml
"
echo "  ✅ Flink CDC YAML 同步作业已提交。"

# -------------------------------------------------------
# Step 4.5: 初始化 StarRocks 数据库、表结构与冷热路由视图
# -------------------------------------------------------
echo ""
echo "=== [4.5/10] 初始化 StarRocks 数据库与表结构 ==="

# 等待 StarRocks 就绪
echo "等待 StarRocks..."
starrocks_init_count=0
until docker compose exec -T starrocks mysql -h 127.0.0.1 -P 9030 -u root -e "SELECT 1;" &>/dev/null; do
    starrocks_init_count=$((starrocks_init_count + 1))
    if [ $starrocks_init_count -ge 30 ]; then
        echo "  StarRocks 未就绪，退出"
        exit 1
    fi
    sleep 2
done
echo "  StarRocks 就绪"

# 清空 StarRocks 旧数据库（仅当 CLEAN_MODE 为 true 时）
if [ "$CLEAN_MODE" = "true" ]; then
    echo "  [清理模式] 正在清空 StarRocks 旧数据..."
    docker compose exec -T starrocks mysql -h 127.0.0.1 -P 9030 -u root -e "
    DROP DATABASE IF EXISTS dwd;
    DROP DATABASE IF EXISTS dws;
    DROP DATABASE IF EXISTS ads;
    " 2>/dev/null || true
fi

docker compose exec -T starrocks mysql -h 127.0.0.1 -P 9030 -u root <<'SR_INIT'
CREATE DATABASE IF NOT EXISTS dwd;
CREATE DATABASE IF NOT EXISTS dws;
CREATE DATABASE IF NOT EXISTS ads;

-- 1. DWD Transformer Metrics 明细内表 (TTL = 7d)
CREATE TABLE IF NOT EXISTS dwd.dwd_transformer_metrics (
    metric_id BIGINT NOT NULL,
    transformer_id VARCHAR(50),
    substation_id VARCHAR(50),
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    metric_ts DATETIME,
    dt DATE
) ENGINE=OLAP
DUPLICATE KEY(metric_id, transformer_id)
PARTITION BY date_trunc('day', dt)
PROPERTIES (
    "replication_num" = "1",
    "partition_ttl" = "7 DAY"
);

-- 2. DWD Power Consumption 明细内表 (TTL = 7d)
CREATE TABLE IF NOT EXISTS dwd.dwd_power_consumption (
    reading_id BIGINT NOT NULL,
    substation_id VARCHAR(50),
    meter_id VARCHAR(50),
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    current_amps DECIMAL(10, 2),
    reading_ts DATETIME,
    dt DATE
) ENGINE=OLAP
DUPLICATE KEY(reading_id, substation_id)
PARTITION BY date_trunc('day', dt)
PROPERTIES (
    "replication_num" = "1",
    "partition_ttl" = "7 DAY"
);

-- 3. ADS Transformer 最新监测指标 (Primary Key)
CREATE TABLE IF NOT EXISTS ads.rt_transformer_latest_metrics (
    transformer_id VARCHAR(50) NOT NULL,
    temperature_celsius DECIMAL(10, 2) NOT NULL,
    load_ratio DECIMAL(10, 4) NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=OLAP
PRIMARY KEY(transformer_id)
PROPERTIES (
    "replication_num" = "1"
);

-- 4. DWS 变电站 1分钟滚动窗口聚合 (Primary Key)
CREATE TABLE IF NOT EXISTS ads.rt_substation_window_stats (
    substation_id VARCHAR(50) NOT NULL,
    window_start DATETIME NOT NULL,
    window_end DATETIME NOT NULL,
    reading_count BIGINT NOT NULL,
    total_consumption DECIMAL(20, 4) NOT NULL,
    avg_voltage DECIMAL(10, 2) NOT NULL,
    max_current DECIMAL(10, 2) NOT NULL
) ENGINE=OLAP
PRIMARY KEY(substation_id, window_start)
PROPERTIES (
    "replication_num" = "1"
);

-- 5. ADS 电网异常告警 (Primary Key)
CREATE TABLE IF NOT EXISTS ads.rt_grid_anomaly_alerts (
    alert_id VARCHAR(100) NOT NULL,
    substation_id VARCHAR(50),
    transformer_id VARCHAR(50),
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    temperature_celsius DECIMAL(10, 2),
    health_score INT,
    alert_type VARCHAR(50),
    alert_details TEXT,
    alert_ts DATETIME
) ENGINE=OLAP
PRIMARY KEY(alert_id)
PROPERTIES (
    "replication_num" = "1"
);

-- 6. ADS CEP Substation Risk Alerts (Primary Key)
CREATE TABLE IF NOT EXISTS ads.rt_cep_risk_alerts (
    alert_id VARCHAR(100) NOT NULL,
    substation_id VARCHAR(50),
    transformer_id VARCHAR(50),
    first_metric_id BIGINT,
    second_metric_id BIGINT,
    temp_shift DECIMAL(10, 2),
    time_gap_seconds BIGINT,
    alert_details TEXT,
    alert_ts DATETIME
) ENGINE=OLAP
PRIMARY KEY(alert_id)
PROPERTIES (
    "replication_num" = "1"
);

-- 7. ADS 用电审核调整表 (Primary Key)
CREATE TABLE IF NOT EXISTS ads.rt_power_adjustments (
    reading_id BIGINT NOT NULL,
    adjustment_kwh DECIMAL(20, 4) NOT NULL,
    adjusted_by VARCHAR(50) NOT NULL,
    last_updated DATETIME NOT NULL
) ENGINE=OLAP
PRIMARY KEY(reading_id)
PROPERTIES (
    "replication_num" = "1"
);

-- 8. Paimon External Catalog
CREATE EXTERNAL CATALOG IF NOT EXISTS paimon_catalog
PROPERTIES (
    'type' = 'paimon',
    'paimon.catalog.type' = 'filesystem',
    'paimon.catalog.warehouse' = 's3://fluss/paimon',
    'aws.s3.endpoint' = 'http://rustfs:9000',
    'aws.s3.access_key' = 'rustfsadmin',
    'aws.s3.secret_key' = 'rustfsadmin',
    'aws.s3.enable_path_style_access' = 'true'
);

-- 9. 冷热路由视图
CREATE VIEW IF NOT EXISTS dwd.v_transformer_metrics AS
SELECT metric_id, transformer_id, substation_id, temperature_celsius, load_ratio, metric_ts, dt
FROM dwd.dwd_transformer_metrics
UNION ALL
SELECT metric_id, transformer_id, substation_id, temperature_celsius, load_ratio, metric_ts, CAST(metric_ts AS DATE) AS dt
FROM paimon_catalog.ods.transformer_metrics
WHERE metric_ts < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY);

CREATE VIEW IF NOT EXISTS dwd.v_power_consumption AS
SELECT reading_id, substation_id, meter_id, consumption_kwh, voltage, current_amps, reading_ts, dt
FROM dwd.dwd_power_consumption
UNION ALL
SELECT reading_id, substation_id, meter_id, consumption_kwh, voltage, current_amps, reading_ts, CAST(reading_ts AS DATE) AS dt
FROM paimon_catalog.ods.power_consumption
WHERE reading_ts < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY);

CREATE VIEW IF NOT EXISTS dws.v_substation_window_stats AS
SELECT substation_id, window_start, window_end, reading_count, total_consumption, avg_voltage, max_current
FROM ads.rt_substation_window_stats
UNION ALL
SELECT substation_id, window_start, window_end, reading_count, total_consumption, avg_voltage, max_current
FROM paimon_catalog.dws.dws_substation_window_stats;

CREATE VIEW IF NOT EXISTS ads.v_grid_anomaly_alerts AS
SELECT alert_id, substation_id, transformer_id, consumption_kwh, voltage, temperature_celsius, health_score, alert_type, alert_details, alert_ts
FROM ads.rt_grid_anomaly_alerts
UNION ALL
SELECT alert_id, substation_id, transformer_id, consumption_kwh, voltage, temperature_celsius, health_score, alert_type, alert_details, alert_ts
FROM paimon_catalog.ads.ads_grid_anomaly_alerts;

CREATE VIEW IF NOT EXISTS ads.v_cep_risk_alerts AS
SELECT alert_id, substation_id, transformer_id, first_metric_id, second_metric_id, temp_shift, time_gap_seconds, alert_details, alert_ts
FROM ads.rt_cep_risk_alerts
UNION ALL
SELECT alert_id, substation_id, transformer_id, first_metric_id, second_metric_id, temp_shift, time_gap_seconds, alert_details, alert_ts
FROM paimon_catalog.ads.ads_cep_risk_alerts;
SR_INIT
echo "  ✅ StarRocks 库、表、外表 Catalog 与冷热视图初始化完成。"

# -------------------------------------------------------
# Step 5: 提交流计算与 StarRocks 写入任务 (DWD/DWS/ADS)
# -------------------------------------------------------
echo ""
echo "=== [5/10] 提交流计算与关联/CEP 任务 (含实时 StarRocks 写入) ==="
docker compose exec -T sql-client ./bin/sql-client.sh > /dev/null 2>&1 <<'SQL_COMPUTE'
SET 'sql-client.execution.result-mode' = 'TABLEAU';
SET 'execution.checkpointing.interval' = '15s';
SET 'restart-strategy' = 'fixed-delay';
SET 'restart-strategy.fixed-delay.attempts' = '10';
SET 'restart-strategy.fixed-delay.delay' = '5s';
SET 'table.exec.sink.upsert-materialize' = 'NONE';
SET 'table.local-time-zone' = 'Asia/Shanghai';
SET 'table.exec.source.idle-timeout' = '10s';
SET 'parallelism.default' = '4';

CREATE CATALOG IF NOT EXISTS fluss_catalog WITH (
  'type' = 'fluss',
  'bootstrap.servers' = 'coordinator-server:9123',
  'paimon.s3.access-key' = 'rustfsadmin',
  'paimon.s3.secret-key' = 'rustfsadmin'
);
USE CATALOG fluss_catalog;

-- StarRocks Sinks (MySQL protocol)
CREATE TEMPORARY TABLE sr_latest_prices (
    transformer_id STRING,
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    updated_at TIMESTAMP(3)
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/ads',
    'table-name' = 'rt_transformer_latest_metrics',
    'username' = 'root',
    'password' = ''
);

CREATE TEMPORARY TABLE sr_dws_stats (
    substation_id STRING,
    window_start TIMESTAMP(3),
    window_end TIMESTAMP(3),
    reading_count BIGINT,
    total_consumption DECIMAL(20, 4),
    avg_voltage DECIMAL(10, 2),
    max_current DECIMAL(10, 2)
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/ads',
    'table-name' = 'rt_substation_window_stats',
    'username' = 'root',
    'password' = ''
);

CREATE TEMPORARY TABLE sr_rt_alerts (
    alert_id STRING,
    substation_id STRING,
    transformer_id STRING,
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    temperature_celsius DECIMAL(10, 2),
    health_score INT,
    alert_type STRING,
    alert_details STRING,
    alert_ts TIMESTAMP(3)
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/ads',
    'table-name' = 'rt_grid_anomaly_alerts',
    'username' = 'root',
    'password' = ''
);

CREATE TEMPORARY TABLE sr_cep_alerts (
    alert_id STRING,
    substation_id STRING,
    transformer_id STRING,
    first_metric_id BIGINT,
    second_metric_id BIGINT,
    temp_shift DECIMAL(10, 2),
    time_gap_seconds BIGINT,
    alert_details STRING,
    alert_ts TIMESTAMP(3)
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/ads',
    'table-name' = 'rt_cep_risk_alerts',
    'username' = 'root',
    'password' = ''
);

CREATE TEMPORARY TABLE sr_dwd_transformer_metrics (
    metric_id BIGINT,
    transformer_id STRING,
    substation_id STRING,
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    metric_ts TIMESTAMP(3),
    dt STRING
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/dwd',
    'table-name' = 'dwd_transformer_metrics',
    'username' = 'root',
    'password' = ''
);

CREATE TEMPORARY TABLE sr_dwd_power_consumption (
    reading_id BIGINT,
    substation_id STRING,
    meter_id STRING,
    consumption_kwh DECIMAL(20, 4),
    voltage DECIMAL(10, 2),
    current_amps DECIMAL(10, 2),
    reading_ts TIMESTAMP(3),
    dt STRING
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/dwd',
    'table-name' = 'dwd_power_consumption',
    'username' = 'root',
    'password' = ''
);

-- PostgreSQL Lookups (PG only retains source/dimension DB)
CREATE TEMPORARY TABLE pg_substation_profiles (
    substation_id STRING,
    substation_name STRING,
    location STRING,
    capacity_kva DECIMAL(20, 2),
    voltage_level STRING,
    health_score INT,
    updated_at TIMESTAMP(3),
    PRIMARY KEY (substation_id) NOT ENFORCED
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:postgresql://postgres:5432/postgres',
    'table-name' = 'dwd.substation_profiles',
    'username' = 'root',
    'password' = 'password',
    'lookup.cache' = 'PARTIAL',
    'lookup.partial-cache.max-rows' = '100',
    'lookup.partial-cache.expire-after-write' = '5s'
);

-- StarRocks Lookup for Transformer metrics
CREATE TEMPORARY TABLE sr_lookup_transformer_metrics (
    transformer_id STRING,
    temperature_celsius DECIMAL(10, 2),
    load_ratio DECIMAL(10, 4),
    updated_at TIMESTAMP(3),
    PRIMARY KEY (transformer_id) NOT ENFORCED
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:mysql://starrocks:9030/ads',
    'table-name' = 'rt_transformer_latest_metrics',
    'username' = 'root',
    'password' = '',
    'lookup.cache' = 'PARTIAL',
    'lookup.partial-cache.max-rows' = '100',
    'lookup.partial-cache.expire-after-write' = '5s'
);

EXECUTE STATEMENT SET BEGIN
  -- 1. 更新最新变压器指标 (DWD 主键表 + StarRocks 物理表，基于 Fluss 0.9 读时转换)
  INSERT INTO dwd.dwd_transformer_latest_metrics
  SELECT transformer_id, temperature_celsius, load_ratio, metric_ts FROM ods.transformer_metrics;

  INSERT INTO sr_latest_prices
  SELECT transformer_id, temperature_celsius, load_ratio, updated_at
  FROM dwd.dwd_transformer_latest_metrics$changelog
  WHERE _change_type = 'insert' OR _change_type = 'update_after';

  -- 1.5. Changelog Bridge: Sync from PK changelog to Log table for CEP (dollar changelog = insert)
  INSERT INTO ods.transformer_metrics_log
  SELECT metric_id, transformer_id, substation_id, temperature_celsius, load_ratio, metric_ts
  FROM ods.`transformer_metrics$changelog`
  WHERE _change_type = 'insert';

  -- 1.7 Delta Join: Left join meter readings with audit corrections on reading_id PK
  INSERT INTO dwd.dwd_power_consumption_enriched
  SELECT
      c.reading_id, c.substation_id, c.meter_id, c.consumption_kwh, c.voltage, c.current_amps, c.reading_ts,
      a.adjustment_kwh, a.adjusted_by,
      CASE WHEN a.adjustment_kwh IS NOT NULL THEN TRUE ELSE FALSE END AS is_adjusted
  FROM ods.power_consumption AS c
  LEFT JOIN ods.power_adjustments AS a ON c.reading_id = a.reading_id;

  -- 2. DWS Event-Time 1分钟滚动窗口聚合 (DWS 分区主键表 + StarRocks 物理表，基于 TVF Tumbling Window)
  INSERT INTO dws.dws_substation_window_stats
  SELECT
      substation_id,
      window_start,
      window_end,
      COUNT(*) AS reading_count,
      SUM(consumption_kwh + COALESCE(adjustment_kwh, 0.0)) AS total_consumption,
      AVG(voltage) AS avg_voltage,
      MAX(current_amps) AS max_current,
      DATE_FORMAT(window_start, 'yyyy-MM-dd') AS dt
  FROM TABLE(
      TUMBLE(TABLE dwd.dwd_power_consumption_enriched, DESCRIPTOR(reading_ts), INTERVAL '1' MINUTE)
  )
  GROUP BY substation_id, window_start, window_end;

  INSERT INTO sr_dws_stats
  SELECT substation_id, window_start, window_end, reading_count, total_consumption, avg_voltage, max_current
  FROM dws.dws_substation_window_stats$changelog
  WHERE _change_type = 'insert' OR _change_type = 'update_after';

  -- 3. ADS 电网异常告警 (ADS 分区主键表 + StarRocks 物理表，基于 Flink 2.2 SYSTEM_TIME AS OF 外置主键 Lookup Join)
  INSERT INTO ads.ads_grid_anomaly_alerts
  SELECT
      CONCAT('ALT-', s.substation_id, '-', CAST(s.reading_id AS VARCHAR), '-', DATE_FORMAT(s.reading_ts, 'yyyyMMddHHmmssSSS')) AS alert_id,
      s.substation_id,
      CONCAT('TR-', SUBSTRING(s.substation_id, 5)) AS transformer_id,
      s.consumption_kwh,
      s.voltage,
      COALESCE(t.temperature_celsius, 40.0) AS temperature_celsius,
      COALESCE(p.health_score, 100) AS health_score,
      CASE
          WHEN s.voltage < 200.0 OR s.voltage > 240.0 THEN 'VOLTAGE_ANOMALY'
          WHEN COALESCE(t.temperature_celsius, 40.0) > 85.0 THEN 'TRANSFORMER_OVERHEAT'
          ELSE 'GRID_LOAD_WARNING'
      END AS alert_type,
      CASE
          WHEN s.voltage < 200.0 OR s.voltage > 240.0
              THEN CONCAT('电压异常偏离标称值！电压: ', CAST(s.voltage AS VARCHAR), 'V, 电表 ID: ', s.meter_id)
          ELSE CONCAT('电网负载偏高！用电量: ', CAST(s.consumption_kwh AS VARCHAR), ' kWh, 变电站健康度: ', CAST(COALESCE(p.health_score, 100) AS VARCHAR))
      END AS alert_details,
      s.reading_ts AS alert_ts,
      DATE_FORMAT(s.reading_ts, 'yyyy-MM-dd') AS dt
  FROM (
      SELECT reading_id, substation_id, meter_id, consumption_kwh, voltage, current_amps, reading_ts, PROCTIME() AS proctime
      FROM ods.`power_consumption$changelog`
      WHERE _change_type = 'insert'
  ) AS s
  LEFT JOIN pg_substation_profiles FOR SYSTEM_TIME AS OF s.proctime AS p
    ON s.substation_id = p.substation_id
  LEFT JOIN sr_lookup_transformer_metrics FOR SYSTEM_TIME AS OF s.proctime AS t
    ON CONCAT('TR-', SUBSTRING(s.substation_id, 5)) = t.transformer_id
  WHERE
    s.voltage < 200.0 OR s.voltage > 240.0
    OR COALESCE(t.temperature_celsius, 40.0) > 80.0
    OR s.consumption_kwh > 100.0;

  INSERT INTO sr_rt_alerts
  SELECT
      CONCAT('ALT-', s.substation_id, '-', CAST(s.reading_id AS VARCHAR), '-', DATE_FORMAT(s.reading_ts, 'yyyyMMddHHmmssSSS')) AS alert_id,
      s.substation_id,
      CONCAT('TR-', SUBSTRING(s.substation_id, 5)) AS transformer_id,
      s.consumption_kwh,
      s.voltage,
      COALESCE(t.temperature_celsius, 40.0) AS temperature_celsius,
      COALESCE(p.health_score, 100) AS health_score,
      CASE
          WHEN s.voltage < 200.0 OR s.voltage > 240.0 THEN 'VOLTAGE_ANOMALY'
          WHEN COALESCE(t.temperature_celsius, 40.0) > 85.0 THEN 'TRANSFORMER_OVERHEAT'
          ELSE 'GRID_LOAD_WARNING'
      END AS alert_type,
      CASE
          WHEN s.voltage < 200.0 OR s.voltage > 240.0
              THEN CONCAT('电压异常偏离标称值！电压: ', CAST(s.voltage AS VARCHAR), 'V, 电表 ID: ', s.meter_id)
          ELSE CONCAT('电网负载偏高！用电量: ', CAST(s.consumption_kwh AS VARCHAR), ' kWh, 变电站健康度: ', CAST(COALESCE(p.health_score, 100) AS VARCHAR))
      END AS alert_details,
      s.reading_ts AS alert_ts
  FROM (
      SELECT reading_id, substation_id, meter_id, consumption_kwh, voltage, current_amps, reading_ts, PROCTIME() AS proctime
      FROM ods.`power_consumption$changelog`
      WHERE _change_type = 'insert'
  ) AS s
  LEFT JOIN pg_substation_profiles FOR SYSTEM_TIME AS OF s.proctime AS p
    ON s.substation_id = p.substation_id
  LEFT JOIN sr_lookup_transformer_metrics FOR SYSTEM_TIME AS OF s.proctime AS t
    ON CONCAT('TR-', SUBSTRING(s.substation_id, 5)) = t.transformer_id
  WHERE
    s.voltage < 200.0 OR s.voltage > 240.0
    OR COALESCE(t.temperature_celsius, 40.0) > 80.0
    OR s.consumption_kwh > 100.0;

  -- 4. ADS Flink CEP 复杂事件匹配：变压器 15 秒内温度骤升连续监控
  INSERT INTO ads.ads_cep_risk_alerts
  SELECT
      CONCAT('CEP-', transformer_id, '-', DATE_FORMAT(first_ts, 'yyyyMMddHHmmss')) AS alert_id,
      substation_id,
      transformer_id,
      first_metric_id,
      second_metric_id,
      temp_shift,
      time_gap_seconds,
      CONCAT('变压器高频升温异动！在 ', CAST(time_gap_seconds AS VARCHAR), ' 秒内连续升温，温差 ', CAST(temp_shift AS VARCHAR), '°C') AS alert_details,
      second_ts AS alert_ts,
      DATE_FORMAT(second_ts, 'yyyy-MM-dd') AS dt
  FROM ods.transformer_metrics_log
  MATCH_RECOGNIZE (
      PARTITION BY substation_id, transformer_id
      ORDER BY metric_ts
      MEASURES
          A.metric_id AS first_metric_id,
          B.metric_id AS second_metric_id,
          A.metric_ts AS first_ts,
          B.metric_ts AS second_ts,
          (B.temperature_celsius - A.temperature_celsius) AS temp_shift,
          TIMESTAMPDIFF(SECOND, A.metric_ts, B.metric_ts) AS time_gap_seconds
      ONE ROW PER MATCH
      AFTER MATCH SKIP PAST LAST ROW
      PATTERN (A B)
      DEFINE
          A AS A.temperature_celsius > 0,
          B AS B.metric_ts <= A.metric_ts + INTERVAL '15' SECOND
              AND (B.temperature_celsius - A.temperature_celsius) > 5.0
  );

  INSERT INTO sr_cep_alerts
  SELECT
      CONCAT('CEP-', transformer_id, '-', DATE_FORMAT(first_ts, 'yyyyMMddHHmmss')) AS alert_id,
      substation_id,
      transformer_id,
      first_metric_id,
      second_metric_id,
      temp_shift,
      time_gap_seconds,
      CONCAT('变压器高频升温异动！在 ', CAST(time_gap_seconds AS VARCHAR), ' 秒内连续升温，温差 ', CAST(temp_shift AS VARCHAR), '°C') AS alert_details,
      second_ts AS alert_ts
  FROM ods.transformer_metrics_log
  MATCH_RECOGNIZE (
      PARTITION BY substation_id, transformer_id
      ORDER BY metric_ts
      MEASURES
          A.metric_id AS first_metric_id,
          B.metric_id AS second_metric_id,
          A.metric_ts AS first_ts,
          B.metric_ts AS second_ts,
          (B.temperature_celsius - A.temperature_celsius) AS temp_shift,
          TIMESTAMPDIFF(SECOND, A.metric_ts, B.metric_ts) AS time_gap_seconds
      ONE ROW PER MATCH
      AFTER MATCH SKIP PAST LAST ROW
      PATTERN (A B)
      DEFINE
          A AS A.temperature_celsius > 0,
          B AS B.metric_ts <= A.metric_ts + INTERVAL '15' SECOND
              AND (B.temperature_celsius - A.temperature_celsius) > 5.0
  );

  -- 5. 明细 DWD 实时写入 StarRocks
  INSERT INTO sr_dwd_transformer_metrics
  SELECT metric_id, transformer_id, substation_id, temperature_celsius, load_ratio, metric_ts, DATE_FORMAT(metric_ts, 'yyyy-MM-dd') AS dt
  FROM ods.transformer_metrics_log;

  INSERT INTO sr_dwd_power_consumption
  SELECT reading_id, substation_id, meter_id, consumption_kwh, voltage, current_amps, reading_ts, DATE_FORMAT(reading_ts, 'yyyy-MM-dd') AS dt
  FROM ods.`power_consumption$changelog`
  WHERE _change_type = 'insert';
END;
SQL_COMPUTE
echo "  ✅ DWD/DWS/ADS 流计算与 CEP (直连 StarRocks Sink) 作业已提交。"

# -------------------------------------------------------
# Step 7: 启动 Tiering Service
# -------------------------------------------------------
echo ""
echo "=== [7/10] 启动 Tiering Service (Fluss → Paimon) ==="
docker compose exec jobmanager ./bin/flink run \
    -Dpipeline.name="Fluss Lake Tiering Service - paimon" \
    -Dexecution.checkpointing.interval=10s \
    /opt/flink/lib/fluss-flink-tiering-0.9.1-incubating.jar \
    --fluss.bootstrap.servers coordinator-server:9123 \
    --datalake.format paimon \
    --datalake.paimon.metastore filesystem \
    --datalake.paimon.warehouse s3://fluss/paimon \
    --datalake.paimon.s3.endpoint http://rustfs:9000 \
    --datalake.paimon.s3.access.key rustfsadmin \
    --datalake.paimon.s3.secret.key rustfsadmin \
    --datalake.paimon.s3.path.style.access true > /dev/null 2>&1
echo "  ✅ Tiering Service 已启动。"

# -------------------------------------------------------
# Step 9: 验证 Flink Job 状态
# -------------------------------------------------------
echo ""
echo "=== [9/10] 验证 Flink 运行中作业 ==="
sleep 5
curl -sf http://localhost:8083/jobs/overview | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('  Job Name                                              | Status')
print('  ' + '-' * 52 + '+' + '-' * 12)
running = 0
for job in data.get('jobs', []):
    status = job['state']
    print(f'  {job[\"name\"][:50]:50s} | {status:10s}')
    if status == 'RUNNING':
        running += 1
print(f'\n  共 {len(data[\"jobs\"])} 个 Flink 作业，其中 {running} 个 RUNNING')
" || true

echo ""
echo "=== [10/10] 一键启动与更新成功 ==="
echo "Flink UI: http://localhost:8083"
echo "看板地址: http://localhost:5050"

