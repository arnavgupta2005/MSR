import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AdminImportService } from '../../../core/services/admin-import.service';
import {
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
  | 'feature-release'
  | 'service-now-ticket';

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
export class AdminImportComponent {
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
    },
    {
      key: 'service-now-ticket',
      title: 'ServiceNow Tickets',
      description:
        'Upload ServiceNow ticket data (critical/web/mobile counts and completion percentage) per sprint.',
      columns: [
        { label: 'Sprint', field: 'sprint' },
        { label: 'CriticalWeb', field: 'criticalWeb' },
        { label: 'Web', field: 'web' },
        { label: 'CriticalMobile', field: 'criticalMobile' },
        { label: 'Mobile', field: 'mobile' },
        { label: 'CompletionPercentage', field: 'completionPercentage' }
      ],
      ...AdminImportComponent.initialState()
    }
  ];

  // Import types that offer a downloadable Excel template.
  private static readonly templateKeys: ReadonlySet<ImportKey> = new Set<ImportKey>([
    'sprint-performance',
    'qa-performance',
    'feature-release',
    'service-now-ticket'
  ]);

  hasTemplate(section: ImportSection): boolean {
    return AdminImportComponent.templateKeys.has(section.key);
  }

  // QA Daily Delivery offers two variant templates (Intrics QA and InfoQuest QA).
  hasDeliveryTemplates(section: ImportSection): boolean {
    return section.key === 'qa-daily-delivery';
  }

  downloadTemplate(section: ImportSection): void {
    if (!this.hasTemplate(section)) {
      return;
    }

    const templateNames: Record<string, string> = {
      'sprint-performance': 'Sprint_Performance_Template.xlsx',
      'qa-performance': 'QA_Performance_Template.xlsx',
      'feature-release': 'Feature_Release_Template.xlsx',
      'service-now-ticket': 'ServiceNow_Tickets_Template.xlsx'
    };
    const fileName = templateNames[section.key];

    this.service
      .downloadTemplate(section.key)
      .pipe(
        catchError(() => {
          section.clientError =
            'Could not download the template. Please check the API is running and try again.';
          return of(null);
        })
      )
      .subscribe(blob => this.saveBlob(blob, fileName));
  }

  // Download one of the QA Daily Delivery variant templates.
  downloadDeliveryTemplate(section: ImportSection, variant: 'intrics' | 'infoquest'): void {
    const fileName =
      variant === 'intrics'
        ? 'Intrics_QA_Daily_Delivery_Template.xlsx'
        : 'InfoQuest_QA_Daily_Delivery_Template.xlsx';

    this.service
      .downloadTemplateVariant(`qa-daily-delivery/template/${variant}`)
      .pipe(
        catchError(() => {
          section.clientError =
            'Could not download the template. Please check the API is running and try again.';
          return of(null);
        })
      )
      .subscribe(blob => this.saveBlob(blob, fileName));
  }

  // Trigger a browser download for a downloaded template blob.
  private saveBlob(blob: Blob | null, fileName: string): void {
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
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
