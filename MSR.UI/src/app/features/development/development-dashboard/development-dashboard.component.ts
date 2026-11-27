import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, Subject, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import {
  ALL_SPRINTS,
  DEFAULT_KPI_SPRINTS,
  MAX_PERFORMANCE_SPRINTS
} from '../../../core/config/report.config';
import {
  ProductTrend,
  ResourceCompletion,
  ResourceVelocityTrend,
  RolloverTrend,
  SprintPerformanceKpi,
  TeamCompletionTrend,
  TeamRolloverTrend,
  TeamVelocityHeadcount,
  TeamVelocityTrend,
  VelocityTrend
} from '../../../core/models/api-models';
import { SprintPerformanceService } from '../../../core/services/sprint-performance.service';

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
  ChartPanelGridComponent,
  ChartPanel
} from '../../../shared/components/chart-panel-grid/chart-panel-grid.component';
import {
  buildColumnChart,
  buildCompletionTrendBarChart,
  buildComboCompletionChart,
  buildLineChart,
  buildMultiLineChart,
  buildPanelLineChart,
  DipTooltipEntry,
  SERIES_COLORS
} from '../../../shared/utils/chart-options.builder';
import {
  lineBySprint,
  multiSeriesBySprint,
  panelsByGroup
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

interface DevelopmentDashboardProduct {
  id: string;
  name: string;
  productAreaIds: number[];
}

interface SprintDipRow {
  sprintNumber: number;
  productAreaId: number;
}

@Component({
  selector: 'app-development-dashboard',
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
    ChartCardComponent,
    ChartPanelGridComponent
  ],
  templateUrl: './development-dashboard.component.html',
  styleUrl: './development-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevelopmentDashboardComponent implements OnInit, OnDestroy {
  private readonly service = inject(SprintPerformanceService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly cancelKpiLoad$ = new Subject<void>();
  private readonly cancelKpiChartsLoad$ = new Subject<void>();
  private readonly cancelPerformanceChartsLoad$ = new Subject<void>();
  private readonly selectedProducts$ = new BehaviorSubject<string[]>([]);
  private readonly selectedKpiSprints$ = new BehaviorSubject<number[]>([]);
  private readonly selectedPerfSprints$ = new BehaviorSubject<number[]>([]);

  readonly products: DevelopmentDashboardProduct[] = [
    { id: 'intrics', name: 'Intrics', productAreaIds: [1] },
    { id: 'infoquest-dev', name: 'InfoQuest Dev', productAreaIds: [2, 4] },
    { id: 'infoquest-mobile', name: 'InfoQuest Mobile', productAreaIds: [3] }
  ];
  readonly maxPerfSprints = MAX_PERFORMANCE_SPRINTS;

  get selectedProductNames(): string {
    return this.selectedProductKeys
      .map(id => this.products.find(p => p.id === id)?.name || '')
      .filter(name => name)
      .join(', ');
  }

  // ---- state ----
  selectedProductKeys: string[] = [this.products[0].id];
  activeDashboardTab: 'kpi' | 'performance' = 'kpi';
  selectedKpiSprints: number[] = [...DEFAULT_KPI_SPRINTS];
  selectedPerfSprints: number[] = [...ALL_SPRINTS];

  // ---- KPI ----
  kpiState: LoadState = 'loading';
  kpi: SprintPerformanceKpi | null = null;
  kpiRefreshing = false;

  // ---- charts (simple line/multi-series) ----
  velocity: ChartVm = { state: 'loading', options: null };
  headcountTrend: ChartVm = { state: 'loading', options: null };
  completionTrend: ChartVm = { state: 'loading', options: null };
  plannedDeliveredItemsTrend: ChartVm = { state: 'loading', options: null };
  rolloverRolloverPointsTrend: ChartVm = { state: 'loading', options: null };
  velocityAssignedDeliveredTrend: ChartVm = { state: 'loading', options: null };
  rollover: ChartVm = { state: 'loading', options: null };
  teamRollover: ChartVm = { state: 'loading', options: null };
  resourceCompletion: PanelVm = { state: 'loading', panels: [], legend: [] };
  resourceCompletionTeams: { id: number; name: string }[] = [];
  selectedResourceCompletionTeamId: number | null = null;
  private resourceCompletionRows: ResourceCompletion[] = [];

  // ---- charts (small-multiple panels) ----
  teamVelocity: PanelVm = { state: 'loading', panels: [], legend: [] };
  teamCompletion: PanelVm = { state: 'loading', panels: [], legend: [] };
  velocityHeadcount: PanelVm = { state: 'loading', panels: [], legend: [] };
  resourceVelocity: PanelVm = { state: 'loading', panels: [], legend: [] };

  ngOnInit(): void {
    combineLatest([this.selectedProducts$, this.selectedKpiSprints$]).pipe(
      debounceTime(150),
      distinctUntilChanged(([productsA, sprintsA], [productsB, sprintsB]) =>
        this.sameStringArray(productsA, productsB) && this.sameNumberArray(sprintsA, sprintsB)
      ),
      switchMap(() => of(null).pipe(tap(() => {
        this.loadKpis();
        this.loadKpiCharts();
      }))),
      takeUntil(this.destroy$)
    ).subscribe();

    combineLatest([this.selectedProducts$, this.selectedPerfSprints$]).pipe(
      debounceTime(150),
      distinctUntilChanged(([productsA, sprintsA], [productsB, sprintsB]) =>
        this.sameStringArray(productsA, productsB) && this.sameNumberArray(sprintsA, sprintsB)
      ),
      switchMap(() => of(null).pipe(tap(() => this.loadPerformanceCharts()))),
      takeUntil(this.destroy$)
    ).subscribe();

    this.selectedProducts$.next([...this.selectedProductKeys]);
    this.selectedKpiSprints$.next([...this.selectedKpiSprints]);
    this.selectedPerfSprints$.next([...this.selectedPerfSprints]);
  }

  // ---- filter handlers (independence) ----
  onProductsChange(ids: Array<string | number>): void {
    const productKeys = ids.map(id => String(id)).filter(id => this.products.some(product => product.id === id));
    this.selectedProductKeys = productKeys.length > 0 ? productKeys : [this.products[0].id];
    this.selectedProducts$.next([...this.selectedProductKeys]);
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
    this.cancelKpiChartsLoad$.next();
    this.cancelKpiChartsLoad$.complete();
    this.cancelPerformanceChartsLoad$.next();
    this.cancelPerformanceChartsLoad$.complete();
  }

  onResourceCompletionTeamChange(event: Event): void {
    this.selectedResourceCompletionTeamId = Number((event.target as HTMLSelectElement).value);
    this.updateResourceCompletionPanels();
  }

  scrollToChart(chartType: string): void {
    let elementId: string | null = null;
    
    switch (chartType) {
      case 'headcount':
        elementId = 'chart-headcount';
        break;
      case 'completion':
        elementId = 'chart-completion';
        break;
      case 'rollovers':
        elementId = 'chart-rollovers';
        break;
      case 'velocity':
        elementId = 'chart-velocity';
        break;
      case 'planned':
        elementId = 'chart-planned';
        break;
      default:
        return;
    }

    if (elementId) {
      setTimeout(() => {
        document.getElementById(elementId!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  // ============================================================
  // KPI
  // ============================================================
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
      if (results === null) {
        if (this.kpi === null) {
          this.kpiState = 'error';
        }
        this.cdr.markForCheck();
        return;
      }

      const kpis = results.filter((kpi): kpi is SprintPerformanceKpi => kpi !== null);
      if (kpis.length === 0) {
        if (this.kpi === null) {
          this.kpiState = 'empty';
        }
        this.cdr.markForCheck();
        return;
      }

      const assignedPoints = this.sumNullable(kpis.map(kpi => kpi.assignedPoints));
      const deliveredPoints = this.sumNullable(kpis.map(kpi => kpi.deliveredPoints));
      this.kpi = {
        capacity: this.sumNullable(kpis.map(kpi => kpi.capacity)),
        headcount: this.sumNullable(kpis.map(kpi => kpi.headcount)),
        velocity: this.sumNullable(kpis.map(kpi => kpi.velocity)),
        assignedPoints,
        deliveredPoints,
        rollovers: this.sumNullable(kpis.map(kpi => kpi.rollovers)),
        rolloverPoints: this.sumNullable(kpis.map(kpi => kpi.rolloverPoints)),
        plannedItems: this.sumNullable(kpis.map(kpi => kpi.plannedItems)),
        deliveredItems: this.sumNullable(kpis.map(kpi => kpi.deliveredItems)),
        completionPercentage: this.calculateCompletionPercentage(assignedPoints, deliveredPoints)
      };
      this.kpiState = 'ready';
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  loadKpiCharts(): void {
    this.cancelKpiChartsLoad$.next();
    const sprints = this.selectedKpiSprints;
    if (sprints.length === 0) {
      this.setKpiChartsEmpty();
      this.cdr.markForCheck();
      return;
    }

    this.setKpiChartsLoading();

    this.fetchBySelectedProducts(productAreaId =>
      this.service.getProductTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelKpiChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.plannedDeliveredItemsTrend = { state: 'error', options: null };
        this.rolloverRolloverPointsTrend = { state: 'error', options: null };
        this.velocityAssignedDeliveredTrend = { state: 'error', options: null };
        this.cdr.markForCheck();
        return;
      }

      const flatRows = results.flat();
      const aggregatedRows = this.aggregateRows(
        flatRows,
        row => `${row.sprintId}`,
        ['velocity', 'assignedPoints', 'deliveredPoints', 'plannedItems', 'deliveredItems', 'rollovers', 'rolloverPoints']
      );

      if (aggregatedRows.length === 0) {
        this.plannedDeliveredItemsTrend = { state: 'empty', options: null };
        this.rolloverRolloverPointsTrend = { state: 'empty', options: null };
        this.velocityAssignedDeliveredTrend = { state: 'empty', options: null };
        this.cdr.markForCheck();
        return;
      }

      const sorted = [...aggregatedRows].sort((a, b) => a.sprintNumber - b.sprintNumber);
      const categories = sorted.map(row => `Sprint ${row.sprintNumber}`);
      const dip3BySprint = this.buildCombinedDipBySprint(
        flatRows,
        row => row.dip3Rollovers
      );
      const dip4BySprint = this.buildCombinedDipBySprint(
        flatRows,
        row => row.dip4PlannedItemsDeliveredItems
      );
      const dip5BySprint = this.buildCombinedDipBySprint(
        flatRows,
        row => row.dip5AssignedDeliveredPointsVelocity
      );

      this.plannedDeliveredItemsTrend = {
        state: 'ready',
        options: buildLineChart(
          categories,
          [
            { name: 'Planned Items', data: sorted.map(row => row.plannedItems) },
            { name: 'Delivered Items', data: sorted.map(row => row.deliveredItems) }
          ],
          [SERIES_COLORS[2], SERIES_COLORS[0]],
          260,
          'Items',
          this.selectedProductNames,
          dip4BySprint
        )
      };

      this.rolloverRolloverPointsTrend = {
        state: 'ready',
        options: buildLineChart(
          categories,
          [
            { name: 'Rollovers', data: sorted.map(row => row.rollovers) },
            { name: 'Rollover Points', data: sorted.map(row => row.rolloverPoints) }
          ],
          [SERIES_COLORS[3], SERIES_COLORS[1]],
          260,
          'Count / Points',
          this.selectedProductNames,
          dip3BySprint
        )
      };

      this.velocityAssignedDeliveredTrend = {
        state: 'ready',
        options: buildLineChart(
          categories,
          [
            { name: 'Velocity', data: sorted.map(row => row.velocity) },
            { name: 'Assigned Points', data: sorted.map(row => row.assignedPoints) },
            { name: 'Delivered Points', data: sorted.map(row => row.deliveredPoints) }
          ],
          [SERIES_COLORS[4], SERIES_COLORS[1], SERIES_COLORS[0]],
          260,
          'Points',
          this.selectedProductNames,
          dip5BySprint
        )
      };
      this.cdr.markForCheck();
    });

    this.fetchBySelectedProducts(productAreaId =>
      this.service.getActualVelocityVsHeadcount(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelKpiChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.headcountTrend = { state: 'error', options: null };
        this.cdr.markForCheck();
        return;
      }

      const flatRows = results.flat();
      const aggregatedRows = this.aggregateRows(
        flatRows,
        row => `${row.sprintId}`,
        ['headcount']
      );
      if (aggregatedRows.length === 0) {
        this.headcountTrend = { state: 'empty', options: null };
        this.cdr.markForCheck();
        return;
      }
      const sorted = [...aggregatedRows].sort((a, b) => a.sprintNumber - b.sprintNumber);
      const dip1BySprint = this.buildCombinedDipBySprint(
        flatRows,
        row => row.dip1Headcount
      );
      this.headcountTrend = {
        state: 'ready',
        options: buildLineChart(
          sorted.map(row => `Sprint ${row.sprintNumber}`),
          [{ name: 'Headcount', data: sorted.map(row => row.headcount) }],
          [SERIES_COLORS[1]],
          260,
          'Headcount',
          this.selectedProductNames,
          dip1BySprint
        )
      };
      this.cdr.markForCheck();
    });

    this.fetchBySelectedProducts(productAreaId =>
      this.service.getTeamCompletionTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelKpiChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.completionTrend = { state: 'error', options: null };
        this.cdr.markForCheck();
        return;
      }

      const flatRows = results.flat();
      const aggregatedRows = this.aggregateRows(
        flatRows,
        row => `${row.sprintId}`,
        ['assignedPoints', 'deliveredPoints']
      );
      if (aggregatedRows.length === 0) {
        this.completionTrend = { state: 'empty', options: null };
        this.cdr.markForCheck();
        return;
      }
      const sorted = [...aggregatedRows].sort((a, b) => a.sprintNumber - b.sprintNumber);
      const dip2BySprint = this.buildCombinedDipBySprint(
        flatRows,
        row => row.dip2Completion
      );
      this.completionTrend = {
        state: 'ready',
        options: buildLineChart(
          sorted.map(row => `Sprint ${row.sprintNumber}`),
          [{
            name: 'Completion %',
            data: sorted.map(row => row.assignedPoints > 0
              ? Math.round((row.deliveredPoints / row.assignedPoints) * 1000) / 10
              : 0)
          }],
          [SERIES_COLORS[4]],
          260,
          'Completion %',
          this.selectedProductNames,
          dip2BySprint
        )
      };
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();
  }

  // ============================================================
  // PERFORMANCE CHARTS
  // ============================================================
  loadPerformanceCharts(): void {
    this.cancelPerformanceChartsLoad$.next();
    const sprints = this.selectedPerfSprints;

    if (sprints.length === 0) {
      this.setPerformanceChartsEmpty();
      this.cdr.markForCheck();
      return;
    }

    this.setPerformanceChartsLoading();

    // 1. Velocity Trends Across Sprints — Delivered + Trailing Velocity
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getVelocityTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.velocity = { state: 'error', options: null };
        this.cdr.markForCheck();
        return;
      }
      const rows = this.aggregateRows(results.flat(), row => `${row.sprintId}`, ['actualVelocity', 'trailingVelocity']);
      if (rows.length === 0) {
        this.velocity = { state: 'empty', options: null };
        this.cdr.markForCheck();
        return;
      }
      const sorted = [...rows].sort((a, b) => a.sprintNumber - b.sprintNumber);
      const categories = sorted.map(row => `Sprint ${row.sprintNumber}`);
      this.velocity = {
        state: 'ready',
        options: buildLineChart(
          categories,
          [
            { name: 'Delivered Points', data: sorted.map(row => row.actualVelocity) },
            { name: 'Trailing Velocity', data: sorted.map(row => row.trailingVelocity) }
          ],
          [SERIES_COLORS[0], SERIES_COLORS[3]],
          260,
          'Velocity'
        )
      };
      this.cdr.markForCheck();
    });
    this.cdr.markForCheck();

    // 2. Team wise Actual vs Trailing Velocity — per-team panels (Actual, Trailing)
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getTeamVelocityTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.teamVelocity = { state: 'error', panels: [], legend: [] };
        return;
      }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.teamId}-${row.sprintId}`,
        ['actualVelocity', 'capacity', 'trailingVelocity']
      );
      if (rows.length === 0) {
        this.teamVelocity = { state: 'empty', panels: [], legend: [] };
        return;
      }
        const colors = [SERIES_COLORS[0], SERIES_COLORS[2]];
        const grouped = panelsByGroup(rows, r => r.teamName, [
          { name: 'Delivered Points', value: r => r.actualVelocity },
          { name: 'Trailing Velocity', value: r => r.trailingVelocity }
        ]);
        this.teamVelocity = {
          state: 'ready',
          legend: [
            { name: 'Delivered Points', color: colors[0] },
            { name: 'Trailing Velocity', color: colors[1] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildPanelLineChart(g.sprints.map(sp => `Sprint ${sp}`), g.series, colors, 150, g.group)
          }))
        };
      });

    // 3. Rollovers Trends Across Sprints — Rollover Points
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getRolloverTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.rollover = { state: 'error', options: null };
        return;
      }
      const rows = this.aggregateRows(results.flat(), row => `${row.sprintId}`, ['rollover', 'rolloverPoints']);
      if (rows.length === 0) {
        this.rollover = { state: 'empty', options: null };
        return;
      }
        const { categories, data } = lineBySprint(rows, r => r.rolloverPoints);
        this.rollover = {
          state: 'ready',
          options: buildLineChart(
            categories.map(c => `Sprint ${c}`),
            [{ name: 'Rollover Points', data }],
            [SERIES_COLORS[3]], 260, 'Rollover Points'
          )
        };
      });

    // 4. Team wise Committed vs Completed in Completion % — per-team combo panels
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getTeamCompletionTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.teamCompletion = { state: 'error', panels: [], legend: [] };
        return;
      }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.teamId}-${row.sprintId}`,
        ['assignedPoints', 'deliveredPoints']
      ).map(row => ({
        ...row,
        completionPercentage: row.assignedPoints > 0 ? (row.deliveredPoints / row.assignedPoints) * 100 : 0
      }));
      if (rows.length === 0) {
        this.teamCompletion = { state: 'empty', panels: [], legend: [] };
        return;
      }
        const grouped = panelsByGroup(rows, r => r.teamName, [
          { name: 'Committed Points', value: r => r.assignedPoints },
          { name: 'Delivered Points', value: r => r.deliveredPoints },
          { name: 'Completion %', value: r => Math.round(r.completionPercentage * 100) / 100 }
        ]);
        // Shared Story Points axis max across all team panels, rounded up to
        // the next multiple of 20 so every panel uses identical right-axis ticks.
        const maxPoints = Math.max(0, ...rows.map(r => Math.max(r.assignedPoints, r.deliveredPoints)));
        const pointsMax = Math.max(20, Math.ceil(maxPoints / 20) * 20);
        this.teamCompletion = {
          state: 'ready',
          legend: [
            { name: 'Completion %', color: SERIES_COLORS[4] },
            { name: 'Committed Points', color: SERIES_COLORS[1] },
            { name: 'Delivered Points', color: SERIES_COLORS[2] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildComboCompletionChart(
              g.sprints.map(sp => `Sprint ${sp}`),
              g.series[0].data, g.series[1].data, g.series[2].data,
              170, g.group, pointsMax
            )
          }))
        };
      });

    // 5. Team wise Rollovers Trends Across Sprints — multi-series line (one per team)
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getTeamRolloverTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.teamRollover = { state: 'error', options: null };
        return;
      }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.teamId}-${row.sprintId}`,
        ['rollover', 'rolloverPoints']
      );
      if (rows.length === 0) {
        this.teamRollover = { state: 'empty', options: null };
        return;
      }
        const { sprints, series } = multiSeriesBySprint(rows, r => r.teamName, r => r.rolloverPoints);
        this.teamRollover = {
          state: 'ready',
          options: buildMultiLineChart(
            sprints.map(sp => `Sprint ${sp}`), series, SERIES_COLORS, 260, 'Rollover Points'
          )
        };
      });

    // 6. Delivered Points vs Head Count (Last 4 Sprints) — per-team panels
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getActualVelocityVsHeadcount(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.velocityHeadcount = { state: 'error', panels: [], legend: [] };
        return;
      }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.teamId}-${row.sprintId}`,
        ['actualVelocity', 'headcount']
      );
      if (rows.length === 0) {
        this.velocityHeadcount = { state: 'empty', panels: [], legend: [] };
        return;
      }
        const colors = [SERIES_COLORS[0], SERIES_COLORS[1]];
        const grouped = panelsByGroup(rows, r => r.teamName, [
          { name: 'Delivered Points', value: r => r.actualVelocity },
          { name: 'Headcount', value: r => r.headcount }
        ]);
        this.velocityHeadcount = {
          state: 'ready',
          legend: [
            { name: 'Delivered Points', color: colors[0] },
            { name: 'Headcount', color: colors[1] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildPanelLineChart(
              g.sprints.map(sp => `Sprint ${sp}`), g.series, colors, 150, g.group, false,
              { seriesName: 'Headcount', min: 0, max: 10, tickAmount: 2, title: 'Headcount', leftTitle: 'Delivered Points' }
            )
          }))
        };
      });

    // 7. Resource Wise Actual vs Trailing Velocity Trends — per-employee panels
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getResourceVelocityTrends(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.resourceVelocity = { state: 'error', panels: [], legend: [] };
        return;
      }
      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.employeeId}-${row.sprintId}`,
        ['actualVelocity', 'assignedPoints', 'capacity', 'trailingVelocity']
      );
      if (rows.length === 0) {
        this.resourceVelocity = { state: 'empty', panels: [], legend: [] };
        return;
      }
        const colors = [SERIES_COLORS[0], SERIES_COLORS[2], SERIES_COLORS[4]];
        const grouped = panelsByGroup(rows, r => r.employeeName, [
          { name: 'Delivered Points', value: r => r.actualVelocity },
          { name: 'Assigned Points', value: r => r.assignedPoints },
          { name: 'Trailing Velocity', value: r => r.trailingVelocity }
        ]);
        this.resourceVelocity = {
          state: 'ready',
          legend: [
            { name: 'Delivered Points', color: colors[0] },
            { name: 'Assigned Points', color: colors[1] },
            { name: 'Trailing Velocity', color: colors[2] }
          ],
          panels: grouped.map(g => ({
            title: g.group,
            options: buildPanelLineChart(g.sprints.map(sp => `Sprint ${sp}`), g.series, colors, 150, g.group, true)
          }))
        };
      });

    // 8. Resource Completion Trends — one member chart for the selected team
    this.fetchBySelectedProducts(productAreaId =>
      this.service.getResourceCompletion(productAreaId, sprints)
    ).pipe(takeUntil(this.cancelPerformanceChartsLoad$)).subscribe(results => {
      if (results === null) {
        this.resourceCompletion = { state: 'error', panels: [], legend: [] };
        return;
      }

      const rows = this.aggregateRows(
        results.flat(),
        row => `${row.employeeId}-${row.sprintId}`,
        ['assignedPoints', 'deliveredPoints']
      ).map(row => ({
        ...row,
        completionPercentage: row.assignedPoints > 0 ? (row.deliveredPoints / row.assignedPoints) * 100 : 0
      }));

      if (rows.length === 0) {
        this.resourceCompletion = { state: 'empty', panels: [], legend: [] };
        return;
      }

      this.resourceCompletionRows = rows;
        this.resourceCompletionTeams = Array.from(
          new Map(rows.map(row => [row.teamId, row.teamName])).entries(),
          ([teamId, teamName]) => ({ id: teamId, name: teamName })
        );
        if (!this.resourceCompletionTeams.some(team => team.id === this.selectedResourceCompletionTeamId)) {
          this.selectedResourceCompletionTeamId = this.resourceCompletionTeams[0].id;
        }
        this.updateResourceCompletionPanels();
      });
  }

  private updateResourceCompletionPanels(): void {
    const teamRows = this.resourceCompletionRows.filter(
      row => row.teamId === this.selectedResourceCompletionTeamId
    );
    const grouped = panelsByGroup(teamRows, row => row.employeeName, [
      { name: 'Completion %', value: row => Math.round(row.completionPercentage * 100) / 100 }
    ]);
    this.resourceCompletion = {
      state: grouped.length ? 'ready' : 'empty',
      legend: [{ name: 'Completion %', color: SERIES_COLORS[4] }],
      panels: grouped.map(member => ({
        title: member.group,
        options: buildCompletionTrendBarChart(
          member.sprints.map(sprint => `Sprint ${sprint}`),
          member.series[0].data,
          SERIES_COLORS[4],
          member.group,
          190
        )
      }))
    };
  }

  private getSelectedProductAreaIds(): number[] {
    return Array.from(new Set(
      this.selectedProductKeys.flatMap(key =>
        this.products.find(product => product.id === key)?.productAreaIds ?? []
      )
    ));
  }

  private fetchBySelectedProducts<T>(requestFactory: (productAreaId: number) => Observable<T>): Observable<T[] | null> {
    const productAreaIds = this.getSelectedProductAreaIds();
    if (productAreaIds.length === 0) {
      return of([]);
    }
    return forkJoin(
      productAreaIds.map(productAreaId =>
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

  private sumNullable(values: Array<number | null>): number | null {
    const numbers = values.filter((value): value is number => typeof value === 'number');
    if (numbers.length === 0) {
      return null;
    }
    return numbers.reduce((sum, value) => sum + value, 0);
  }

  private calculateCompletionPercentage(assignedPoints: number | null, deliveredPoints: number | null): number | null {
    if (assignedPoints === null || deliveredPoints === null || assignedPoints === 0) {
      return null;
    }
    return Math.round((deliveredPoints / assignedPoints) * 1000) / 10;
  }

  private buildDipBySprint<T extends SprintDipRow>(
    rows: T[],
    dipSelector: (row: T) => string | null | undefined
  ): Record<string, DipTooltipEntry[]> {
    const bySprint = new Map<number, Map<number, string>>();

    for (const row of rows) {
      const dip = dipSelector(row);
      if (!dip || dip.trim().length === 0) {
        continue;
      }

      if (!bySprint.has(row.sprintNumber)) {
        bySprint.set(row.sprintNumber, new Map<number, string>());
      }

      const byProduct = bySprint.get(row.sprintNumber)!;
      if (!byProduct.has(row.productAreaId)) {
        byProduct.set(row.productAreaId, dip);
      }
    }

    const result: Record<string, DipTooltipEntry[]> = {};
    for (const [sprintNumber, byProduct] of bySprint.entries()) {
      const key = `Sprint ${sprintNumber}`;
      result[key] = Array.from(byProduct.entries())
        .map(([productAreaId, value]) => ({
          product: this.productAreaLabel(productAreaId),
          value
        }))
        .sort((a, b) => a.product.localeCompare(b.product));
    }

    return result;
  }

  private buildCombinedDipBySprint<T extends SprintDipRow>(
    rows: T[],
    dipSelector: (row: T) => string | null | undefined
  ): Record<string, DipTooltipEntry[]> {
    const dipBySprint = this.buildDipBySprint(rows, dipSelector);
    const result: Record<string, DipTooltipEntry[]> = {};

    for (const [sprintKey, entries] of Object.entries(dipBySprint)) {
      const seen = new Set<string>();
      const reasons: string[] = [];

      for (const entry of entries) {
        const reason = entry.value.trim();
        if (reason.length === 0 || seen.has(reason)) {
          continue;
        }
        seen.add(reason);
        reasons.push(reason);
      }

      if (reasons.length === 0) {
        continue;
      }

      result[sprintKey] = [{ product: 'Reason', value: reasons.join(', ') }];
    }

    return result;
  }

  private productAreaLabel(productAreaId: number): string {
    switch (productAreaId) {
      case 1:
        return 'Intrics';
      case 2:
        return 'InfoQuest Web';
      case 3:
        return 'InfoQuest Mobile';
      case 4:
        return 'InfoQuest LMS';
      default:
        return `Product ${productAreaId}`;
    }
  }

  private setKpiChartsLoading(): void {
    this.headcountTrend = { state: 'loading', options: this.headcountTrend.options };
    this.completionTrend = { state: 'loading', options: this.completionTrend.options };
    this.plannedDeliveredItemsTrend = { state: 'loading', options: this.plannedDeliveredItemsTrend.options };
    this.rolloverRolloverPointsTrend = { state: 'loading', options: this.rolloverRolloverPointsTrend.options };
    this.velocityAssignedDeliveredTrend = { state: 'loading', options: this.velocityAssignedDeliveredTrend.options };
  }

  private setKpiChartsEmpty(): void {
    this.headcountTrend = { state: 'empty', options: null };
    this.completionTrend = { state: 'empty', options: null };
    this.plannedDeliveredItemsTrend = { state: 'empty', options: null };
    this.rolloverRolloverPointsTrend = { state: 'empty', options: null };
    this.velocityAssignedDeliveredTrend = { state: 'empty', options: null };
  }

  private setPerformanceChartsLoading(): void {
    this.velocity = { state: 'loading', options: this.velocity.options };
    this.rollover = { state: 'loading', options: this.rollover.options };
    this.teamRollover = { state: 'loading', options: this.teamRollover.options };
    this.resourceCompletion = {
      state: 'loading',
      panels: this.resourceCompletion.panels,
      legend: this.resourceCompletion.legend
    };
    this.teamVelocity = { state: 'loading', panels: this.teamVelocity.panels, legend: this.teamVelocity.legend };
    this.teamCompletion = { state: 'loading', panels: this.teamCompletion.panels, legend: this.teamCompletion.legend };
    this.velocityHeadcount = { state: 'loading', panels: this.velocityHeadcount.panels, legend: this.velocityHeadcount.legend };
    this.resourceVelocity = { state: 'loading', panels: this.resourceVelocity.panels, legend: this.resourceVelocity.legend };
  }

  private setPerformanceChartsEmpty(): void {
    this.velocity = { state: 'empty', options: null };
    this.rollover = { state: 'empty', options: null };
    this.teamRollover = { state: 'empty', options: null };
    this.resourceCompletion = { state: 'empty', panels: [], legend: [] };
    this.resourceCompletionRows = [];
    this.resourceCompletionTeams = [];
    this.teamVelocity = { state: 'empty', panels: [], legend: [] };
    this.teamCompletion = { state: 'empty', panels: [], legend: [] };
    this.velocityHeadcount = { state: 'empty', panels: [], legend: [] };
    this.resourceVelocity = { state: 'empty', panels: [], legend: [] };
  }

  private sameNumberArray(a: number[], b: number[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }

  private sameStringArray(a: string[], b: string[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }
}


