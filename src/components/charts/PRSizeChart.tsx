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
  ReferenceLine,
} from "recharts";
import type { PRSize } from "@/types";

interface Props {
  data: PRSize[];
}

export function PRSizeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        No PR size data available (run Update to fetch)
      </div>
    );
  }

  const chartData = data.slice(0, 20).map((item) => ({
    name: `#${item.pr_number}`,
    loc: item.total_lines,
    title: item.title,
    additions: item.additions,
    deletions: item.deletions,
  }));

  const avgLoc =
    chartData.reduce((sum, item) => sum + item.loc, 0) / chartData.length;

  const getBarColor = (loc: number) => {
    if (loc < 200) return "#22c55e"; // green
    if (loc <= 500) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
              value: "LOC",
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
            formatter={(_value, _name, props) => {
              const p = props.payload as { title: string; additions: number; deletions: number; loc: number };
              return [
                `${p.loc} LOC (+${p.additions} -${p.deletions})`,
                p.title.substring(0, 50),
              ];
            }}
          />
          <ReferenceLine
            y={avgLoc}
            stroke="#8b5cf6"
            strokeDasharray="5 5"
            label={{
              value: `Avg: ${Math.round(avgLoc)} LOC`,
              position: "right",
              fill: "#8b5cf6",
              fontSize: 12,
            }}
          />
          <Bar dataKey="loc" name="LOC" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.loc)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded" /> &lt; 200
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-500 rounded" /> 200-500
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded" /> &gt; 500
        </span>
      </div>
    </div>
  );
}
