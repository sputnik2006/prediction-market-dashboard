"use client";

import { Pill } from "./ui";

export interface SortOption {
  value: string;
  label: string;
}

/** Category pills + a sort dropdown, shared by the spotlight and the arb radar. */
export function PairFilterBar({
  category,
  onCategory,
  categories,
  sort,
  onSort,
  sortOptions,
}: {
  category: string;
  onCategory: (c: string) => void;
  categories: string[];
  sort: string;
  onSort: (s: string) => void;
  sortOptions: SortOption[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Pill active={category === ""} onClick={() => onCategory("")}>
          All
        </Pill>
        {categories.map((c) => (
          <Pill key={c} active={category === c} onClick={() => onCategory(c)}>
            {c}
          </Pill>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
        Sort
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg focus:border-fg-subtle/60 focus:outline-none"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Distinct categories present in a set of items (stable order), for the pills. */
export function distinctCategories<T extends { category: string }>(items: T[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    if (!seen.has(i.category)) {
      seen.add(i.category);
      out.push(i.category);
    }
  }
  return out.sort();
}
