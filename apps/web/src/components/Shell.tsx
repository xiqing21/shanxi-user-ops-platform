import { Activity, Bot, DatabaseZap, Factory, Gauge, RadioTower } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";

const tabs = [
  { label: "全省态势", icon: Gauge },
  { label: "大工业分析", icon: Factory },
  { label: "AI 问数", icon: Bot },
  { label: "AI 建任务", icon: DatabaseZap },
  { label: "模拟压测", icon: Activity }
];

export function Shell({ active, onTab, children }: { active: string; onTab: (tab: string) => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white/90 p-5 backdrop-blur lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white">
            <RadioTower className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold">山西用电运营</h1>
            <p className="text-xs text-slate-500">全量用户实时智能平台</p>
          </div>
        </div>
        <nav className="mt-8 grid gap-2">
          {tabs.map(({ label, icon: Icon }) => (
            <Button
              className={cn("justify-start gap-2", active === label && "bg-blue-600 text-white hover:bg-blue-600")}
              key={label}
              onClick={() => onTab(label)}
              variant={active === label ? "default" : "ghost"}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </nav>
      </aside>
      <main className="min-h-screen p-4 lg:ml-64 lg:p-6">{children}</main>
    </div>
  );
}
