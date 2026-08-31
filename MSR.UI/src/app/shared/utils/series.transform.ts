// ============================================================
// Helpers to reshape flat backend rows into chart-ready series.
// ============================================================

export interface Series {
  name: string;
  data: (number | null)[];
}

/**
 * Pivot flat rows into grouped-bar series.
 * categories = distinct group labels (e.g. team names),
 * one series per sprint number.
 */
export function pivotByGroupAndSprint<T extends { sprintNumber: number }>(
  rows: T[],
  groupKey: (r: T) => string,
  valueKey: (r: T) => number
): { categories: string[]; series: Series[] } {
  const groups = Array.from(new Set(rows.map(groupKey)));
  const sprints = Array.from(new Set(rows.map(r => r.sprintNumber))).sort((a, b) => a - b);

  const lookup = new Map<string, number>();
  for (const r of rows) {
    lookup.set(`${groupKey(r)}|${r.sprintNumber}`, valueKey(r));
  }

  const series: Series[] = sprints.map(sp => ({
    name: `Sprint ${sp}`,
    data: groups.map(g => {
      const v = lookup.get(`${g}|${sp}`);
      return v === undefined ? null : v;
    })
  }));

  return { categories: groups, series };
}

/**
 * Aggregate a single value per label across the range (average),
 * used for horizontal resource charts.
 */
export function averageByLabel<T>(
  rows: T[],
  labelKey: (r: T) => string,
  valueKey: (r: T) => number
): { categories: string[]; data: number[] } {
  const sums = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const label = labelKey(r);
    const entry = sums.get(label) ?? { total: 0, count: 0 };
    entry.total += valueKey(r);
    entry.count += 1;
    sums.set(label, entry);
  }
  const categories = Array.from(sums.keys());
  const data = categories.map(c => {
    const e = sums.get(c)!;
    return Math.round((e.total / e.count) * 10) / 10;
  });
  return { categories, data };
}

/**
 * Build a simple sprint-ordered line series from flat rows.
 */
export function lineBySprint<T extends { sprintNumber: number }>(
  rows: T[],
  valueKey: (r: T) => number
): { categories: number[]; data: number[] } {
  const sorted = [...rows].sort((a, b) => a.sprintNumber - b.sprintNumber);
  return {
    categories: sorted.map(r => r.sprintNumber),
    data: sorted.map(valueKey)
  };
}

/** Distinct, sprint-ordered sprint numbers present in the rows. */
export function distinctSprints<T extends { sprintNumber: number }>(rows: T[]): number[] {
  return Array.from(new Set(rows.map(r => r.sprintNumber))).sort((a, b) => a - b);
}

/**
 * Multi-series line across sprints: one series per group (e.g. team),
 * aligned to a shared sprint axis. Missing points become null.
 */
export function multiSeriesBySprint<T extends { sprintNumber: number }>(
  rows: T[],
  groupKey: (r: T) => string,
  valueKey: (r: T) => number
): { sprints: number[]; series: Series[] } {
  const sprints = distinctSprints(rows);
  const groups = Array.from(new Set(rows.map(groupKey)));
  const lookup = new Map<string, number>();
  for (const r of rows) {
    lookup.set(`${groupKey(r)}|${r.sprintNumber}`, valueKey(r));
  }
  const series: Series[] = groups.map(g => ({
    name: g,
    data: sprints.map(sp => {
      const v = lookup.get(`${g}|${sp}`);
      return v === undefined ? null : v;
    })
  }));
  return { sprints, series };
}

/**
 * Split flat rows into per-group panels (small multiples). For each distinct
 * group (team / employee) returns the shared sprint axis and one series per
 * metric, aligned to that axis.
 */
export function panelsByGroup<T extends { sprintNumber: number }>(
  rows: T[],
  groupKey: (r: T) => string,
  metrics: { name: string; value: (r: T) => number }[]
): { group: string; sprints: number[]; series: Series[] }[] {
  const groups = Array.from(new Set(rows.map(groupKey)));
  return groups.map(g => {
    const gRows = rows.filter(r => groupKey(r) === g);
    const sprints = distinctSprints(gRows);
    const series: Series[] = metrics.map(m => ({
      name: m.name,
      data: sprints.map(sp => {
        const row = gRows.find(r => r.sprintNumber === sp);
        return row ? m.value(row) : null;
      })
    }));
    return { group: g, sprints, series };
  });
}

/**
 * Pivot flat rows into stacked-bar series: one row-category per group
 * (e.g. employee) and one series per sprint. Missing values become 0 so the
 * stacked segments align. Preserves each sprint's actual value (no averaging).
 */
export function stackBySprint<T extends { sprintNumber: number }>(
  rows: T[],
  groupKey: (r: T) => string,
  valueKey: (r: T) => number
): { categories: string[]; series: Series[] } {
  const groups = Array.from(new Set(rows.map(groupKey)));
  const sprints = distinctSprints(rows);
  const lookup = new Map<string, number>();
  for (const r of rows) {
    lookup.set(`${groupKey(r)}|${r.sprintNumber}`, valueKey(r));
  }
  const series: Series[] = sprints.map(sp => ({
    name: `Sprint ${sp}`,
    data: groups.map(g => lookup.get(`${g}|${sp}`) ?? 0)
  }));
  return { categories: groups, series };
}

/**
 * Pivot flat rows into a multi-series-by-day structure: shared day axis with
 * one series per sprint. Each sprint keeps its own daily values (no summing
 * or averaging across sprints). Missing points become null.
 */
export function multiSeriesByDay<T extends { sprintNumber: number; day: number }>(
  rows: T[],
  valueKey: (r: T) => number
): { days: number[]; series: Series[] } {
  const days = Array.from(new Set(rows.map(r => r.day))).sort((a, b) => a - b);
  const sprints = distinctSprints(rows);
  const lookup = new Map<string, number>();
  for (const r of rows) {
    lookup.set(`${r.sprintNumber}|${r.day}`, valueKey(r));
  }
  const series: Series[] = sprints.map(sp => ({
    name: `Sprint ${sp}`,
    data: days.map(d => {
      const v = lookup.get(`${sp}|${d}`);
      return v === undefined ? null : v;
    })
  }));
  return { days, series };
}

