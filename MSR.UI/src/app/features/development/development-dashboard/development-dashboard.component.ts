import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  DEVELOPMENT_PRODUCTS,
  DEFAULT_SPRINT_RANGE,
  SPRINT_RANGE_OPTIONS,
  SprintRangeOption
} from '../../../core/config/report.config';
import { SprintPerformanceKpi } from '../../../core/models/api-models';
import { SprintPerformanceService } from '../../../core/services/sprint-performance.service';

import { ProductSelectorComponent } from '../../../shared/components/product-selector/product-selector.component';
import { SprintMultiSelectComponent } from '../../../shared/components/sprint-multi-select/sprint-multi-select.component';
import { SprintRangeSelectorComponent } from '../../../shared/components/sprint-range-selector/sprint-range-selector.component';
import { DashboardSectionComponent } from '../../../shared/components/dashboard-section/dashboard-section.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import {
  ChartCardComponent,
  ChartOptions,
  ChartState
} from '../../../shared/components/chart-card/chart-card.component';
import {
  ChartPanelGridComponent,
  ChartPanel
} from '../../../shared/components/chart-panel-grid/chart-panel-grid.component';
import {
  buildColumnChart,
  buildComboCompletionChart,
  buildGroupedBarChart,
  buildLineChart,
  buildMultiLineChart,
  buildPanelLineChart,
  SERIES_COLORS
} from '../../../shared/utils/chart-options.builder';
import {
  lineBySprint,
  multiSeriesBySprint,
  panelsByGroup,
  pivotByGroupAndSprint
} from '../../../shared/utils/series.transform';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

interface ChartVm {
  state: ChartState;
  options: ChartOptions | null;
}

interface PanelVm {
  state: ChartState;
  panels: ChartPanel[];
  legend: { name: string; color: string }[];
}

@Component({
  selector: 'app-development-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProductSelectorComponent,
    SprintMultiSelectComponent,
    SprintRangeSelectorComponent,
    DashboardSectionComponent,
    KpiCardComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ChartCardComponent,
    ChartPanelGridComponent
  ],
  templateUrl: './development-dashboard.component.html',
  styleUrl: './development-dashboard.component.scss'
})
export class DevelopmentDashboardComponent implements OnInit {
  private readonly service = inject(SprintPerformanceService);

  readonly products = DEVELOPMENT_PRODUCTS;
  readonly ranges = SPRINT_RANGE_OPTIONS;

  // ---- state ----
  selectedProductId = DEVELOPMENT_PRODUCTS[0].id;
  selectedKpiSprints: number[] = [10];
  selectedRange: SprintRangeOption = DEFAULT_SPRINT_RANGE;
  selectedRangeIndex = SPRINT_RANGE_OPTIONS.indexOf(DEFAULT_SPRINT_RANGE);

  // ---- KPI ----
  kpiState: LoadState = 'loading';
  kpi: SprintPerformanceKpi | null = null;

  // ---- charts (simple line/multi-series) ----
  velocity: ChartVm = { state: 'loading', options: null };
  rollover: ChartVm = { state: 'loading', options: null };
  teamRollover: ChartVm = { state: 'loading', options: null };
  resourceCompletion: ChartVm = { state: 'loading', options: null };
  /** Internal-scroll min width for the resource completion grouped bars (0 = no scroll). */
  resourceCompletionMinWidth = 0;

  // ---- charts (small-multiple panels) ----
  teamVelocity: PanelVm = { state: 'loading', panels: [], legend: [] };
  teamCompletion: PanelVm = { state: 'loading', panels: [], legend: [] };
  velocityHeadcount: PanelVm = { state: 'loading', panels: [], legend: [] };
  resourceVelocity: PanelVm = { state: 'loading', panels: [], legend: [] };

  ngOnInit(): void {
    this.loadKpis();
    this.loadCharts();
  }

  // ---- filter handlers (independence) ----
  onProductChange(id: number): void {
    this.selectedProductId = id;
    this.loadKpis();
    this.loadCharts();
  }

  onKpiSprintsChange(sprints: number[]): void {
    this.selectedKpiSprints = sprints;
    this.loadKpis();
  }

