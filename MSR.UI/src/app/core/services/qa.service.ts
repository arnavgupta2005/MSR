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

  private rangeParams(productAreaId: number, startSprint: number, endSprint: number): HttpParams {
    return new HttpParams()
      .set('ProductAreaId', productAreaId)
      .set('StartSprintNumber', startSprint)
      .set('EndSprintNumber', endSprint);
  }

  getRolloverTrends(productAreaId: number, start: number, end: number): Observable<QaRolloverTrend[]> {
    return this.http.get<QaRolloverTrend[]>(`${this.baseUrl}/rollover-trends`, {
      params: this.rangeParams(productAreaId, start, end)
    });
  }

  getStoryPointsTested(productAreaId: number, start: number, end: number): Observable<QaStoryPointsTested[]> {
    return this.http.get<QaStoryPointsTested[]>(`${this.baseUrl}/story-points-tested`, {
      params: this.rangeParams(productAreaId, start, end)
    });
  }

  getDeliveryTrend(productAreaId: number, start: number, end: number): Observable<QaDeliveryTrend[]> {
    return this.http.get<QaDeliveryTrend[]>(`${this.baseUrl}/delivery-trend`, {
      params: this.rangeParams(productAreaId, start, end)
    });
  }
}
