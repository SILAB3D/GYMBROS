"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function PrHistoryChart({ data }: { data: Array<{ fecha: string; peso: number }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="fecha" stroke="#71717a" fontSize={12} />
          <YAxis stroke="#71717a" fontSize={12} unit=" kg" />
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 12 }}
          />
          <Line type="monotone" dataKey="peso" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
