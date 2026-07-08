import { useMemo, useState } from "react";
import { ClipboardCheck, Route, ShieldAlert, TimerReset } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

interface RiskItem {
  eventId: string;
  riskType: string;
  level: string;
  message: string;
  timestamp: string;
  city?: string;
  userName?: string;
  industry?: string;
}

type AlertStage = "new" | "ack" | "dispatch" | "offline_check";

export function AlertWorkbench({ risks, selectedCity }: { risks: RiskItem[]; selectedCity: string }) {
  const scopedRisks = risks.filter((risk) => risk.city === selectedCity);
  const [selectedId, setSelectedId] = useState(scopedRisks[0]?.eventId ?? "");
  const [stage, setStage] = useState<AlertStage>("new");
  const selectedRisk = useMemo(
    () => scopedRisks.find((risk) => risk.eventId === selectedId) ?? scopedRisks[0],
    [scopedRisks, selectedId]
  );

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-600" />
          告警处置工作台
        </CardTitle>
        <Badge variant="outline">{selectedCity}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <ScrollArea className="h-[300px] pr-2">
          <div className="grid gap-2">
            {scopedRisks.map((risk) => (
              <button
                className={`rounded-lg border p-3 text-left transition ${risk.eventId === selectedRisk?.eventId ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
                key={risk.eventId}
                onClick={() => {
                  setSelectedId(risk.eventId);
                  setStage("new");
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900">{risk.userName ?? risk.eventId}</span>
                  <Badge variant={risk.level === "critical" ? "destructive" : "secondary"}>{risk.level}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{risk.message}</p>
              </button>
            ))}
            {scopedRisks.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                当前下钻地市没有待处置告警。
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {selectedRisk ? (
            <div className="grid gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{selectedRisk.riskType}</Badge>
                  <Badge variant={selectedRisk.level === "critical" ? "destructive" : "secondary"}>{selectedRisk.level}</Badge>
                  <Badge variant="outline">{selectedRisk.industry ?? "未知行业"}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">{selectedRisk.userName ?? selectedRisk.eventId}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedRisk.message}</p>
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <Stage active={stage === "new"} icon={<ShieldAlert className="h-4 w-4" />} label="新告警" />
                <Stage active={stage === "ack"} icon={<ClipboardCheck className="h-4 w-4" />} label="已确认" />
                <Stage active={stage === "dispatch"} icon={<Route className="h-4 w-4" />} label="派发处置" />
                <Stage active={stage === "offline_check"} icon={<TimerReset className="h-4 w-4" />} label="离线校验" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setStage("ack")} variant={stage === "ack" ? "default" : "outline"}>确认告警</Button>
                <Button onClick={() => setStage("dispatch")} variant={stage === "dispatch" ? "default" : "outline"}>派发班组</Button>
                <Button onClick={() => setStage("offline_check")} variant={stage === "offline_check" ? "default" : "outline"}>加入离线校验</Button>
              </div>

              <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-600">
                {stage === "new" && "待确认：系统建议先核对近 15 分钟遥测、同台区用户曲线和档案容量。"}
                {stage === "ack" && "已确认：告警进入处置 SLA，AI 将持续跟踪实时流是否继续恶化。"}
                {stage === "dispatch" && "派发处置：建议通知属地运维班组，携带台区和用户画像进行现场核查。"}
                {stage === "offline_check" && "离线校验：夜间批任务会基于 Fluss/Paimon 快照复算该告警，必要时修正实时结果。"}
              </div>
            </div>
          ) : (
            <div className="grid min-h-[260px] place-items-center text-sm text-slate-500">选择一个地市告警查看处置详情。</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stage({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center text-xs ${active ? "border-blue-300 bg-white text-blue-700" : "border-slate-200 bg-white/70 text-slate-500"}`}>
      <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-slate-100">{icon}</div>
      {label}
    </div>
  );
}
