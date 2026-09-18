// ============================================================
// Admin Data Import models — mirror MSR.API DTOs (camelCase).
// ============================================================

export type ImportRowStatus = 'New' | 'Duplicate' | 'Invalid';

export interface ImportRowResult {
  rowNumber: number;
  status: ImportRowStatus;
  sprint: string | null;
  team: string | null;
  employee: string | null;
  product: string | null;
  day: string | null;
  delivery: string | null;
  workItemId: string | null;
  workItemType: string | null;
  featureDescription: string | null;
  plannedSprint: string | null;
  releasedSprint: string | null;
  errors: string[];
}

export interface ImportPreview {
  fileName: string;
  importType: string;
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  invalidRows: number;
  fileErrors: string[];
  rows: ImportRowResult[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  invalidRows: number;
  fileErrors: string[];
  rows: ImportRowResult[];
}
