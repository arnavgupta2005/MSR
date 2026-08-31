import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  QA_PRODUCTS,
  DEFAULT_SPRINT_RANGE,
  SPRINT_RANGE_OPTIONS,
  SprintRangeOption
} from '../../../core/config/report.config';
import { QaKpi } from '../../../core/models/api-models';
import { QaService } from '../../../core/services/qa.service';

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
  buildHorizontalStackedBarChart,
  buildLineChart,
  buildMultiLineChart,
  SERIES_COLORS
} from '../../../shared/utils/chart-options.builder';
import { lineBySprint, multiSeriesByDay, stackBySprint } from '../../../shared/utils/series.transform';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

interface ChartVm {
  state: ChartState;
  options: ChartOptions | null;
}

@Component({
  selector: 'app-qa-dashboard',
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
    ChartCardComponent
  ],
  templateUrl: './qa-dashboard.component.html',
  styleUrl: './qa-dashboard.component.scss'
})
export class QaDashboardComponent implements OnInit {
  private readonly service = inject(QaService);

  readonly products = QA_PRODUCTS;
  readonly ranges = SPRINT_RANGE_OPTIONS;

  selectedProductId = QA_PRODUCTS[0].id;
  selectedKpiSprints: number[] = [10];
  selectedRange: SprintRangeOption = DEFAULT_SPRINT_RANGE;
  selectedRangeIndex = SPRINT_RANGE_OPTIONS.indexOf(DEFAULT_SPRINT_RANGE);

  kpiState: LoadState = 'loading';
  kpi: QaKpi | null = null;

  rollover: ChartVm = { state: 'loading', options: null };
  storyPoints: ChartVm = { state: 'loading', options: null };
  delivery: ChartVm = { state: 'loading', options: null };
  /** Internal-scroll min height for the story-points stacked bars (0 = no scroll). */
  storyPointsMinHeight = 0;
  /** Natural (unscrolled) height of the story-points stacked bars. */
  storyPointsChartHeight = 300;

  ngOnInit(): void {
    this.loadKpis();
    this.loadCharts();
  }

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
        if (res === null) { this.kpiState = 'error'; this.kpi = null; return; }
        this.kpi = res;
        this.kpiState = 'ready';
      });
  }

  loadCharts(): void {
    const id = this.selectedProductId;
    const { startSprint: s, endSprint: e } = this.selectedRange;

    this.rollover = { state: 'loading', options: null };
    this.storyPoints = { state: 'loading', options: null };
    this.delivery = { state: 'loading', options: null };

    // 1. QA Rollover Trend (line)
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
            ['#0ea5b5'], 240, 'Sum of Rollover Points'
          )
        };
      });

    // 2. Story Points Tested — QA wise (horizontal stacked bars, one segment per sprint)
    this.service.getStoryPointsTested(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.storyPoints = { state: 'error', options: null }; return; }
        if (rows.length === 0) { this.storyPoints = { state: 'empty', options: null }; return; }
        const { categories, series } = stackBySprint(rows, r => r.employeeName, r => r.deliveredPoints);
        // Fixed row height per employee keeps the stacked bars a readable
        // thickness no matter how many employees there are. The chart grows
        // vertically and the card scrolls (employees only); the value axis
        // stays pinned to the top so it is never hidden by the scroll.
        const ROW_HEIGHT = 46;
        const CHROME = 90; // space for the top axis + legend
        const chartHeight = categories.length * ROW_HEIGHT + CHROME;
        this.storyPointsChartHeight = chartHeight;
        this.storyPointsMinHeight = categories.length > 8 ? chartHeight : 0;
        this.storyPoints = {
          state: 'ready',
          options: buildHorizontalStackedBarChart(
            categories, series, SERIES_COLORS, chartHeight, '', 'Employee', '65%'
          )
        };
      });

    // 3. Daily Delivery Trend (one line per selected sprint — no aggregation)
    this.service.getDeliveryTrend(id, s, e)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.delivery = { state: 'error', options: null }; return; }
        if (rows.length === 0) { this.delivery = { state: 'empty', options: null }; return; }
        const { days, series } = multiSeriesByDay(rows, r => r.delivery);
        this.delivery = {
          state: 'ready',
          options: buildMultiLineChart(
            days.map(d => `Day ${d}`), series, SERIES_COLORS, 320, 'Delivered Points'
          )
        };
      });
  }
}
