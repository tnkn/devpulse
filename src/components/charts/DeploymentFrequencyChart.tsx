"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DeploymentFrequency } from "@/types";
import { useI18n } from "@/lib/i18n";
import { formatPeriod } from "@/lib/i18n/format";

interface Props {
  data: DeploymentFrequency[];
}

export function DeploymentFrequencyChart({ data }: Props) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
        {t.charts.noDeploymentData}
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid var(--foreground)",
              borderRadius: "4px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
            labelFormatter={(label) => formatPeriod(label as string)}
          />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            name={t.charts.deployments}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
