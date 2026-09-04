"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * A table cell that turns into a picker when clicked.
 *
 * It shows what is stored until GitHub has accepted a change, so a
 * refused edit leaves the truth on screen rather than a value that only
 * exists in the browser. While a write is in flight the cell is dimmed
 * and locked rather than optimistically updated.
 */
interface Props {
  /** What the cell reads when it is not being edited. */
  children: React.ReactNode;
  /** Options offered; an empty list makes the cell read-only. */
  options: string[];
  /** The currently stored value, matched against the options. */
  value: string | null;
  /** Whether the empty choice is offered. */
  clearable?: boolean;
  /** Why this cell cannot be edited, shown on hover. */
  disabledReason?: string;
  onChange: (next: string | null) => Promise<void>;
}

export function EditableCell({
  children,
  options,
  value,
  clearable = true,
  disabledReason,
  onChange,
}: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Opening on click means the picker is not yet on screen when the
  // click lands, so focus is taken once it is.
  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  if (disabledReason) {
    return (
      <span title={disabledReason} className="cursor-not-allowed">
        {children}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={saving}
        title={t.dependencies.clickToEdit}
        className="-mx-1 rounded px-1 text-left hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
      >
        {children}
      </button>
    );
  }

  const commit = async (next: string | null) => {
    setEditing(false);
    if (next === value) return;
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      ref={selectRef}
      value={value ?? ""}
      onChange={(e) => void commit(e.target.value || null)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
    >
      {clearable && <option value="">—</option>}
      {/* A stored value the board no longer offers is still listed, so
          the cell can show it without silently proposing to drop it. */}
      {value && !options.includes(value) && (
        <option value={value}>{value}</option>
      )}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/**
 * The assignee cell: a checklist rather than a single choice, because an
 * issue may have several and GitHub takes the whole set at once.
 */
export function AssigneeCell({
  assignees,
  candidates,
  disabledReason,
  onChange,
}: {
  assignees: string[];
  candidates: string[];
  disabledReason?: string;
  onChange: (next: string[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Closed by a press outside rather than by blur: ticking a name inside
  // the list blurs the trigger, which would shut it on the first pick.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label =
    assignees.length > 0 ? (
      assignees.join(", ")
    ) : (
      <span className="text-gray-400 dark:text-gray-600">—</span>
    );

  if (disabledReason) {
    return (
      <span title={disabledReason} className="cursor-not-allowed">
        {label}
      </span>
    );
  }

  const toggle = async (login: string) => {
    const next = assignees.includes(login)
      ? assignees.filter((a) => a !== login)
      : [...assignees, login];
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title={t.dependencies.clickToEdit}
        className="-mx-1 rounded px-1 text-left hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
      >
        {label}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 max-h-56 w-56 overflow-y-auto rounded border border-gray-300 bg-white px-2 py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {candidates.length === 0 ? (
            <p className="py-1 text-xs text-gray-500 dark:text-gray-400">
              {t.dependencies.noAssignableUsers}
            </p>
          ) : (
            candidates.map((login) => (
              <label
                key={login}
                className="flex cursor-pointer items-center gap-2 py-0.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={assignees.includes(login)}
                  onChange={() => void toggle(login)}
                />
                <span className="truncate">{login}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
