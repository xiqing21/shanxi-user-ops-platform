import type { FastifyInstance } from "fastify";
import { calculateLoadRate } from "@shanxi/domain";
import { loadSnapshot } from "../services/fixture-store";

interface RuntimeProbe {
  connected: boolean;
  message: string;
  detail?: unknown;
}

export async function operationsRoutes(app: FastifyInstance) {
  app.get("/operations/summary", async () => {
    const snapshot = await loadSnapshot();
    const latestByUser = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
    const totalLoadKw = Array.from(latestByUser.values()).reduce((sum, reading) => sum + reading.activePowerKw, 0);
    const largeIndustrialUsers = snapshot.users.filter((user) => user.userType === "large_industrial");
    const criticalRisks = snapshot.risks.filter((risk) => risk.level === "critical");
    return {
      generatedAt: snapshot.generatedAt,
      totalUsers: snapshot.users.length,
      totalLoadKw: Number(totalLoadKw.toFixed(2)),
      largeIndustrialUsers: largeIndustrialUsers.length,
      activeRisks: snapshot.risks.length,
      criticalRisks: criticalRisks.length
    };
  });

  app.get("/operations/risks", async () => {
    const snapshot = await loadSnapshot();
    const users = new Map(snapshot.users.map((user) => [user.userId, user]));
    return snapshot.risks.slice(0, 50).map((risk) => {
      const user = users.get(risk.userId);
      return {
        ...risk,
        userName: user?.userName ?? risk.userId,
        city: user?.city ?? "未知",
        county: user?.county ?? "未知",
        userType: user?.userType ?? "unknown",
        industry: user?.industry ?? "未知"
      };
    });
  });

  app.get("/operations/industrial", async () => {
    const snapshot = await loadSnapshot();
    const latest = new Map(snapshot.readings.map((reading) => [reading.userId, reading]));
    return snapshot.users
      .filter((user) => user.userType === "large_industrial" || user.userType === "high_energy")
      .map((user) => {
        const reading = latest.get(user.userId);
        return {
          ...user,
          activePowerKw: reading?.activePowerKw ?? 0,
          loadRate: reading ? calculateLoadRate(reading.activePowerKw, user.contractCapacityKva, reading.powerFactor) : 0
        };
      })
      .sort((a, b) => b.activePowerKw - a.activePowerKw)
      .slice(0, 30);
  });

  app.get("/operations/runtime-status", async () => {
    const flinkRestUrl = process.env.FLINK_REST_URL ?? "http://flink-jobmanager:8081";
    const aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://ai:8000";
    const starrocksUrl = process.env.STARROCKS_HTTP_URL ?? "http://starrocks:8030";

    const [flink, ai, starrocks] = await Promise.all([
      probeFlink(flinkRestUrl),
      probeHttp(`${aiServiceUrl}/health`, "Python AI 服务已响应", "Python AI 服务未响应"),
      probeHttp(starrocksUrl, "StarRocks FE HTTP 已响应", "StarRocks 未启动或未开放 HTTP")
    ]);

    return {
      flink,
      milvus: {
        connected: ai.connected,
        collections: ["shanxi_metadata_assets"],
        message: ai.connected ? "Milvus 由 Python AI 服务连接并承载元数据向量库。" : "Milvus 依赖 Python AI 服务初始化；当前 AI 服务不可达。"
      },
      ai,
      starrocks,
      postgres: {
        connected: Boolean(process.env.POSTGRES_HOST),
        message: process.env.POSTGRES_HOST ? `PostgreSQL CDC 源配置为 ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT ?? "5432"}` : "基础栈未启用 PostgreSQL；使用 --full/lakehouse profile 后会出现。"
      }
    };
  });

  app.get("/operations/runtime-topology", async () => ({
    modes: [
      {
        id: "core",
        name: "核心演示栈",
        command: "pnpm stack:up",
        description: "Web、Node API、Python AI、Milvus、MinIO、etcd，适合产品演示和 Text-to-SQL/向量检索。"
      },
      {
        id: "lakehouse",
        name: "完全体流湖仓栈",
        command: "pnpm stack:up:full",
        description: "在核心栈基础上启用 Flink、Fluss、Paimon S3 Warehouse、StarRocks、PostgreSQL CDC。"
      }
    ],
    services: [
      service("web", "Web 前端", "产品交互", "核心", "React + shadcn UI。默认 Docker 端口 5051。", ["5051->5050"]),
      service("api", "Node API/BFF", "接口编排", "核心", "统一给前端提供运营、模拟、Text-to-SQL、运行状态接口。", ["4000"]),
      service("ai", "Python AI", "AI/向量检索", "核心", "DeepSeek、Text-to-SQL 规划、Milvus 元数据召回。", ["8000"]),
      service("milvus", "Milvus", "向量数据库", "核心", "保存表结构、字段、标签、业务语义的向量索引。日志中的 balance 是内部负载均衡心跳。", ["19530", "9091"]),
      service("etcd", "etcd", "Milvus 元数据", "核心", "Milvus standalone 的元数据存储。", ["2379"]),
      service("minio", "MinIO/S3", "对象存储", "核心/完全体", "Milvus 对象存储；完全体中也作为 Fluss/Paimon 的 S3 Warehouse。", ["19001->9001", "9000"]),
      service("postgres", "PostgreSQL CDC", "源端数据库", "完全体", "开启 logical WAL，模拟国网业务源库 CDC。", ["5432"]),
      service("flink-jobmanager", "Flink JobManager", "流批计算调度", "完全体", "Flink Web UI 与作业调度入口，REST 端口映射到 8083。", ["8083->8081"]),
      service("flink-taskmanager", "Flink TaskManager", "流批计算执行", "完全体", "执行 TVF、CEP、CDC、离线 batch 校准等任务。", []),
      service("flink-sql-client", "Flink SQL Client", "SQL 提交入口", "完全体", "用于进入容器提交 Flink SQL、Paimon/Fluss Catalog DDL。", []),
      service("zookeeper", "ZooKeeper", "Fluss 元数据协调", "完全体", "Fluss Coordinator/Tablet 的协调服务。", ["2181"]),
      service("fluss-coordinator", "Fluss Coordinator", "实时湖表协调", "完全体", "Fluss 元数据、分片、Tablet 调度入口。", ["9123"]),
      service("fluss-tablet", "Fluss Tablet", "实时湖表存储", "完全体", "承载 Fluss 表数据，并自动分层到 Paimon/S3。", ["9124"]),
      service("paimon-warehouse", "Paimon Warehouse", "离线快照层", "完全体", "不是单独容器，而是 Flink/Paimon Catalog 写入 MinIO 的 s3://fluss/paimon。", ["s3://fluss/paimon"]),
      service("starrocks", "StarRocks", "OLAP 查询/接口层", "完全体", "承接 ADS 宽表、看板接口和高速聚合查询。", ["9030", "8030", "8040"])
    ],
    notes: [
      "Milvus 的 balancer 日志是正常 INFO 心跳，不是报错。",
      "如果不想刷屏，用 pnpm stack:up 后台启动；需要看日志时再用 pnpm stack:logs milvus。",
      "Flink/Paimon 没有真正作业提交前，状态页会显示 Flink 在线但 Running Jobs 为 0。"
    ]
  }));
}

