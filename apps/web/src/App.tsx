import { useState } from "react";
import { Shell } from "./components/Shell";
import { DashboardPage } from "./pages/DashboardPage";

export function App() {
  const [active, setActive] = useState("全省态势");
  return (
    <Shell active={active} onTab={setActive}>
      <DashboardPage />
    </Shell>
  );
}
