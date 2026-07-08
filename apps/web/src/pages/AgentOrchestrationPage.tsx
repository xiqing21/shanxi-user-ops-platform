import { useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  GitBranch,
  Play,
  RotateCcw,
  ShieldCheck,
  Siren,
  TimerReset,
  Wrench
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import type { RoleView } from "../lib/roles";

type AgentStatus = "running" | "ready" | "waiting" | "done";

interface AgentNode {
  id: string;
  name: string;
  owner: string;
  tool: string;
  status: AgentStatus;
  latencyMs: number;
  detail: string;
}

const baseAgents: AgentNode[] = [
  {
    id: "intent",
    name: "意图规划 Agent",
    owner: "AI 平台",
    tool: "DeepSeek ReAct",
    status: "done",
    latencyMs: 680,
    detail: "拆解自然语言问题，判断是否需要新建任务或进入 Text2SQL。"
  },
  {
    id: "metadata",
    name: "元数据检索 Agent",
    owner: "数据资产",
    tool: "Milvus / BGE",
    status: "done",
    latencyMs: 124,
    detail: "召回 DWD、DWS、ADS 表、字段、标签、版本和血缘。"
  },
  {
    id: "sql_guard",
    name: "SQL 安全 Agent",
    owner: "安全治理",
    tool: "SQL Guard",
    status: "ready",
    latencyMs: 42,
    detail: "校验只读查询、LIMIT、敏感字段、宽表是否已存在。"
  },
  {
    id: "stream_alert",
    name: "实时告警 Agent",
    owner: "流计算",
    tool: "Flink CEP / TVF",
    status: "running",
    latencyMs: 310,
    detail: "监听过载、三相不平衡、低功率因数、负荷突增事件。"
  },
  {
    id: "batch_verify",
    name: "离线校验 Agent",
    owner: "离线数仓",
    tool: "Flink Batch / Fluss",
    status: "waiting",
    latencyMs: 0,
    detail: "夜间基于快照复算，修正实时误报、补采和档案订正。"
  },
  {
    id: "ops_dispatch",
    name: "处置编排 Agent",
    owner: "运维中心",
    tool: "工单 / Webhook",
    status: "ready",
    latencyMs: 95,
    detail: "根据角色、地市、风险等级生成处置建议和派发策略。"
  }
];

const eventTemplates = [
  "收到大工业晚高峰突增分析请求，进入 Plan & Execute。",
  "Milvus 命中 ads_industrial_peak_spike_rank、dws_user_hourly_load_baseline。",
  "SQL Guard 判断现有 ADS 可查，但建议保留离线复算任务。",
  "Flink CEP 发现太原 2 条过载风险，等待人工确认。",
  "离线校验 Agent 排队，将在 02:10 基于 Fluss 快照复算。",
  "处置编排 Agent 已生成属地班组派发建议。"
];

export function AgentOrchestrationPage({ role }: { role: RoleView }) {
  const [runId, setRunId] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState(baseAgents[0]);
  const agents = useMemo(() => {
    if (role.id !== "ai_ops") return baseAgents.filter((agent) => agent.id !== "sql_guard" || role.id !== "city_operator");
    return baseAgents;
  }, [role.id]);
  const completion = Math.round((agents.filter((agent) => agent.status === "done").length / agents.length) * 100);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{role.shortName}视角</Badge>
            <Badge variant="outline">Run #{String(runId).padStart(3, "0")}</Badge>
            <Badge variant="outline">Human-in-the-loop</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">多 Agent 编排控制台</h2>
          <p className="mt-2 text-sm text-slate-500">把 Text2SQL、元数据检索、SQL 安全、实时告警、离线校验和处置派发串成可观测流程。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setRunId((value) => value + 1)}>
            <Play className="mr-2 h-4 w-4" />
            启动演练
          </Button>
          <Button onClick={() => setSelectedAgent(baseAgents[0])} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            重置视图
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Kpi title="完成度" value={`${completion}%`} hint="编排节点进度" />
        <Kpi title="工具调用" value="18" hint="Milvus / DeepSeek / Flink" />
        <Kpi title="待人工确认" value="3" hint="高风险告警和 SQL 任务" />
        <Kpi title="预计节省" value="42min" hint="相对人工检索和排障" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.75fr]">
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-600" />
              Agent DAG
            </CardTitle>
            <Badge variant="outline">可点击节点</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {agents.map((agent, index) => (
                <button
                  className={`relative rounded-lg border p-4 text-left transition ${selectedAgent.id === agent.id ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                >
                  {index < agents.length - 1 && <span className="absolute -right-3 top-1/2 hidden h-px w-6 bg-slate-300 md:block" />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">
                      {iconForAgent(agent.id)}
                    </div>
                    <Badge variant={variantForStatus(agent.status)}>{labelForStatus(agent.status)}</Badge>
                  </div>
                  <b className="mt-3 block text-sm text-slate-950">{agent.name}</b>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{agent.detail}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{agent.tool}</span>
                    <span>{agent.latencyMs ? `${agent.latencyMs}ms` : "排队"}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-600" />
              节点详情
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{selectedAgent.owner}</Badge>
                <Badge variant={variantForStatus(selectedAgent.status)}>{labelForStatus(selectedAgent.status)}</Badge>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">{selectedAgent.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedAgent.detail}</p>
            </div>
            <div className="grid gap-2 text-sm">
              <Row label="工具" value={selectedAgent.tool} />
              <Row label="输入" value={inputForAgent(selectedAgent.id)} />
              <Row label="输出" value={outputForAgent(selectedAgent.id)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline">查看 Prompt</Button>
              <Button size="sm" variant="outline">重跑节点</Button>
              <Button size="sm" variant="outline">转人工审批</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>事件流</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px] pr-2">
              <div className="grid gap-2">
                {eventTemplates.map((event, index) => (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" key={event}>
                    <span className="mr-2 text-xs text-slate-400">T+{index * 8}s</span>
                    {event}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>人工审批与恢复动作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Action title="批准建表" text="允许生成 DWS/ADS 任务，进入 Flink SQL 校验。" icon={<Database className="h-4 w-4" />} />
            <Action title="压制误报" text="将实时告警送入离线校验队列，等待快照复算。" icon={<TimerReset className="h-4 w-4" />} />
            <Action title="派发处置" text="向市县班组输出告警摘要、用户画像和建议动作。" icon={<Wrench className="h-4 w-4" />} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p>
      <b className="mt-2 block text-2xl text-slate-950">{value}</b>
      <span className="mt-1 block text-xs text-slate-400">{hint}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-md bg-slate-50 p-2">
      <span className="w-12 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}

function Action({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <button className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-white">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-600 shadow-sm">{icon}</div>
      <b className="text-sm text-slate-950">{title}</b>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </button>
  );
}

function iconForAgent(id: string) {
  const className = "h-5 w-5";
  if (id === "intent") return <BrainCircuit className={className} />;
  if (id === "metadata") return <Database className={className} />;
  if (id === "sql_guard") return <ShieldCheck className={className} />;
  if (id === "stream_alert") return <Siren className={className} />;
  if (id === "batch_verify") return <TimerReset className={className} />;
  return <Wrench className={className} />;
}

function variantForStatus(status: AgentStatus) {
  if (status === "running") return "default";
  if (status === "waiting") return "outline";
  if (status === "done") return "secondary";
  return "secondary";
}

function labelForStatus(status: AgentStatus) {
  if (status === "running") return "运行中";
  if (status === "waiting") return "等待";
  if (status === "done") return "完成";
  return "就绪";
}

function inputForAgent(id: string) {
  if (id === "intent") return "用户自然语言、角色视角、历史对话记忆";
  if (id === "metadata") return "查询意图、表标签、字段描述、版本信息";
  if (id === "sql_guard") return "SQL 草案、权限规则、LIMIT 和敏感字段策略";
  if (id === "stream_alert") return "Flink CEP 事件流、TVF 窗口、实时宽表";
  if (id === "batch_verify") return "Fluss/Paimon 快照、离线基线、补采订正数据";
  return "告警摘要、用户画像、地市班组和 SLA";
}

function outputForAgent(id: string) {
  if (id === "intent") return "任务计划、澄清问题、是否需要新建宽表";
  if (id === "metadata") return "候选表、字段证据、血缘和置信度";
  if (id === "sql_guard") return "安全结论、可执行 SQL 或拦截原因";
  if (id === "stream_alert") return "实时告警、风险等级、趋势预测";
  if (id === "batch_verify") return "告警确认/撤回、离线接口表和修正记录";
  return "工单建议、派发目标和处置话术";
}
