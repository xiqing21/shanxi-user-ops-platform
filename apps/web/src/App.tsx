import { useState } from "react";
import { Shell } from "./components/Shell";
import { AgentTaskPage } from "./pages/AgentTaskPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IndustrialPage } from "./pages/IndustrialPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { TextToSqlPage } from "./pages/TextToSqlPage";

export function App() {
  const [active, setActive] = useState("全省态势");
  const page = active === "大工业分析"
    ? <IndustrialPage />
    : active === "AI 问数"
      ? <TextToSqlPage />
      : active === "AI 建任务"
        ? <AgentTaskPage />
        : active === "模拟压测"
          ? <SimulatorPage />
          : <DashboardPage />;
  return <Shell active={active} onTab={setActive}>{page}</Shell>;
}
