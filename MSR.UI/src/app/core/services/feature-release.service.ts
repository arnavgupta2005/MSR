import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FeatureRelease } from '../models/api-models';

@Injectable({ providedIn: 'root' })
export class FeatureReleaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/FeatureRelease`;

  getFeatureReleases(productName: string): Observable<FeatureRelease[]> {
    const params = new HttpParams().set('productName', productName);
    return this.http.get<FeatureRelease[]>(this.baseUrl, { params });
  }
}
