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
 * Names picked most recently, newest first, per repository.
 *
 * A team assigns the same handful of people over and over, and on a
 * repository with hundreds of collaborators those few are otherwise
 * buried in an alphabetical list. Kept in localStorage because it is a
 * convenience for one person on one machine, not shared state.
 */
const RECENT_LIMIT = 5;

function recentKey(repoKey: string) {
  return `dev-vis:recent-assignees:${repoKey}`;
}

function readRecent(repoKey: string): string[] {
  try {
    const raw = localStorage.getItem(recentKey(repoKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    // A private window, cleared storage, or a browser refusing access:
    // the picker still works, it just has no memory.
    return [];
  }
}

function rememberRecent(repoKey: string, login: string): string[] {
  const next = [login, ...readRecent(repoKey).filter((l) => l !== login)].slice(
    0,
    RECENT_LIMIT,
  );
  try {
    localStorage.setItem(recentKey(repoKey), JSON.stringify(next));
  } catch {
    // Not being able to remember is not a reason to fail the edit.
  }
  return next;
}

/**
 * The assignee cell: a checklist rather than a single choice, because an
 * issue may have several and GitHub takes the whole set at once.
 */
export function AssigneeCell({
  repoKey,
  assignees,
  candidates,
  disabledReason,
  onChange,
}: {
  repoKey: string;
  assignees: string[];
  candidates: string[];
  disabledReason?: string;
  onChange: (next: string[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  // Read on open rather than on mount: the list is shared by every row,
  // so a pick in one cell has to be visible in the next one opened.
  useEffect(() => {
    if (open) setRecent(readRecent(repoKey));
  }, [open, repoKey]);

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
    const adding = !assignees.includes(login);
    const next = adding
      ? [...assignees, login]
      : assignees.filter((a) => a !== login);
    // Only assigning counts as "using" a name; unassigning someone is
    // not a reason to offer them first next time.
    if (adding) setRecent(rememberRecent(repoKey, login));
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  const filtered = candidates.filter((login) =>
    login.toLowerCase().includes(query.trim().toLowerCase()),
  );
  // Recent names are lifted to the top rather than duplicated, so a name
  // never appears twice and the count below still means what it says.
  const recentShown = recent.filter((login) => filtered.includes(login));
  const rest = filtered.filter((login) => !recentShown.includes(login));

  const row = (login: string) => (
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
  );

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
        <div className="absolute top-full left-0 z-30 mt-1 w-64 rounded border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {candidates.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
              {t.dependencies.noAssignableUsers}
            </p>
          ) : (
            <>
              <div className="border-b border-gray-200 p-1.5 dark:border-gray-700">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.dependencies.filterUsers}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                />
              </div>
              {/* Scrolls rather than truncates: every collaborator has to
                  be reachable, however many there are. */}
              <div className="max-h-64 overflow-y-auto px-2 py-1">
                {recentShown.length > 0 && (
                  <>
                    <p className="py-0.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                      {t.dependencies.recentlyUsed}
                    </p>
                    {recentShown.map(row)}
                    {rest.length > 0 && (
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    )}
                  </>
                )}
                {rest.map(row)}
                {filtered.length === 0 && (
                  <p className="py-1 text-xs text-gray-500 dark:text-gray-400">
                    {t.dependencies.noMatchingUsers}
                  </p>
                )}
              </div>
              <p className="border-t border-gray-200 px-2 py-1 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t.dependencies.userCount(filtered.length, candidates.length)}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
