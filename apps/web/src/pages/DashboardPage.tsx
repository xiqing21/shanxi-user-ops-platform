import { useEffect, useState } from "react";
import { AlertCircle, Factory, Users, Zap } from "lucide-react";
import { LoadTrendChart } from "../components/charts/LoadTrendChart";
import { MetricCard } from "../components/MetricCard";
import { RiskQueue } from "../components/RiskQueue";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getJson } from "../lib/api";
import { formatNumber } from "../lib/format";

interface Summary {
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
}

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [risks, setRisks] = useState<RiskItem[]>([]);

  useEffect(() => {
    void getJson<Summary>("/operations/summary").then(setSummary);
    void getJson<RiskItem[]>("/operations/risks").then(setRisks);
  }, []);

  if (!summary) return <div className="rounded-lg border bg-white p-6 text-slate-500 shadow-sm">加载全省态势...</div>;

  return (
    <div className="grid gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">山西省全量用户</Badge>
            <Badge variant="outline">实时 + 离线校准</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">实时智能运营态势</h2>
          <p className="mt-2 text-sm text-slate-500">覆盖居民、一般工商业、大工业、高耗能、农业、充电站、分布式光伏等用户。</p>
        </div>
        <span className="text-sm text-slate-500">数据时间 {summary.generatedAt}</span>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="全量用户" value={formatNumber(summary.totalUsers)} hint="档案与计量点关系已生成" tone="blue" />
        <MetricCard icon={Zap} label="当前负荷 kW" value={formatNumber(summary.totalLoadKw)} hint="模拟实时遥测汇总" tone="emerald" />
        <MetricCard icon={Factory} label="大工业用户" value={formatNumber(summary.largeIndustrialUsers)} hint="重点风险分析对象" tone="amber" />
        <MetricCard icon={AlertCircle} label="实时风险" value={formatNumber(summary.activeRisks)} hint={`${summary.criticalRisks} 条严重风险`} tone="rose" />
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

          <Card className="border-slate-200/80 bg-white/90 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>山西一张图风险热力</CardTitle>
              <Badge variant="outline">地市穿透</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid min-h-[280px] place-items-center rounded-lg border border-blue-100 bg-[radial-gradient(circle_at_30%_20%,#dbeafe,transparent_30%),linear-gradient(135deg,#f8fafc,#eff6ff)] p-6">
                <div className="grid w-full max-w-3xl grid-cols-2 gap-3 text-sm font-medium text-blue-900 md:grid-cols-4">
                  {["太原", "大同", "长治", "运城", "临汾", "吕梁", "晋中", "忻州"].map((city, index) => (
                    <div className="rounded-lg border border-white/80 bg-white/70 p-4 shadow-sm" key={city}>
                      <div className="text-lg font-semibold">{city}</div>
                      <div className="mt-2 text-xs text-slate-500">风险指数 {82 - index * 5}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <RiskQueue risks={risks} />
      </section>
    </div>
  );
}
