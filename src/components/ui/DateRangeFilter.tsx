"use client";

import { useState, useCallback } from "react";

interface Props {
  onFilterChange: (startDate: string | null, endDate: string | null) => void;
  minDate?: string;
  maxDate?: string;
}

export function DateRangeFilter({ onFilterChange, minDate, maxDate }: Props) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const handleStartChange = useCallback(
    (value: string) => {
      setStartDate(value);
      onFilterChange(value || null, endDate || null);
    },
    [endDate, onFilterChange]
  );

  const handleEndChange = useCallback(
    (value: string) => {
      setEndDate(value);
      onFilterChange(startDate || null, value || null);
    },
    [startDate, onFilterChange]
  );

  const handleReset = useCallback(() => {
    setStartDate("");
    setEndDate("");
    onFilterChange(null, null);
  }, [onFilterChange]);

  const handlePreset = useCallback(
    (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      setStartDate(startStr);
      setEndDate(endStr);
      onFilterChange(startStr, endStr);
    },
    [onFilterChange]
  );

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleStartChange(e.target.value)}
          min={minDate}
          max={endDate || maxDate}
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleEndChange(e.target.value)}
          min={startDate || minDate}
          max={maxDate}
          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Reset
        </button>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-sm text-gray-500 dark:text-gray-400">Quick:</span>
        <button
          onClick={() => handlePreset(7)}
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          7d
        </button>
        <button
          onClick={() => handlePreset(30)}
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          30d
        </button>
        <button
          onClick={() => handlePreset(90)}
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          90d
        </button>
      </div>
    </div>
  );
}
