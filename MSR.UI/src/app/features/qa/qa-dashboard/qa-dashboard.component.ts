import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, Subject, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import {
  ALL_SPRINTS,
  QA_PRODUCTS,
  DEFAULT_KPI_SPRINTS,
  MAX_PERFORMANCE_SPRINTS
} from '../../../core/config/report.config';
import { QaKpi } from '../../../core/models/api-models';
import { QaService } from '../../../core/services/qa.service';

import { ProductSelectorComponent } from '../../../shared/components/product-selector/product-selector.component';
import { SprintMultiSelectComponent } from '../../../shared/components/sprint-multi-select/sprint-multi-select.component';
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
  buildGroupedPercentageBarChart,
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
    DashboardSectionComponent,
    KpiCardComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ChartCardComponent
  ],
  templateUrl: './qa-dashboard.component.html',
  styleUrl: './qa-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QaDashboardComponent implements OnInit, OnDestroy {
  private readonly service = inject(QaService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly cancelKpiLoad$ = new Subject<void>();
  private readonly cancelChartsLoad$ = new Subject<void>();
  private readonly selectedProducts$ = new BehaviorSubject<number[]>([]);
  private readonly selectedKpiSprints$ = new BehaviorSubject<number[]>([]);
  private readonly selectedPerfSprints$ = new BehaviorSubject<number[]>([]);

  readonly products = QA_PRODUCTS;
  readonly maxPerfSprints = MAX_PERFORMANCE_SPRINTS;

  selectedProductIds: number[] = [QA_PRODUCTS[0].id];
  activeDashboardTab: 'kpi' | 'performance' = 'kpi';
  selectedKpiSprints: number[] = [...DEFAULT_KPI_SPRINTS];
  selectedPerfSprints: number[] = [...ALL_SPRINTS];

  kpiState: LoadState = 'loading';
  kpi: QaKpi | null = null;
  kpiRefreshing = false;

  rollover: ChartVm = { state: 'loading', options: null };
  headcountTrend: ChartVm = { state: 'loading', options: null };
  storyPoints: ChartVm = { state: 'loading', options: null };
  delivery: ChartVm = { state: 'loading', options: null };
  iterationPerformance: ChartVm = { state: 'loading', options: null };
  iterationPerformanceMinWidth = 0;
  /** Internal-scroll min height for the story-points stacked bars (0 = no scroll). */
  storyPointsMinHeight = 0;
  /** Natural (unscrolled) height of the story-points stacked bars. */
  storyPointsChartHeight = 300;

  ngOnInit(): void {
    combineLatest([this.selectedProducts$, this.selectedKpiSprints$]).pipe(
      debounceTime(150),
      distinctUntilChanged(([productsA, sprintsA], [productsB, sprintsB]) =>
        this.sameNumberArray(productsA, productsB) && this.sameNumberArray(sprintsA, sprintsB)
      ),
      switchMap(() => of(null).pipe(tap(() => this.loadKpis()))),
      takeUntil(this.destroy$)
    ).subscribe();

    combineLatest([this.selectedProducts$, this.selectedPerfSprints$]).pipe(
      debounceTime(150),
      distinctUntilChanged(([productsA, sprintsA], [productsB, sprintsB]) =>
        this.sameNumberArray(productsA, productsB) && this.sameNumberArray(sprintsA, sprintsB)
      ),
      switchMap(() => of(null).pipe(tap(() => this.loadCharts()))),
      takeUntil(this.destroy$)
    ).subscribe();

    this.selectedProducts$.next([...this.selectedProductIds]);
    this.selectedKpiSprints$.next([...this.selectedKpiSprints]);
    this.selectedPerfSprints$.next([...this.selectedPerfSprints]);
  }

  onProductsChange(ids: Array<string | number>): void {
    const productIds = ids
      .map(id => Number(id))
      .filter(id => !Number.isNaN(id) && this.products.some(product => product.id === id));
    this.selectedProductIds = productIds.length ? productIds : [QA_PRODUCTS[0].id];
    this.selectedProducts$.next([...this.selectedProductIds]);
  }

  onKpiSprintsChange(sprints: number[]): void {
    this.selectedKpiSprints = [...sprints];
    this.selectedKpiSprints$.next([...this.selectedKpiSprints]);
  }

  onPerfSprintsChange(sprints: number[]): void {
    this.selectedPerfSprints = [...sprints];
    this.selectedPerfSprints$.next([...this.selectedPerfSprints]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelKpiLoad$.next();
    this.cancelKpiLoad$.complete();
    this.cancelChartsLoad$.next();
    this.cancelChartsLoad$.complete();
  }

  loadKpis(): void {
    this.cancelKpiLoad$.next();
    if (this.selectedKpiSprints.length === 0) {
      this.kpi = null;
      this.kpiState = 'empty';
      this.kpiRefreshing = false;
      this.cdr.markForCheck();
      return;
    }
    this.kpiRefreshing = this.kpiState === 'ready' && this.kpi !== null;
    if (!this.kpiRefreshing) {
      this.kpiState = 'loading';
    }
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getKpis(productAreaId, this.selectedKpiSprints)
    ).pipe(takeUntil(this.cancelKpiLoad$)).subscribe(results => {
      this.kpiRefreshing = false;
      if (results === null) { if (this.kpi === null) { this.kpiState = 'error'; } this.cdr.markForCheck(); return; }
      if (results.length === 0) { if (this.kpi === null) { this.kpiState = 'empty'; } this.cdr.markForCheck(); return; }
      this.kpi = {
        capacity: results.reduce((sum, item) => sum + item.capacity, 0),
        totalStoryPoints: results.reduce((sum, item) => sum + item.totalStoryPoints, 0),
        rollovers: results.reduce((sum, item) => sum + item.rollovers, 0),
        rolloverPoints: results.reduce((sum, item) => sum + item.rolloverPoints, 0),
        observations: results.reduce((sum, item) => sum + item.observations, 0),
        headcount: results.reduce((sum, item) => sum + item.headcount, 0)
      };
      this.kpiState = 'ready';
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  loadCharts(): void {
    this.cancelChartsLoad$.next();
    const sprints = this.selectedPerfSprints;

    if (sprints.length === 0) {
      this.rollover = { state: 'empty', options: null };
      this.headcountTrend = { state: 'empty', options: null };
      this.storyPoints = { state: 'empty', options: null };
      this.delivery = { state: 'empty', options: null };
      this.iterationPerformance = { state: 'empty', options: null };
      this.iterationPerformanceMinWidth = 0;
      this.cdr.markForCheck();
      return;
    }

    this.rollover = { state: 'loading', options: this.rollover.options };
    this.headcountTrend = { state: 'loading', options: this.headcountTrend.options };
    this.storyPoints = { state: 'loading', options: this.storyPoints.options };
    this.delivery = { state: 'loading', options: this.delivery.options };
    this.iterationPerformance = { state: 'loading', options: this.iterationPerformance.options };

    // 1. QA Rollover Trend (line)
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getRolloverTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelChartsLoad$)).subscribe(results => {
      if (results === null) { this.rollover = { state: 'error', options: null }; this.cdr.markForCheck(); return; }
      const rows = this.aggregateRows(results.flat(), row => `${row.sprintId}`, ['rolloverPoints']);
      if (rows.length === 0) { this.rollover = { state: 'empty', options: null }; this.cdr.markForCheck(); return; }
      const { categories, data } = lineBySprint(rows, r => r.rolloverPoints);
      this.rollover = {
        state: 'ready',
        options: buildLineChart(
          categories.map(c => `Sprint ${c}`),
          [{ name: 'Rollover Points', data }],
          ['#0ea5b5'], 240, 'Sum of Rollover Points'
        )
      };
      this.cdr.markForCheck();
    });

    // 2. Story Points Tested — QA wise (horizontal stacked bars, one segment per sprint)
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getStoryPointsTested(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.storyPoints = { state: 'error', options: null };
        this.headcountTrend = { state: 'error', options: null };
        this.cdr.markForCheck();
        return;
      }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.employeeId}-${row.sprintId}`,
        ['deliveredPoints']
      );
      if (rows.length === 0) {
        this.storyPoints = { state: 'empty', options: null };
        this.headcountTrend = { state: 'empty', options: null };
        this.cdr.markForCheck();
        return;
      }
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

      const headcountBySprint = new Map<number, Set<number>>();
      for (const row of rows) {
        const employeeSet = headcountBySprint.get(row.sprintNumber) ?? new Set<number>();
        employeeSet.add(row.employeeId);
        headcountBySprint.set(row.sprintNumber, employeeSet);
      }
      const sprintNumbers = Array.from(headcountBySprint.keys()).sort((a, b) => a - b);
      this.headcountTrend = {
        state: 'ready',
        options: buildLineChart(
          sprintNumbers.map(sprintNumber => `Sprint ${sprintNumber}`),
          [{ name: 'QA Headcount', data: sprintNumbers.map(sprintNumber => headcountBySprint.get(sprintNumber)?.size ?? 0) }],
          [SERIES_COLORS[0]],
          280,
          'Headcount'
        )
      };
      this.cdr.markForCheck();
    });

    // 3. Daily Delivery Trend (one line per selected sprint — no aggregation)
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getDeliveryTrend(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelChartsLoad$)).subscribe(results => {
      if (results === null) { this.delivery = { state: 'error', options: null }; this.cdr.markForCheck(); return; }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.sprintId}-${row.day}`,
        ['delivery']
      );
      if (rows.length === 0) { this.delivery = { state: 'empty', options: null }; this.cdr.markForCheck(); return; }
      const { days, series } = multiSeriesByDay(rows, r => r.delivery);
      this.delivery = {
        state: 'ready',
        options: buildMultiLineChart(
          days.map(d => `Day ${d}`), series, SERIES_COLORS, 320, 'Delivered Points'
        )
      };
      this.cdr.markForCheck();
    });

    // 4. Iteration Performance (grouped bars per sprint)
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getIterationPerformance(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.iterationPerformance = { state: 'error', options: null };
        this.iterationPerformanceMinWidth = 0;
        this.cdr.markForCheck();
        return;
      }

      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.sprintId}`,
        ['iteration0', 'iteration1', 'iteration2', 'others']
      ).sort((a, b) => a.sprintNumber - b.sprintNumber);

      if (rows.length === 0) {
        this.iterationPerformance = { state: 'empty', options: null };
        this.iterationPerformanceMinWidth = 0;
        this.cdr.markForCheck();
        return;
      }

      const categories = rows.map(row => `Sprint ${row.sprintNumber}`);
      this.iterationPerformanceMinWidth = Math.max(0, categories.length * 84);
      this.iterationPerformance = {
        state: 'ready',
        options: buildGroupedPercentageBarChart(
          categories,
          [
            { name: 'Iteration 0', data: rows.map(row => row.iteration0) },
            { name: 'Iteration 1', data: rows.map(row => row.iteration1) },
            { name: 'Iteration 2', data: rows.map(row => row.iteration2) },
            { name: 'Others', data: rows.map(row => row.others) }
          ],
          [SERIES_COLORS[0], SERIES_COLORS[1], SERIES_COLORS[2], SERIES_COLORS[3]],
          320,
          'Percentage'
        )
      };
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  private fetchBySelectedProducts<T>(requestFactory: (productAreaId: number) => Observable<T>): Observable<T[] | null> {
    if (this.selectedProductIds.length === 0) {
      return of([]);
    }
    return forkJoin(
      this.selectedProductIds.map(productAreaId =>
        requestFactory(productAreaId).pipe(catchError(() => of(null as T | null)))
      )
    ).pipe(map(results => results.some(result => result === null) ? null : (results as T[])));
  }

  private aggregateRows<T extends object>(
    rows: T[],
    keySelector: (row: T) => string,
    sumFields: Array<keyof T>
  ): T[] {
    const map = new Map<string, T>();
    for (const row of rows) {
      const key = keySelector(row);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row });
        continue;
      }

      for (const field of sumFields) {
        const existingValue = existing[field];
        const nextValue = row[field];
        if (typeof existingValue === 'number' && typeof nextValue === 'number') {
          existing[field] = (existingValue + nextValue) as T[keyof T];
        }
      }
    }
    return Array.from(map.values());
  }

  private sameNumberArray(a: number[], b: number[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }
}
