"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { LeadTimeForChanges } from "@/types";

interface Props {
  data: LeadTimeForChanges[];
}

export function LeadTimeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        No merged PR data available
      </div>
    );
  }

  const chartData = data.slice(0, 15).map((item) => ({
    name: `#${item.pr_number}`,
    hours: item.lead_time_hours,
    title: item.title,
  }));

  const getBarColor = (hours: number) => {
    if (hours < 24) return "#22c55e"; // green - less than 1 day
    if (hours < 72) return "#eab308"; // yellow - 1-3 days
    return "#ef4444"; // red - more than 3 days
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="name"
            className="text-xs"
            tick={{ fill: "currentColor" }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "currentColor" }}
            label={{
              value: "Hours",
              angle: -90,
              position: "insideLeft",
              style: { fill: "currentColor" },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--foreground)",
              borderRadius: "4px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value, _name, props) => [
              `${value} hours`,
              (props.payload as { title: string }).title.substring(0, 50),
            ]}
          />
          <Bar dataKey="hours" name="Lead Time" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.hours)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded" /> &lt; 24h
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-500 rounded" /> 24-72h
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded" /> &gt; 72h
        </span>
      </div>
    </div>
  );
}
