import { useEffect, useState } from "react";
import { AlertCircle, Factory, Users, Zap } from "lucide-react";
import { AlertWorkbench } from "../components/AlertWorkbench";
import { LoadTrendChart } from "../components/charts/LoadTrendChart";
import { MetricCard } from "../components/MetricCard";
import { RiskQueue } from "../components/RiskQueue";
import { ShanxiDrilldownMap } from "../components/ShanxiDrilldownMap";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getJson } from "../lib/api";
import { formatNumber } from "../lib/format";
import type { RoleView } from "../lib/roles";

interface Summary {
  dataSource?: "starrocks_internal" | "fixture_fallback";
  generatedAt: string;
  totalUsers: number;
  totalLoadKw: number;
  largeIndustrialUsers: number;
  activeRisks: number;
  criticalRisks: number;
}

interface RiskItem {
  eventId: string;
  riskType: string;
  level: string;
  message: string;
  timestamp: string;
  city?: string;
  county?: string;
  userType?: string;
  userName?: string;
  industry?: string;
}

export function DashboardPage({ role }: { role: RoleView }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [selectedCity, setSelectedCity] = useState(role.cities[0] ?? "太原");

  useEffect(() => {
    void getJson<Summary>("/operations/summary").then(setSummary);
    void getJson<RiskItem[]>("/operations/risks").then(setRisks);
  }, []);

  useEffect(() => {
    setSelectedCity(role.cities[0] ?? "太原");
  }, [role]);

  if (!summary) return <div className="rounded-lg border bg-white p-6 text-slate-500 shadow-sm">加载全省态势...</div>;

  const visibleRisks = filterRisksByRole(risks, role);
  const criticalRisks = visibleRisks.filter((risk) => risk.level === "critical").length;

  return (
    <div className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{role.scopeLabel}</Badge>
            <Badge variant="outline">实时 + 离线校准</Badge>
            <Badge variant="outline">{role.shortName}视角</Badge>
            <Badge variant={summary.dataSource === "starrocks_internal" ? "secondary" : "outline"}>
              {summary.dataSource === "starrocks_internal" ? "StarRocks 内表" : "fixture fallback"}
            </Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{role.scopeLabel}实时智能运营态势</h2>
          <p className="mt-2 text-sm text-slate-500">{role.operatingHint}</p>
        </div>
        <span className="text-sm text-slate-500">数据时间 {summary.generatedAt}</span>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="全量用户" value={formatNumber(summary.totalUsers)} hint="档案与计量点关系已生成" tone="blue" />
        <MetricCard icon={Zap} label="当前负荷 kW" value={formatNumber(summary.totalLoadKw)} hint="模拟实时遥测汇总" tone="emerald" />
        <MetricCard icon={Factory} label="大工业用户" value={formatNumber(summary.largeIndustrialUsers)} hint="重点风险分析对象" tone="amber" />
        <MetricCard icon={AlertCircle} label="当前视角风险" value={formatNumber(visibleRisks.length)} hint={`${criticalRisks} 条严重风险`} tone="rose" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.8fr]">
        <div className="grid gap-5">
          <Card className="border-slate-200/80 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>今日 / 昨日 / 预测负荷曲线</CardTitle>
            </CardHeader>
            <CardContent>
              <LoadTrendChart />
            </CardContent>
          </Card>

          <ShanxiDrilldownMap role={role} risks={visibleRisks} selectedCity={selectedCity} onSelectCity={setSelectedCity} />
        </div>

        <RiskQueue risks={visibleRisks} title={`${role.shortName}告警队列`} />
      </section>

      <AlertWorkbench risks={visibleRisks} selectedCity={selectedCity} />
    </div>
  );
}

function filterRisksByRole(risks: RiskItem[], role: RoleView) {
  if (role.riskFilter === "city") return risks.filter((risk) => risk.city === "太原");
  if (role.riskFilter === "industrial") {
    return risks.filter((risk) => risk.userType === "large_industrial" || risk.userType === "high_energy");
  }
  if (role.riskFilter === "ai") return risks.filter((risk) => risk.level === "critical" || risk.riskType === "voltage_anomaly");
  return risks;
}
