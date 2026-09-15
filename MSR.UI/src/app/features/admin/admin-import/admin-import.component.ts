import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AdminImportService } from '../../../core/services/admin-import.service';
import {
  ImportHistoryItem,
  ImportPreview,
  ImportResult,
  ImportRowResult
} from '../../../core/models/admin-import-models';

import { DashboardSectionComponent } from '../../../shared/components/dashboard-section/dashboard-section.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';

type ImportKey =
  | 'sprint-performance'
  | 'qa-performance'
  | 'qa-daily-delivery'
  | 'qa-user-story'
  | 'feature-release';

// A preview-table column definition (label + which row field to display).
interface PreviewColumn {
  label: string;
  field: keyof ImportRowResult;
}

// One import type on the page, with its own upload/validation/import state.
interface ImportSection {
  key: ImportKey;
  title: string;
  description: string;
  columns: PreviewColumn[];

  selectedFile: File | null;
  clientError: string | null;
  validating: boolean;
  importing: boolean;
  preview: ImportPreview | null;
  importResult: ImportResult | null;
}

@Component({
  selector: 'app-admin-import',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardSectionComponent, LoadingStateComponent],
  templateUrl: './admin-import.component.html',
  styleUrl: './admin-import.component.scss'
})
export class AdminImportComponent implements OnInit {
  private readonly service = inject(AdminImportService);

  readonly sections: ImportSection[] = [
    {
      key: 'sprint-performance',
      title: 'Sprint Performance',
      description:
        'Upload sprint performance data (velocity, capacity, rollovers) for development teams.',
      columns: [
        { label: 'Sprint', field: 'sprint' },
        { label: 'Team', field: 'team' },
        { label: 'Employee', field: 'employee' },
        { label: 'Product', field: 'product' }
      ],
      ...AdminImportComponent.initialState()
    },
    {
      key: 'qa-performance',
      title: 'QA Performance',
      description:
        'Upload QA performance data (capacity, points, rollovers). The product is read from the Excel Product column.',
      columns: [
        { label: 'Sprint', field: 'sprint' },
        { label: 'Name', field: 'employee' },
        { label: 'Product', field: 'product' }
      ],
      ...AdminImportComponent.initialState()
    },
    {
      key: 'qa-daily-delivery',
      title: 'QA Daily Delivery',
      description:
        'Upload QA daily delivery data. The product is read from the Excel Product column.',
      columns: [
        { label: 'Sprint', field: 'sprint' },
        { label: 'Day', field: 'day' },
        { label: 'Delivery', field: 'delivery' },
        { label: 'Product', field: 'product' }
      ],
      ...AdminImportComponent.initialState()
    },
    {
      key: 'qa-user-story',
      title: 'QA User Story',
      description:
        'Upload QA user story / work item data. The product is read from the Excel Product column.',
      columns: [
        { label: 'Sprint', field: 'sprint' },
        { label: 'Work Item ID', field: 'workItemId' },
        { label: 'Work Item Type', field: 'workItemType' },
        { label: 'Product', field: 'product' }
      ],
      ...AdminImportComponent.initialState()
    },
    {
      key: 'feature-release',
      title: 'Feature Release',
      description:
        'Upload feature release data (feature, planned/released sprint, delay reason). The product is read from the Excel Product column.',
      columns: [
        { label: 'Feature Description', field: 'featureDescription' },
        { label: 'Planned Sprint', field: 'plannedSprint' },
        { label: 'Released Sprint', field: 'releasedSprint' },
        { label: 'Product', field: 'product' }
      ],
      ...AdminImportComponent.initialState()
    }
  ];

  // ---- Import history ----
  historyLoading = false;
  history: ImportHistoryItem[] = [];

  ngOnInit(): void {
    this.loadHistory();
  }

  onFileSelected(section: ImportSection, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.resetSection(section);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      section.clientError = 'Invalid file. Please upload a valid Excel (.xlsx) file.';
      section.selectedFile = null;
      input.value = '';
      return;
    }

    section.selectedFile = file;
  }

  validate(section: ImportSection): void {
    if (!section.selectedFile || section.validating) {
      return;
    }

    section.validating = true;
    section.preview = null;
    section.importResult = null;

    this.service
      .validate(section.key, section.selectedFile)
      .pipe(
        catchError(err => {
          const body = err?.error as ImportPreview | undefined;
          if (body) {
            return of(body);
          }
          section.clientError =
            'Validation failed. Please check the API is running and try again.';
          return of(null);
        }),
        finalize(() => (section.validating = false))
      )
      .subscribe(result => {
        if (result) {
          section.preview = result;
        }
      });
  }

  import(section: ImportSection): void {
    if (!section.selectedFile || !this.canImport(section) || section.importing) {
      return;
    }

    section.importing = true;

    this.service
      .import(section.key, section.selectedFile)
      .pipe(
        catchError(err => {
          const body = err?.error as ImportResult | undefined;
          if (body) {
            return of(body);
          }
          section.clientError =
            'Import failed. Please check the API is running and try again.';
          return of(null);
        }),
        finalize(() => (section.importing = false))
      )
      .subscribe(result => {
        if (result) {
          section.importResult = result;
          section.preview = null;
          this.loadHistory();
        }
      });
  }

  resetSection(section: ImportSection): void {
    section.clientError = null;
    section.preview = null;
    section.importResult = null;
  }

  clearSelection(section: ImportSection, fileInput: HTMLInputElement): void {
    section.selectedFile = null;
    fileInput.value = '';
    this.resetSection(section);
  }

  loadHistory(): void {
    this.historyLoading = true;
    this.service
      .getHistory()
      .pipe(
        catchError(() => of([] as ImportHistoryItem[])),
        finalize(() => (this.historyLoading = false))
      )
      .subscribe(items => (this.history = items));
  }

  canImport(section: ImportSection): boolean {
    return (
      !!section.preview &&
      section.preview.fileErrors.length === 0 &&
      section.preview.invalidRows === 0 &&
      section.preview.newRows > 0
    );
  }

  cellValue(row: ImportRowResult, field: keyof ImportRowResult): string {
    const value = row[field];
    return value === null || value === undefined ? '' : String(value);
  }

  private static initialState(): Pick<
    ImportSection,
    'selectedFile' | 'clientError' | 'validating' | 'importing' | 'preview' | 'importResult'
  > {
    return {
      selectedFile: null,
      clientError: null,
      validating: false,
      importing: false,
      preview: null,
      importResult: null
    };
  }
}
