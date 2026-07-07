import { useState } from "react";
import { CheckCircle2, DatabaseZap } from "lucide-react";
import { postJson } from "../lib/api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";

interface Plan {
  intent: string;
  needsNewWideTable: boolean;
  clarifyingQuestion: string;
  candidateAssets: string[];
  generatedSql: string;
  steps: Array<{ kind: string; title: string; detail: string }>;
}

export function AgentTaskPage() {
  const [query, setQuery] = useState("分析近30天山西大工业用户晚高峰负荷突增，并按行业和地市排名");
  const [plan, setPlan] = useState<Plan | null>(null);
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="h-4 w-4 text-blue-600" />
          AI 建任务
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Textarea value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button className="w-fit" onClick={() => void postJson<Plan>("/agent/plan", { query }).then(setPlan)}>
          生成任务计划
        </Button>
        {plan && (
          <div className="grid gap-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{plan.intent}</Badge>
                <Badge variant={plan.needsNewWideTable ? "destructive" : "secondary"}>
                  {plan.needsNewWideTable ? "需要新建宽表" : "可直接查询"}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-blue-950">{plan.clarifyingQuestion}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {plan.steps.map((step) => (
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={step.kind}>
                  <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-600" />
                  <b className="block text-sm">{step.title}</b>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{step.detail}</span>
                </article>
              ))}
            </div>
            <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-emerald-100">{plan.generatedSql}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
