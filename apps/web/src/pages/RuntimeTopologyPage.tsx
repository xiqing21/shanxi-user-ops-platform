import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, CheckCircle2, CircleOff, Server, Terminal, Waypoints } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getJson } from "../lib/api";
import type { RoleView } from "../lib/roles";

interface RuntimeMode {
  id: string;
  name: string;
  command: string;
  description: string;
}

interface RuntimeService {
  id: string;
  name: string;
  category: string;
  mode: string;
  description: string;
  ports: string[];
}

interface RuntimeTopology {
  modes: RuntimeMode[];
  services: RuntimeService[];
  notes: string[];
}

interface RuntimeStatus {
  flink?: { connected: boolean; submittedJobs?: number; runningJobs?: number; message: string };
  ai?: { connected: boolean; message: string };
  milvus?: { connected: boolean; message: string; collections?: string[] };
  starrocks?: { connected: boolean; message: string };
  postgres?: { connected: boolean; message: string };
}

const statusMap: Record<string, keyof RuntimeStatus> = {
  ai: "ai",
  milvus: "milvus",
  "flink-jobmanager": "flink",
  "flink-taskmanager": "flink",
  "flink-sql-client": "flink",
  starrocks: "starrocks",
  postgres: "postgres"
};

export function RuntimeTopologyPage({ role }: { role: RoleView }) {
  const [topology, setTopology] = useState<RuntimeTopology | null>(null);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);

  useEffect(() => {
    void getJson<RuntimeTopology>("/operations/runtime-topology").then(setTopology);
    void getJson<RuntimeStatus>("/operations/runtime-status").then(setStatus);
  }, []);

  const grouped = useMemo(() => {
    const services = topology?.services ?? [];
    return {
      core: services.filter((service) => service.mode.includes("核心")),
      lakehouse: services.filter((service) => service.mode.includes("完全体"))
    };
  }, [topology]);

  if (!topology) return <div className="rounded-lg border bg-white p-6 text-slate-500 shadow-sm">加载运行拓扑...</div>;

  return (
    <div className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{role.shortName}视角</Badge>
            <Badge variant="outline">Docker Compose</Badge>
            <Badge variant="outline">核心栈 + 完全体</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">运行拓扑与组件字典</h2>
          <p className="mt-2 text-sm text-slate-500">把 Docker 里的每个服务、端口、职责和当前连接状态摊开看，避免日志刷屏时分不清谁是谁。</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <b className="text-slate-950">推荐启动</b>
          <code className="mt-1 block rounded-md bg-white px-2 py-1 text-xs text-blue-700">pnpm stack:up:full</code>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        {topology.modes.map((mode) => (
          <Card className="border-slate-200/80 bg-white/90 shadow-sm" key={mode.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {mode.id === "core" ? <Boxes className="h-4 w-4 text-blue-600" /> : <Waypoints className="h-4 w-4 text-blue-600" />}
                {mode.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">{mode.description}</p>
              <code className="mt-3 block rounded-lg bg-slate-950 p-3 text-xs text-emerald-100">{mode.command}</code>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ServiceGroup services={grouped.core} status={status} title="核心演示栈" />
        <ServiceGroup services={grouped.lakehouse} status={status} title="完全体流湖仓栈" />
      </section>

      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-amber-700" />
            终端日志怎么看
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm leading-6 text-amber-900 md:grid-cols-3">
          {topology.notes.map((note) => (
            <div className="rounded-lg bg-white/60 p-3" key={note}>{note}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceGroup({ services, status, title }: { services: RuntimeService[]; status: RuntimeStatus | null; title: string }) {
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4 text-blue-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} status={status} />
        ))}
      </CardContent>
    </Card>
  );
}

function ServiceCard({ service, status }: { service: RuntimeService; status: RuntimeStatus | null }) {
  const serviceStatus = statusForService(service.id, status);
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm text-slate-950">{service.name}</b>
            <Badge variant="outline">{service.id}</Badge>
            <Badge variant="secondary">{service.category}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{service.description}</p>
        </div>
        <StatusBadge connected={serviceStatus?.connected} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {service.ports.length ? service.ports.map((port) => <Badge key={port} variant="outline">{port}</Badge>) : <Badge variant="outline">internal</Badge>}
      </div>
      {serviceStatus?.message && <p className="mt-3 text-xs leading-5 text-slate-500">{serviceStatus.message}</p>}
      {service.id === "flink-jobmanager" && status?.flink?.connected && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <MiniMetric label="提交作业" value={status.flink.submittedJobs ?? 0} />
          <MiniMetric label="运行作业" value={status.flink.runningJobs ?? 0} />
        </div>
      )}
    </article>
  );
}

function StatusBadge({ connected }: { connected?: boolean }) {
  if (connected === undefined) {
    return (
      <Badge variant="outline">
        <Activity className="mr-1 h-3 w-3" />
        静态说明
      </Badge>
    );
  }
  return (
    <Badge variant={connected ? "secondary" : "outline"}>
      {connected ? <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> : <CircleOff className="mr-1 h-3 w-3 text-slate-400" />}
      {connected ? "在线" : "未连接"}
    </Badge>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white p-2">
      <b className="block text-base text-slate-950">{value}</b>
      <span className="text-slate-400">{label}</span>
    </div>
  );
}

function statusForService(id: string, status: RuntimeStatus | null) {
  if (!status) return undefined;
  if (id === "web" || id === "api" || id === "etcd" || id === "minio" || id === "paimon-warehouse" || id === "zookeeper" || id === "fluss-coordinator" || id === "fluss-tablet") return undefined;
  const key = statusMap[id];
  return key ? status[key] : undefined;
}