  onRangeChange(range: SprintRangeOption): void {
    this.selectedRange = range;
    this.loadCharts();
  }

  // ============================================================
  // KPI
  // ============================================================
  loadKpis(): void {
    if (this.selectedKpiSprints.length === 0) {
      this.kpi = null;
      this.kpiState = 'empty';
      return;
    }
    this.kpiState = 'loading';
    this.service
      .getKpis(this.selectedProductId, this.selectedKpiSprints)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res === null) {
          this.kpiState = 'error';
          this.kpi = null;
          return;
        }
        // All-null payload => treat as no data.
        const hasData = res && Object.values(res).some(v => v !== null && v !== undefined);
        if (!hasData) {
          this.kpi = null;
          this.kpiState = 'empty';
          return;
        }
        this.kpi = res;
        this.kpiState = 'ready';
      });
  }

  // ============================================================
  // CHARTS
  // ============================================================
  loadCharts(): void {
    const id = this.selectedProductId;
    const { startSprint: s, endSprint: e } = this.selectedRange;

    this.setAllLoading();

    // 1. Velocity Trends Across Sprints — Actual + Trailing Velocity
    this.service.getVelocityTrends(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.velocity = { state: 'error', options: null }; return; }
        if (rows.length === 0) { this.velocity = { state: 'empty', options: null }; return; }
        const sorted = [...rows].sort((a, b) => a.sprintNumber - b.sprintNumber);
        const categories = sorted.map(r => `Sprint ${r.sprintNumber}`);
        this.velocity = {
          state: 'ready',
          options: buildLineChart(
            categories,
            [
              { name: 'Actual Velocity', data: sorted.map(r => r.actualVelocity) },
              { name: 'Trailing Velocity', data: sorted.map(r => r.trailingVelocity) }
            ],
            ['#2563eb', '#7c3aed'], 260, 'Velocity'
          )
        };
      });

    // 2. Team wise Actual vs Trailing Velocity — per-team panels (Actual, Capacity, Trailing)
    this.service.getTeamVelocityTrends(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.teamVelocity = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.teamVelocity = { state: 'empty', panels: [], legend: [] }; return; }
        const colors = ['#2563eb', '#ea8a2b', '#7c3aed'];
        const grouped = panelsByGroup(rows, r => r.teamName, [
          { name: 'Actual Velocity', value: r => r.actualVelocity },
          { name: 'Capacity', value: r => r.capacity },
          { name: 'Trailing Velocity', value: r => r.trailingVelocity }
        ]);
        this.teamVelocity = {
          state: 'ready',
          legend: [
            { name: 'Actual Velocity', color: colors[0] },
            { name: 'Capacity', color: colors[1] },
            { name: 'Trailing Velocity', color: colors[2] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildPanelLineChart(g.sprints.map(sp => `Sprint ${sp}`), g.series, colors, 150, g.group)
          }))
        };
      });

    // 3. Rollovers Trends Across Sprints — Rollover Points
    this.service.getRolloverTrends(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.rollover = { state: 'error', options: null }; return; }
        if (rows.length === 0) { this.rollover = { state: 'empty', options: null }; return; }
        const { categories, data } = lineBySprint(rows, r => r.rolloverPoints);
        this.rollover = {
          state: 'ready',
          options: buildLineChart(
            categories.map(c => `Sprint ${c}`),
            [{ name: 'Rollover Points', data }],
            ['#ea8a2b'], 260, 'Rollover Points'
          )
        };
      });

    // 4. Team wise Committed vs Completed in Completion % — per-team combo panels
    this.service.getTeamCompletionTrends(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.teamCompletion = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.teamCompletion = { state: 'empty', panels: [], legend: [] }; return; }
        const grouped = panelsByGroup(rows, r => r.teamName, [
          { name: 'Committed Points', value: r => r.assignedPoints },
          { name: 'Completed Points', value: r => r.deliveredPoints },
          { name: 'Completion %', value: r => Math.round(r.completionPercentage * 100) / 100 }
        ]);
        this.teamCompletion = {
          state: 'ready',
          legend: [
            { name: 'Committed Points', color: '#93c5fd' },
            { name: 'Completed Points', color: '#2563eb' },
            { name: 'Completion %', color: '#ea8a2b' }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildComboCompletionChart(
              g.sprints.map(sp => `Sprint ${sp}`),
              g.series[0].data, g.series[1].data, g.series[2].data,
              170, g.group
            )
          }))
        };
      });

    // 5. Team wise Rollovers Trends Across Sprints — multi-series line (one per team)
    this.service.getTeamRolloverTrends(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.teamRollover = { state: 'error', options: null }; return; }
        if (rows.length === 0) { this.teamRollover = { state: 'empty', options: null }; return; }
        const { sprints, series } = multiSeriesBySprint(rows, r => r.teamName, r => r.rolloverPoints);
        this.teamRollover = {
          state: 'ready',
          options: buildMultiLineChart(
            sprints.map(sp => `Sprint ${sp}`), series, SERIES_COLORS, 260, 'Rollover Points'
          )
        };
      });

    // 6. Actual Velocity vs Head Count (Last 4 Sprints) — per-team panels
    this.service.getActualVelocityVsHeadcount(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.velocityHeadcount = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.velocityHeadcount = { state: 'empty', panels: [], legend: [] }; return; }
        const colors = ['#2563eb', '#0f2545'];
        const grouped = panelsByGroup(rows, r => r.teamName, [
          { name: 'Actual Velocity', value: r => r.actualVelocity },
          { name: 'Headcount', value: r => r.headcount }
        ]);
        this.velocityHeadcount = {
          state: 'ready',
          legend: [
            { name: 'Actual Velocity', color: colors[0] },
            { name: 'Headcount', color: colors[1] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildPanelLineChart(g.sprints.map(sp => `Sprint ${sp}`), g.series, colors, 150, g.group)
          }))
        };
      });

    // 7. Resource Wise Actual vs Trailing Velocity Trends — per-employee panels
    this.service.getResourceVelocityTrends(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.resourceVelocity = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.resourceVelocity = { state: 'empty', panels: [], legend: [] }; return; }
        const colors = ['#2563eb', '#16a34a', '#ea8a2b', '#7c3aed'];
        const grouped = panelsByGroup(rows, r => r.employeeName, [
          { name: 'Actual Velocity', value: r => r.actualVelocity },
          { name: 'Assigned Points', value: r => r.assignedPoints },
          { name: 'Capacity', value: r => r.capacity },
          { name: 'Trailing Velocity', value: r => r.trailingVelocity }
        ]);
        this.resourceVelocity = {
          state: 'ready',
          legend: [
            { name: 'Actual Velocity', color: colors[0] },
            { name: 'Assigned Points', color: colors[1] },
            { name: 'Capacity', color: colors[2] },
            { name: 'Trailing Velocity', color: colors[3] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildPanelLineChart(g.sprints.map(sp => `Sprint ${sp}`), g.series, colors, 150, g.group, true)
          }))
        };
      });

    // 8. Resource Completion Trends — multi-series line (one per employee)
    this.service.getResourceCompletion(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.resourceCompletion = { state: 'error', options: null }; return; }
        if (rows.length === 0) { this.resourceCompletion = { state: 'empty', options: null }; return; }
        const { categories, series } = pivotByGroupAndSprint(
          rows, r => r.employeeName, r => Math.round(r.completionPercentage * 100) / 100
        );
        // Enable internal horizontal scroll only when there are many employees.
        this.resourceCompletionMinWidth = categories.length > 8 ? categories.length * 80 : 0;
        const opts = buildGroupedBarChart(
          categories, series, SERIES_COLORS, 320, true, 'Employee', 'Completion %'
        );
        this.resourceCompletion = { state: 'ready', options: opts };
      });
  }

  private setAllLoading(): void {
    this.velocity = { state: 'loading', options: null };
    this.rollover = { state: 'loading', options: null };
    this.teamRollover = { state: 'loading', options: null };
    this.resourceCompletion = { state: 'loading', options: null };
    this.teamVelocity = { state: 'loading', panels: [], legend: [] };
    this.teamCompletion = { state: 'loading', panels: [], legend: [] };
    this.velocityHeadcount = { state: 'loading', panels: [], legend: [] };
    this.resourceVelocity = { state: 'loading', panels: [], legend: [] };
  }
}
