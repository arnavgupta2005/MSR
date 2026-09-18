import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ImportPreview,
  ImportResult
} from '../models/admin-import-models';

@Injectable({ providedIn: 'root' })
export class AdminImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/import`;

  // Validate an Excel file for the given import type without saving anything.
  validate(importKey: string, file: File): Observable<ImportPreview> {
    return this.http.post<ImportPreview>(
      `${this.baseUrl}/${importKey}/validate`,
      this.toFormData(file)
    );
  }

  // Commit the new rows of an Excel file for the given import type.
  import(importKey: string, file: File): Observable<ImportResult> {
    return this.http.post<ImportResult>(
      `${this.baseUrl}/${importKey}`,
      this.toFormData(file)
    );
  }

  // Download a header-only Excel template for the given import type.
  downloadTemplate(importKey: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${importKey}/template`, {
      responseType: 'blob'
    });
  }

  // Download a specific named template variant (e.g. QA Daily Delivery variants).
  downloadTemplateVariant(templatePath: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${templatePath}`, {
      responseType: 'blob'
    });
  }

  private toFormData(file: File): FormData {
    const form = new FormData();
    form.append('file', file);
    return form;
  }
}