function service(id: string, name: string, category: string, mode: string, description: string, ports: string[]) {
  return { id, name, category, mode, description, ports };
}

async function probeFlink(baseUrl: string) {
  const overview = await probeJson<{ jobs?: Array<{ jid: string; state: string }> }>(`${baseUrl}/jobs/overview`);
  if (!overview.connected) {
    return {
      connected: false,
      submittedJobs: 0,
      runningJobs: 0,
      message: "Flink REST 未响应。基础栈不会启动 Flink；使用 pnpm stack:up:full 启动完全体。"
    };
  }
  const jobs = overview.detail?.jobs ?? [];
  return {
    connected: true,
    submittedJobs: jobs.length,
    runningJobs: jobs.filter((job) => job.state === "RUNNING").length,
    message: jobs.length ? "Flink REST 已连接，并检测到已提交作业。" : "Flink REST 已连接，但当前没有已提交作业。",
    jobs
  };
}

async function probeHttp(url: string, success: string, failure: string): Promise<RuntimeProbe> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
    return {
      connected: response.ok,
      message: response.ok ? success : `${failure}：HTTP ${response.status}`
    };
  } catch {
    return { connected: false, message: failure };
  }
}

async function probeJson<T>(url: string): Promise<RuntimeProbe & { detail?: T }> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return { connected: false, message: `HTTP ${response.status}` };
    return { connected: true, message: "ok", detail: await response.json() as T };
  } catch {
    return { connected: false, message: "unreachable" };
  }
}
