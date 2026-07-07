import { useState } from "react";
import { Activity, Database, RadioTower } from "lucide-react";
import { postJson } from "../lib/api";
import { MetricCard } from "../components/MetricCard";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export function SimulatorPage() {
  const [userCount, setUserCount] = useState(500);
  const [result, setResult] = useState<{ users: unknown[]; readings: unknown[]; risks: unknown[] } | null>(null);
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>模拟数据与压测中心</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="grid max-w-xs gap-2 text-sm font-medium text-slate-700">
          用户规模
          <Input type="number" value={userCount} onChange={(event) => setUserCount(Number(event.target.value))} />
        </label>
        <Button className="w-fit" onClick={() => void postJson<typeof result>("/simulator/snapshot", { seed: 9, userCount, readingMinutes: 12 }).then(setResult)}>
          生成模拟场景
        </Button>
        {result && (
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard icon={Database} label="模拟用户" value={String(result.users.length)} hint="档案与标签" tone="blue" />
            <MetricCard icon={RadioTower} label="遥测点" value={String(result.readings.length)} hint="分钟级负荷流" tone="emerald" />
            <MetricCard icon={Activity} label="风险事件" value={String(result.risks.length)} hint="CEP 与阈值场景" tone="rose" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
