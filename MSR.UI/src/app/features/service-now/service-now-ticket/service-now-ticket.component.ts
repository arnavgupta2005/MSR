import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { SprintOption, SPRINT_OPTIONS } from '../../../core/config/report.config';
import { ServiceNowTicket } from '../../../core/models/api-models';
import { ServiceNowTicketService } from '../../../core/services/service-now-ticket.service';

import { SprintMultiSelectComponent } from '../../../shared/components/sprint-multi-select/sprint-multi-select.component';
import {
  ChartCardComponent,
  ChartOptions,
  ChartState
} from '../../../shared/components/chart-card/chart-card.component';
import { buildServiceNowTicketsChart } from '../../../shared/utils/chart-options.builder';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-service-now-ticket',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SprintMultiSelectComponent,
    ChartCardComponent
  ],
  templateUrl: './service-now-ticket.component.html',
  styleUrl: './service-now-ticket.component.scss'
})
export class ServiceNowTicketComponent implements OnInit {
  private readonly service = inject(ServiceNowTicketService);

  // Fixed sprint options (Sprint 1 to 25).
  sprintOptions: SprintOption[] = SPRINT_OPTIONS;
  selectedSprints: number[] = [4, 5, 6, 7, 8];

  state: LoadState = 'loading';
  chart: { state: ChartState; options: ChartOptions | null } = { state: 'loading', options: null };

  ngOnInit(): void {
    this.init();
  }

  // Load the chart data using the fixed sprint options.
  init(): void {
    this.load();
  }

  onSprintsChange(sprints: number[]): void {
    this.selectedSprints = sprints;
    this.load();
  }

  // Load chart data for the current selection. With no sprints selected there
  // is nothing to show, so render the empty state instead of all records.
  load(): void {
    if (this.selectedSprints.length === 0) {
      this.state = 'empty';
      this.chart = { state: 'empty', options: null };
      return;
    }

    this.state = 'loading';
    this.chart = { state: 'loading', options: null };

    this.service
      .getBySprints(this.selectedSprints)
      .pipe(catchError(() => of<ServiceNowTicket[] | null>(null)))
      .subscribe(rows => {
        if (rows === null) {
          this.state = 'error';
          this.chart = { state: 'error', options: null };
          return;
        }
        if (rows.length === 0) {
          this.state = 'empty';
          this.chart = { state: 'empty', options: null };
          return;
        }
        this.state = 'ready';
        this.chart = { state: 'ready', options: this.buildChart(rows) };
      });
  }

  private buildChart(rows: ServiceNowTicket[]): ChartOptions {
    const sorted = [...rows].sort((a, b) => a.sprint - b.sprint);
    const categories = sorted.map(r => `Sprint ${r.sprint}`);
    return buildServiceNowTicketsChart(
      categories,
      sorted.map(r => r.criticalWeb),
      sorted.map(r => r.web),
      sorted.map(r => r.criticalMobile),
      sorted.map(r => r.mobile),
      sorted.map(r => r.completionPercentage)
    );
  }
}
