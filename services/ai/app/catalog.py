from dataclasses import dataclass


@dataclass(frozen=True)
class CatalogAsset:
    name: str
    description: str
    ddl: str
    tags: tuple[str, ...]

    @property
    def text(self) -> str:
        return "\n".join([self.name, self.description, ",".join(self.tags), self.ddl])


CATALOG_ASSETS: tuple[CatalogAsset, ...] = (
    CatalogAsset(
        name="dim_user_profile",
        description="山西省全量用电用户档案，含地市、行业、用户类型、合同容量、重要等级、标签。",
        ddl="CREATE TABLE dim_user_profile(user_id STRING, city STRING, industry STRING, user_type STRING, contract_capacity_kw DOUBLE, tags ARRAY<STRING>);",
        tags=("用户档案", "全量用户", "大工业", "地市", "行业"),
    ),
    CatalogAsset(
        name="dwd_user_meter_readings",
        description="用户计量点分钟级采集明细，适合 Flink CDC、TVF 窗口、CEP 异常识别。",
        ddl="CREATE TABLE dwd_user_meter_readings(user_id STRING, meter_id STRING, event_time TIMESTAMP, load_kw DOUBLE, voltage DOUBLE, current DOUBLE);",
        tags=("计量明细", "实时", "Flink", "TVF", "CEP"),
    ),
    CatalogAsset(
        name="ads_realtime_user_load",
        description="实时用户负荷服务宽表，覆盖当前负荷、同比环比、风险状态，但不保存长周期离线基线。",
        ddl="CREATE TABLE ads_realtime_user_load(user_id STRING, city STRING, load_kw DOUBLE, yoy_rate DOUBLE, mom_rate DOUBLE, risk_level STRING);",
        tags=("实时宽表", "接口表", "用户负荷"),
    ),
    CatalogAsset(
        name="dws_user_hourly_load_baseline",
        description="小时级用户负荷离线基线表，由 Flink batch 或定时离线任务基于 Paimon/Fluss 快照产出。",
        ddl="CREATE TABLE dws_user_hourly_load_baseline(user_id STRING, city STRING, industry STRING, stat_hour TIMESTAMP, avg_load_kw DOUBLE, p95_load_kw DOUBLE, spike_ratio DOUBLE);",
        tags=("离线基线", "Flink Batch", "Paimon", "Fluss", "稳态校验"),
    ),
    CatalogAsset(
        name="ads_industrial_peak_spike_rank",
        description="大工业用户晚高峰负荷突增排名接口表，面向运营驾驶舱和 AI 问数。",
        ddl="CREATE TABLE ads_industrial_peak_spike_rank(city STRING, industry STRING, user_id STRING, max_spike_ratio DOUBLE, rank_no INT, ds DATE);",
        tags=("大工业", "晚高峰", "突增", "排名", "ADS"),
    ),
)
