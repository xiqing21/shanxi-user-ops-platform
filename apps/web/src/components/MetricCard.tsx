import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { cn } from "../lib/cn";

export function MetricCard({ label, value, hint, icon: Icon, tone = "blue" }: { label: string; value: string; hint: string; icon: LucideIcon; tone?: "blue" | "amber" | "emerald" | "rose" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100"
  };
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">{label}</div>
            <strong className="mt-2 block text-2xl font-semibold tracking-tight text-slate-950">{value}</strong>
          </div>
          <div className={cn("rounded-md p-2 ring-1", tones[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}
