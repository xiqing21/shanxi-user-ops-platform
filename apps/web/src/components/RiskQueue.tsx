import { AlertTriangle, Zap } from "lucide-react";
import { Badge } from "./ui/badge";
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

export function RiskQueue({ risks, title = "实时风险队列" }: { risks: RiskItem[]; title?: string }) {
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {title}
        </CardTitle>
        <Badge variant="outline">{risks.length} 条</Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[326px] pr-2">
          <div className="grid gap-2">
            {risks.map((risk) => (
              <article className="rounded-lg border border-slate-200 bg-slate-50/80 p-3" key={risk.eventId}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Zap className="h-3.5 w-3.5 text-blue-600" />
                    {risk.riskType}
                  </span>
                  <Badge variant={risk.level === "critical" ? "destructive" : "secondary"}>{risk.level}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{risk.message}</p>
                {(risk.city || risk.userName) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {risk.city && <Badge variant="outline">{risk.city}</Badge>}
                    {risk.userName && <Badge variant="outline">{risk.userName}</Badge>}
                    {risk.industry && <Badge variant="outline">{risk.industry}</Badge>}
                  </div>
                )}
                <time className="mt-2 block text-xs text-slate-400">{risk.timestamp.slice(11, 19)}</time>
              </article>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
