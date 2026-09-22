import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServiceNowTicket } from '../models/api-models';

@Injectable({ providedIn: 'root' })
export class ServiceNowTicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/ServiceNowTicket`;

  // Sprint options for the filter come directly from the ServiceNow data,
  // not from the shared Sprint table.
  getSprints(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/sprints`);
  }

  // Chart data. When no sprints are selected, the backend returns all records.
  getBySprints(sprints: number[]): Observable<ServiceNowTicket[]> {
    let params = new HttpParams();
    for (const s of sprints) {
      params = params.append('Sprints', s);
    }
    return this.http.get<ServiceNowTicket[]>(`${this.baseUrl}/by-sprints`, { params });
  }
}
