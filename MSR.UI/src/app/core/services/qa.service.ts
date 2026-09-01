import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { QaDeliveryTrend, QaKpi, QaRolloverTrend, QaStoryPointsTested } from '../models/api-models';

@Injectable({ providedIn: 'root' })
export class QaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/QA`;

  // Assumes SprintId == SprintNumber (documented assumption).
  getKpis(productAreaId: number, sprintIds: number[]): Observable<QaKpi> {
    let params = new HttpParams().set('ProductAreaId', productAreaId);
    for (const id of sprintIds) {
      params = params.append('SprintIds', id);
    }
    return this.http.get<QaKpi>(`${this.baseUrl}/kpis`, { params });
  }

  private sprintParams(productAreaId: number, sprintNumbers: number[]): HttpParams {
    let params = new HttpParams().set('ProductAreaId', productAreaId);
    for (const n of sprintNumbers) {
      params = params.append('SprintNumbers', n);
    }
    return params;
  }

  getRolloverTrends(productAreaId: number, sprints: number[]): Observable<QaRolloverTrend[]> {
    return this.http.get<QaRolloverTrend[]>(`${this.baseUrl}/rollover-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getStoryPointsTested(productAreaId: number, sprints: number[]): Observable<QaStoryPointsTested[]> {
    return this.http.get<QaStoryPointsTested[]>(`${this.baseUrl}/story-points-tested`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getDeliveryTrend(productAreaId: number, sprints: number[]): Observable<QaDeliveryTrend[]> {
    return this.http.get<QaDeliveryTrend[]>(`${this.baseUrl}/delivery-trend`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }
}
