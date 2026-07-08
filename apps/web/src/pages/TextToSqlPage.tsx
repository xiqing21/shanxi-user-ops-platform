import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Database, ShieldCheck, Table2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { postJson } from "../lib/api";
import { formatNumber } from "../lib/format";
import type { RoleView } from "../lib/roles";

type ResultView = "table" | "cityChart" | "industryChart";

interface QueryRow {
  userId: string;
  userName: string;
  city: string;
  county: string;
  industry: string;
  userType: string;
  activePowerKw: number;
  loadRate: number;
  riskLevel: string;
}

interface ChartPoint {
  name: string;
  loadKw: number;
  users: number;
}

interface TextToSqlResult {
  query: string;
  generatedAt: string;
  sql: string;
  evidence: Array<{ title: string; text: string }>;
  rows: QueryRow[];
  charts: {
    cityLoad: ChartPoint[];
    industryLoad: ChartPoint[];
  };
}

export function TextToSqlPage({ role }: { role: RoleView }) {
  const [query, setQuery] = useState(role.defaultTextToSqlQuery);
  const [result, setResult] = useState<TextToSqlResult | null>(null);
  const [view, setView] = useState<ResultView>("table");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextResult = await postJson<TextToSqlResult>("/text-to-sql/query", { query });
      setResult(nextResult);
      setView("table");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Text-to-SQL 查询失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI 问数 Text-to-SQL
          <Badge variant="outline">{role.shortName}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <Textarea className="min-h-28" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={loading} onClick={() => void runQuery()}>
              <Database className="mr-2 h-4 w-4" />
              {loading ? "生成中..." : "生成 SQL 并出数"}
            </Button>
            <Button disabled={!result} onClick={() => setView("table")} variant={view === "table" ? "default" : "outline"}>
              <Table2 className="mr-2 h-4 w-4" />
              表格
            </Button>
            <Button disabled={!result} onClick={() => setView("cityChart")} variant={view === "cityChart" ? "default" : "outline"}>
              <BarChart3 className="mr-2 h-4 w-4" />
              地市负荷图
            </Button>
            <Button disabled={!result} onClick={() => setView("industryChart")} variant={view === "industryChart" ? "default" : "outline"}>
              <BarChart3 className="mr-2 h-4 w-4" />
              行业负荷图
            </Button>
          </div>
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {(result?.evidence ?? [
            { title: "命中表", text: "等待执行后返回真实表证据" },
            { title: "命中字段", text: "等待执行后返回字段与过滤条件" },
            { title: "安全校验", text: "只读 SELECT、LIMIT、角色视角" }
          ]).map((item, index) => (
            <Evidence
              icon={index === 2 ? <ShieldCheck className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
              key={`${item.title}-${item.text}`}
              title={item.title}
              text={item.text}
            />
          ))}
        </div>

        <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-emerald-100">
          {result?.sql ?? "点击“生成 SQL 并出数”后，这里会展示后端生成并通过安全校验的 SQL。"}
        </pre>

        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
            <div>
              <b className="text-sm text-slate-950">查询结果</b>
              <p className="mt-1 text-xs text-slate-500">
                {result ? `数据时间 ${result.generatedAt}，返回 ${result.rows.length} 条` : "还没有执行查询"}
              </p>
            </div>
            {result && <Badge variant="secondary">来自当前模拟快照</Badge>}
          </div>
          <div className="p-3">
            {!result ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                输入自然语言后点击生成，会返回 SQL、明细行和可切换图表。
              </div>
            ) : view === "table" ? (
              <ResultTable rows={result.rows} />
            ) : (
              <LoadChart data={view === "cityChart" ? result.charts.cityLoad : result.charts.industryLoad} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Evidence({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
        {icon}
        {title}
      </div>
      <Badge variant="outline" className="whitespace-normal text-left">{text}</Badge>
    </div>
  );
}

function ResultTable({ rows }: { rows: QueryRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>用户</TableHead>
          <TableHead>地市/区县</TableHead>
          <TableHead>行业</TableHead>
          <TableHead>用户类型</TableHead>
          <TableHead className="text-right">当前负荷 kW</TableHead>
          <TableHead className="text-right">负载率</TableHead>
          <TableHead>风险</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.userId}>
            <TableCell>
              <b className="block text-slate-950">{row.userName}</b>
              <span className="text-xs text-slate-400">{row.userId}</span>
            </TableCell>
            <TableCell>{row.city} / {row.county}</TableCell>
            <TableCell>{row.industry}</TableCell>
            <TableCell>{row.userType}</TableCell>
            <TableCell className="text-right">{formatNumber(row.activePowerKw)}</TableCell>
            <TableCell className="text-right">{row.loadRate}%</TableCell>
            <TableCell>
              <Badge variant={row.riskLevel === "critical" ? "destructive" : "secondary"}>{row.riskLevel}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LoadChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">当前查询没有可绘制的数据。</div>;
  return (
    <div className="h-[340px]">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value, name) => [formatNumber(Number(value)), name === "loadKw" ? "负荷 kW" : "用户数"]} />
          <Bar dataKey="loadKw" fill="#2563eb" name="负荷 kW" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
