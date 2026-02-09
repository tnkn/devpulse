"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from "recharts";
import type { PeriodStats } from "@/types";

interface Props {
  data: PeriodStats[];
}

export function PRSizeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        No PR size data available
      </div>
    );
  }

  const chartData = data.map((item) => ({
    period: item.period,
    avg: item.avg,
    sigma_band: [item.minus_sigma, item.plus_sigma] as [number, number],
    plus_sigma: item.plus_sigma,
    minus_sigma: item.minus_sigma,
    stddev: item.stddev,
    count: item.count,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="period"
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
            formatter={(value, name) => {
              if (name === "sigma_band") return null;
              if (name === "Avg") return [`${value} LOC`, name];
              if (name === "+σ") return [`${value} LOC`, name];
              if (name === "-σ") return [`${value} LOC`, name];
              return [value, name];
            }}
            itemSorter={() => 0}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="sigma_band"
            fill="#22c55e"
            fillOpacity={0.1}
            stroke="none"
            name="sigma_band"
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="plus_sigma"
            stroke="#86efac"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            name="+σ"
          />
          <Line
            type="monotone"
            dataKey="minus_sigma"
            stroke="#86efac"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            name="-σ"
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: "#22c55e", r: 3 }}
            name="Avg"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
