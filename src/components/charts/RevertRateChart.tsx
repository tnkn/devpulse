"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { RevertRate } from "@/types";
import { useI18n } from "@/lib/i18n";
import { formatPeriod } from "@/lib/i18n/format";

interface Props {
  data: RevertRate[];
}

export function RevertRateChart({ data }: Props) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        {t.charts.noCommitData}
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="period"
            className="text-xs"
            tick={{ fill: "currentColor" }}
            tickFormatter={(v) => formatPeriod(v, "compact")}
          />
          <YAxis
            yAxisId="left"
            className="text-xs"
            tick={{ fill: "currentColor" }}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            className="text-xs"
            tick={{ fill: "currentColor" }}
            domain={[0, "auto"]}
            tickFormatter={(value) => `${value}%`}
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
              if (name === t.charts.revertRate) return [`${value}%`, name];
              return [value, name];
            }}
          />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="revert_commits"
            fill="#f97316"
            name={t.charts.revertsLabel}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revert_rate"
            stroke="#ef4444"
            strokeWidth={2}
            name={t.charts.revertRate}
            dot={{ fill: "#ef4444" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
