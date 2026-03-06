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
import type { LeadTimePeriodStats } from "@/types";
import { useI18n } from "@/lib/i18n";
import { formatPeriod } from "@/lib/i18n/format";

interface Props {
  data: LeadTimePeriodStats[];
}

export function LeadTimeChart({ data }: Props) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        {t.charts.noMergedPRData}
      </div>
    );
  }

  // Build chart data with sigma band as [minus_sigma, plus_sigma] for Area
  const chartData = data.map((item) => ({
    period: item.period,
    avg: item.avg_hours,
    sigma_band: [item.minus_sigma, item.plus_sigma] as [number, number],
    plus_sigma: item.plus_sigma,
    minus_sigma: item.minus_sigma,
    stddev: item.stddev_hours,
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
            tickFormatter={(v) => formatPeriod(v, "compact")}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: "currentColor" }}
            label={{
              value: t.charts.hours,
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
            labelFormatter={(label) => formatPeriod(label as string)}
            formatter={(value, name) => {
              if (name === "sigma_band") return null;
              if (name === "Avg") return [`${value}h`, name];
              if (name === "+\u03C3") return [`${value}h`, name];
              if (name === "-\u03C3") return [`${value}h`, name];
              return [value, name];
            }}
            itemSorter={() => 0}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="sigma_band"
            fill="#3b82f6"
            fillOpacity={0.1}
            stroke="none"
            name="sigma_band"
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="plus_sigma"
            stroke="#93c5fd"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            name="+&#963;"
          />
          <Line
            type="monotone"
            dataKey="minus_sigma"
            stroke="#93c5fd"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            name="-&#963;"
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", r: 3 }}
            name="Avg"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
