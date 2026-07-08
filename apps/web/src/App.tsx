import { useState } from "react";
import { Shell } from "./components/Shell";
import { AgentTaskPage } from "./pages/AgentTaskPage";
import { AgentOrchestrationPage } from "./pages/AgentOrchestrationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IndustrialPage } from "./pages/IndustrialPage";
import { RuntimeTopologyPage } from "./pages/RuntimeTopologyPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { TextToSqlPage } from "./pages/TextToSqlPage";
import { defaultRole, type RoleView } from "./lib/roles";

export function App() {
  const [role, setRole] = useState<RoleView>(defaultRole);
  const [active, setActive] = useState(defaultRole.defaultTab);

  function changeRole(nextRole: RoleView) {
    setRole(nextRole);
    setActive(nextRole.defaultTab);
  }

  const page = active === "大工业分析"
    ? <IndustrialPage role={role} />
    : active === "AI 问数"
      ? <TextToSqlPage role={role} />
      : active === "AI 建任务"
        ? <AgentTaskPage role={role} />
        : active === "多Agent编排"
          ? <AgentOrchestrationPage role={role} />
          : active === "模拟压测"
            ? <SimulatorPage />
            : active === "运行拓扑"
              ? <RuntimeTopologyPage role={role} />
              : <DashboardPage role={role} />;
  return <Shell active={active} role={role} onRole={changeRole} onTab={setActive}>{page}</Shell>;
}
