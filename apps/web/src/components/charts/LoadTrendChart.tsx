import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { time: "00:00", today: 1420, yesterday: 1380, forecast: 1460 },
  { time: "04:00", today: 1180, yesterday: 1210, forecast: 1240 },
  { time: "08:00", today: 1920, yesterday: 1840, forecast: 1960 },
  { time: "12:00", today: 2360, yesterday: 2290, forecast: 2410 },
  { time: "16:00", today: 2580, yesterday: 2470, forecast: 2630 },
  { time: "20:00", today: 3120, yesterday: 2980, forecast: 3280 },
  { time: "23:00", today: 2460, yesterday: 2380, forecast: 2510 }
];

export function LoadTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="today" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.38} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="forecast" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dbe3ef" }} />
        <Area type="monotone" dataKey="forecast" name="预测负荷" stroke="#f59e0b" fill="url(#forecast)" strokeWidth={2} />
        <Area type="monotone" dataKey="yesterday" name="昨日负荷" stroke="#94a3b8" fill="transparent" strokeWidth={2} />
        <Area type="monotone" dataKey="today" name="今日负荷" stroke="#2563eb" fill="url(#today)" strokeWidth={3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
