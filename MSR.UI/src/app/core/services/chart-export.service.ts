import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChartExportService {
  private readonly http = inject(HttpClient);
  private readonly exportUrl = `${environment.apiBaseUrl}/charts/pdf`;

  exportPdf(title: string, imageDataUrl: string): Observable<Blob> {
    return this.http.post(this.exportUrl, { title, imageDataUrl }, { responseType: 'blob' }).pipe(
      tap(blob => this.download(blob, title))
    );
  }

  private download(blob: Blob, title: string): void {
    const fileName = title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'chart';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
}