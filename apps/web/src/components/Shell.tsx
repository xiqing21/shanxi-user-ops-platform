import { Activity, Bot, ChevronDown, DatabaseZap, Factory, Gauge, GitBranch, RadioTower } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";
import { roles, type RoleView } from "../lib/roles";

const tabs = [
  { label: "全省态势", icon: Gauge },
  { label: "大工业分析", icon: Factory },
  { label: "AI 问数", icon: Bot },
  { label: "AI 建任务", icon: DatabaseZap },
  { label: "多Agent编排", icon: GitBranch },
  { label: "模拟压测", icon: Activity }
];

export function Shell({
  active,
  role,
  onRole,
  onTab,
  children
}: {
  active: string;
  role: RoleView;
  onRole: (role: RoleView) => void;
  onTab: (tab: string) => void;
  children: React.ReactNode;
}) {
  const RoleIcon = role.icon;
  const visibleTabs = tabs.filter((tab) => role.visibleTabs.includes(tab.label));

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
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-medium text-slate-500">当前角色</label>
          <div className="relative mt-2">
            <select
              className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-900 outline-none focus:border-blue-500"
              onChange={(event) => {
                const nextRole = roles.find((item) => item.id === event.target.value);
                if (nextRole) onRole(nextRole);
              }}
              value={role.id}
            >
              {roles.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <RoleIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-blue-600" />
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{role.operatingHint}</p>
        </div>
        <nav className="mt-8 grid gap-2">
          {visibleTabs.map(({ label, icon: Icon }) => (
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
      <main className="min-h-screen p-4 lg:ml-64 lg:p-6">
        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
          <span className="text-sm font-medium">{role.shortName}</span>
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
            onChange={(event) => {
              const nextRole = roles.find((item) => item.id === event.target.value);
              if (nextRole) onRole(nextRole);
            }}
            value={role.id}
          >
            {roles.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        {children}
      </main>
    </div>
  );
}
