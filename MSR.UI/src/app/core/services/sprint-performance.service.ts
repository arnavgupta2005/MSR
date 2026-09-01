import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RolloverTrend,
  ResourceCompletion,
  ResourceVelocityTrend,
  SprintPerformanceKpi,
  TeamCompletionTrend,
  TeamRolloverTrend,
  TeamVelocityHeadcount,
  TeamVelocityTrend,
  VelocityTrend
} from '../models/api-models';

@Injectable({ providedIn: 'root' })
export class SprintPerformanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/SprintPerformance`;

  // NOTE: KPI endpoint accepts SprintIds[]. We assume SprintId == SprintNumber
  // (documented assumption) so the selected sprint numbers are sent directly.
  getKpis(productAreaId: number, sprintIds: number[]): Observable<SprintPerformanceKpi> {
    let params = new HttpParams().set('ProductAreaId', productAreaId);
    for (const id of sprintIds) {
      params = params.append('SprintIds', id);
    }
    return this.http.get<SprintPerformanceKpi>(`${this.baseUrl}/kpis`, { params });
  }

  private sprintParams(productAreaId: number, sprintNumbers: number[]): HttpParams {
    let params = new HttpParams().set('ProductAreaId', productAreaId);
    for (const n of sprintNumbers) {
      params = params.append('SprintNumbers', n);
    }
    return params;
  }

  getVelocityTrends(productAreaId: number, sprints: number[]): Observable<VelocityTrend[]> {
    return this.http.get<VelocityTrend[]>(`${this.baseUrl}/velocity-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getRolloverTrends(productAreaId: number, sprints: number[]): Observable<RolloverTrend[]> {
    return this.http.get<RolloverTrend[]>(`${this.baseUrl}/rollover-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getTeamRolloverTrends(productAreaId: number, sprints: number[]): Observable<TeamRolloverTrend[]> {
    return this.http.get<TeamRolloverTrend[]>(`${this.baseUrl}/team-rollover-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getActualVelocityVsHeadcount(productAreaId: number, sprints: number[]): Observable<TeamVelocityHeadcount[]> {
    return this.http.get<TeamVelocityHeadcount[]>(`${this.baseUrl}/actual-velocity-vs-headcount`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getResourceVelocityTrends(productAreaId: number, sprints: number[]): Observable<ResourceVelocityTrend[]> {
    return this.http.get<ResourceVelocityTrend[]>(`${this.baseUrl}/resource-velocity-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getTeamVelocityTrends(productAreaId: number, sprints: number[]): Observable<TeamVelocityTrend[]> {
    return this.http.get<TeamVelocityTrend[]>(`${this.baseUrl}/team-velocity-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getTeamCompletionTrends(productAreaId: number, sprints: number[]): Observable<TeamCompletionTrend[]> {
    return this.http.get<TeamCompletionTrend[]>(`${this.baseUrl}/team-completion-trends`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }

  getResourceCompletion(productAreaId: number, sprints: number[]): Observable<ResourceCompletion[]> {
    return this.http.get<ResourceCompletion[]>(`${this.baseUrl}/resource-completion`, {
      params: this.sprintParams(productAreaId, sprints)
    });
  }
}
