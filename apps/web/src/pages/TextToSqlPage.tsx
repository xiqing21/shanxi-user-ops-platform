import { useState } from "react";
import { ShieldCheck, Table2 } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import type { RoleView } from "../lib/roles";

export function TextToSqlPage({ role }: { role: RoleView }) {
  const [query, setQuery] = useState(role.defaultTextToSqlQuery);
  const sql = "SELECT city, industry, user_id, MAX(active_power_kw) AS peak_kw\nFROM ads_realtime_user_load\nWHERE city = '太原'\nGROUP BY city, industry, user_id\nLIMIT 100;";
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI 问数 Text-to-SQL
          <Badge variant="outline">{role.shortName}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Textarea value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="grid gap-3 md:grid-cols-3">
          <Evidence icon={<Table2 className="h-4 w-4" />} title="命中表" text="ads_realtime_user_load" />
          <Evidence icon={<Table2 className="h-4 w-4" />} title="命中字段" text="city, industry, user_id, active_power_kw" />
          <Evidence icon={<ShieldCheck className="h-4 w-4" />} title="安全校验" text="只读 SELECT，LIMIT 100" />
        </div>
        <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-emerald-100">{sql}</pre>
      </CardContent>
    </Card>
  );
}

function Evidence({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
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
