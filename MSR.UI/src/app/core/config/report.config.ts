// ============================================================
// Single source of truth for products, sprints and ranges.
// ============================================================

export type ReportType = 'development' | 'qa';

export interface ProductOption {
  id: number;
  name: string;
  type: ReportType;
}

export interface SprintOption {
  sprintNumber: number;
  label: string;
}

export interface SprintRangeOption {
  label: string;
  startSprint: number;
  endSprint: number;
}

// ---- Feature Release product (filters by ProductName string) ----
export interface FeatureProductOption {
  key: string;   // exact ProductName value sent to the API
  label: string;
}

// ---- Development products (ProductAreaId 1-4) ----
export const DEVELOPMENT_PRODUCTS: ProductOption[] = [
  { id: 1, name: 'Intrics Dev', type: 'development' },
  { id: 2, name: 'InfoQuest Web', type: 'development' },
  { id: 3, name: 'InfoQuest Mobile', type: 'development' },
  { id: 4, name: 'InfoQuest LMS', type: 'development' }
];

// ---- QA products (ProductAreaId 5-6) ----
export const QA_PRODUCTS: ProductOption[] = [
  { id: 5, name: 'Intrics QA', type: 'qa' },
  { id: 6, name: 'InfoQuest QA', type: 'qa' }
];

// ---- Feature Release products (exact ProductName values) ----
export const FEATURE_PRODUCTS: FeatureProductOption[] = [
  { key: 'Intrics', label: 'Intrics' },
  { key: 'InfoQuest', label: 'InfoQuest' }
];

// ---- Sprint options: Sprint 1 .. Sprint 25 ----
export const TOTAL_SPRINTS = 25;

export const SPRINT_OPTIONS: SprintOption[] = Array.from(
  { length: TOTAL_SPRINTS },
  (_, i) => ({ sprintNumber: i + 1, label: `Sprint ${i + 1}` })
);

// ---- Predefined performance ranges ----
export const SPRINT_RANGE_OPTIONS: SprintRangeOption[] = [
  { label: 'Sprint 1', startSprint: 1, endSprint: 1 },
  { label: 'Sprint 2 - 5', startSprint: 2, endSprint: 5 },
  { label: 'Sprint 6 - 9', startSprint: 6, endSprint: 9 },
  { label: 'Sprint 10 - 13', startSprint: 10, endSprint: 13 },
  { label: 'Sprint 14 - 17', startSprint: 14, endSprint: 17 },
  { label: 'Sprint 18 - 21', startSprint: 18, endSprint: 21 },
  { label: 'Sprint 22 - 25', startSprint: 22, endSprint: 25 }
];

// Default range shown on first load (matches reference images).
export const DEFAULT_SPRINT_RANGE = SPRINT_RANGE_OPTIONS[3]; // Sprint 10 - 13
