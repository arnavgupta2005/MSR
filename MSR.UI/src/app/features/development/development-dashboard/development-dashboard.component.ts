import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  ALL_SPRINTS,
  DEVELOPMENT_PRODUCTS,
  DEFAULT_KPI_SPRINTS,
  MAX_PERFORMANCE_SPRINTS
} from '../../../core/config/report.config';
import { ResourceCompletion, SprintPerformanceKpi } from '../../../core/models/api-models';
import { SprintPerformanceService } from '../../../core/services/sprint-performance.service';

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

@Component({
  selector: 'app-development-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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
  styleUrl: './development-dashboard.component.scss'
})
export class DevelopmentDashboardComponent implements OnInit {
  private readonly service = inject(SprintPerformanceService);

  readonly products = DEVELOPMENT_PRODUCTS;
  readonly maxPerfSprints = MAX_PERFORMANCE_SPRINTS;

  // Convert products to sprint options format for multi-select
  get productsAsOptions() {
    return this.products.map(p => ({
      sprintNumber: p.id,
      label: p.name
    }));
  }

  // Get comma-separated product names for selected products
  get selectedProductNames(): string {
    return this.selectedProductIds
      .map(id => this.products.find(p => p.id === id)?.name || '')
      .filter(name => name)
      .join(', ');
  }

  // Get product filter summary text for display
  get productFilterSummary(): string {
    const totalProducts = this.products.length;
    const selectedCount = this.selectedProductIds.length;
    
    if (selectedCount === 0) {
      return 'Select products';
    }
    if (selectedCount === totalProducts) {
      return 'ALL';
    }
    if (selectedCount === 1) {
      return this.products.find(p => p.id === this.selectedProductIds[0])?.name || 'Select products';
    }
    return `${selectedCount} products selected`;
  }

  // ---- state ----
  selectedProductIds: number[] = [DEVELOPMENT_PRODUCTS[0].id];
  activeDashboardTab: 'kpi' | 'performance' = 'kpi';
  selectedKpiSprints: number[] = [...DEFAULT_KPI_SPRINTS];
  selectedPerfSprints: number[] = [...ALL_SPRINTS];

  // ---- KPI ----
  kpiState: LoadState = 'loading';
  kpi: SprintPerformanceKpi | null = null;
  private kpiByProduct: Map<number, SprintPerformanceKpi | null> = new Map();

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
    this.loadKpis();
    this.loadCharts();
  }

  // ---- filter handlers (independence) ----
  onProductsChange(ids: number[]): void {
    this.selectedProductIds = ids.length > 0 ? ids : [DEVELOPMENT_PRODUCTS[0].id];
    this.loadKpis();
    this.loadCharts();
  }

  onKpiSprintsChange(sprints: number[]): void {
    this.selectedKpiSprints = sprints;
    this.loadKpis();
  }

  onPerfSprintsChange(sprints: number[]): void {
    this.selectedPerfSprints = sprints;
    this.loadCharts();
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
    if (this.selectedKpiSprints.length === 0) {
      this.kpi = null;
      this.kpiState = 'empty';
      return;
    }
    this.kpiState = 'loading';
    this.kpiByProduct.clear();

    // Load KPIs for all selected products
    const requests = this.selectedProductIds.map(productId =>
      this.service
        .getKpis(productId, this.selectedKpiSprints)
        .pipe(catchError(() => of(null)))
    );

    // Wait for all requests to complete
    if (requests.length === 0) {
      this.kpiState = 'empty';
      return;
    }

    Promise.all(requests.map(r => r.toPromise())).then(results => {
      // Store KPIs by product
      for (let i = 0; i < this.selectedProductIds.length; i++) {
        const productId = this.selectedProductIds[i];
        const result = results[i];
        if (result !== null && result !== undefined) {
          this.kpiByProduct.set(productId, result);
        }
      }

      // Aggregate KPIs from all selected products
      this.aggregateKpis();
    });
  }

  private aggregateKpis(): void {
    if (this.kpiByProduct.size === 0) {
      this.kpiState = 'error';
      this.kpi = null;
      return;
    }

    const kpiArray = Array.from(this.kpiByProduct.values()).filter((kpi): kpi is SprintPerformanceKpi => kpi !== null);
    
    if (kpiArray.length === 0) {
      this.kpi = null;
      this.kpiState = 'empty';
      return;
    }

    // Check if all KPIs have data
    const hasData = kpiArray.some(kpi => 
      Object.values(kpi).some(v => v !== null && v !== undefined)
    );

    if (!hasData) {
      this.kpi = null;
      this.kpiState = 'empty';
      return;
    }

    // Aggregate by summing all numeric values
    const aggregated: SprintPerformanceKpi = {
      capacity: this.sumField(kpiArray, 'capacity'),
      headcount: this.sumField(kpiArray, 'headcount'),
      velocity: this.sumField(kpiArray, 'velocity'),
      assignedPoints: this.sumField(kpiArray, 'assignedPoints'),
      deliveredPoints: this.sumField(kpiArray, 'deliveredPoints'),
      rollovers: this.sumField(kpiArray, 'rollovers'),
      rolloverPoints: this.sumField(kpiArray, 'rolloverPoints'),
      plannedItems: this.sumField(kpiArray, 'plannedItems'),
      deliveredItems: this.sumField(kpiArray, 'deliveredItems'),
      completionPercentage: this.averagePercentage(kpiArray)
    };

    this.kpi = aggregated;
    this.kpiState = 'ready';
  }

  private sumField(kpis: SprintPerformanceKpi[], field: keyof SprintPerformanceKpi): number | null {
    const sum = kpis.reduce((acc, kpi) => {
      const value = kpi[field];
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }

  private averagePercentage(kpis: SprintPerformanceKpi[]): number | null {
    const percentages = kpis
      .map(kpi => kpi.completionPercentage)
      .filter((v): v is number => typeof v === 'number');
    
    if (percentages.length === 0) return null;
    
    const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    return Math.round(avg * 100) / 100;
  }

  // ============================================================
  // CHARTS
  // ============================================================
  loadCharts(): void {
    const sprints = this.selectedPerfSprints;

    if (sprints.length === 0) {
      this.setAllEmpty();
      return;
    }

    this.setAllLoading();

    // For multi-product selection, load and aggregate data from all products
    const productIds = this.selectedProductIds;
    
    // Product-level trend charts - aggregate from first product for now
    // In a real scenario, you'd aggregate from all products
    const primaryProductId = productIds[0];
    this.service.getProductTrends(primaryProductId, sprints)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) {
          this.plannedDeliveredItemsTrend = { state: 'error', options: null };
          this.rolloverRolloverPointsTrend = { state: 'error', options: null };
          this.velocityAssignedDeliveredTrend = { state: 'error', options: null };
          return;
        }
        if (rows.length === 0) {
          this.plannedDeliveredItemsTrend = { state: 'empty', options: null };
          this.rolloverRolloverPointsTrend = { state: 'empty', options: null };
          this.velocityAssignedDeliveredTrend = { state: 'empty', options: null };
          return;
        }

        const sorted = [...rows].sort((a, b) => a.sprintNumber - b.sprintNumber);
        const categories = sorted.map(row => `Sprint ${row.sprintNumber}`);

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
            this.selectedProductNames
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
            this.selectedProductNames
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
            this.selectedProductNames
          )
        };
      });

    // 1. Velocity Trends Across Sprints â€” Delivered + Trailing Velocity
    this.service.getVelocityTrends(primaryProductId, sprints)
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
              { name: 'Delivered Points', data: sorted.map(r => r.actualVelocity) },
              { name: 'Trailing Velocity', data: sorted.map(r => r.trailingVelocity) }
            ],
            [SERIES_COLORS[0], SERIES_COLORS[3]], 260, 'Velocity'
          )
        };
      });

    // 2. Team wise Actual vs Trailing Velocity â€” per-team panels (Actual, Trailing)
    this.service.getTeamVelocityTrends(primaryProductId, sprints)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.teamVelocity = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.teamVelocity = { state: 'empty', panels: [], legend: [] }; return; }
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

    // 3. Rollovers Trends Across Sprints â€” Rollover Points
    this.service.getRolloverTrends(primaryProductId, sprints)
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
            [SERIES_COLORS[3]], 260, 'Rollover Points'
          )
        };
      });

    // 4. Team wise Committed vs Completed in Completion % â€” per-team combo panels
    this.service.getTeamCompletionTrends(primaryProductId, sprints)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) {
          this.teamCompletion = { state: 'error', panels: [], legend: [] };
          this.completionTrend = { state: 'error', options: null };
          return;
        }
        if (rows.length === 0) {
          this.teamCompletion = { state: 'empty', panels: [], legend: [] };
          this.completionTrend = { state: 'empty', options: null };
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

        const completionBySprint = new Map<number, { assignedPoints: number; deliveredPoints: number }>();
        for (const row of rows) {
          const totals = completionBySprint.get(row.sprintNumber) ?? { assignedPoints: 0, deliveredPoints: 0 };
          totals.assignedPoints += row.assignedPoints;
          totals.deliveredPoints += row.deliveredPoints;
          completionBySprint.set(row.sprintNumber, totals);
        }
        const sprintNumbers = Array.from(completionBySprint.keys()).sort((a, b) => a - b);
        this.completionTrend = {
          state: 'ready',
          options: buildLineChart(
            sprintNumbers.map(sprintNumber => `Sprint ${sprintNumber}`),
            [{
              name: 'Completion %',
              data: sprintNumbers.map(sprintNumber => {
                const totals = completionBySprint.get(sprintNumber);
                if (!totals || totals.assignedPoints === 0) { return 0; }
                return Math.round((totals.deliveredPoints / totals.assignedPoints) * 1000) / 10;
              })
            }],
            [SERIES_COLORS[4]],
            260,
            'Completion %',
            this.selectedProductNames
          )
        };
      });

    // 5. Team wise Rollovers Trends Across Sprints â€” multi-series line (one per team)
    this.service.getTeamRolloverTrends(primaryProductId, sprints)
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

    // 6. Delivered Points vs Head Count (Last 4 Sprints) â€” per-team panels
    this.service.getActualVelocityVsHeadcount(primaryProductId, sprints)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) {
          this.velocityHeadcount = { state: 'error', panels: [], legend: [] };
          this.headcountTrend = { state: 'error', options: null };
          return;
        }
        if (rows.length === 0) {
          this.velocityHeadcount = { state: 'empty', panels: [], legend: [] };
          this.headcountTrend = { state: 'empty', options: null };
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

        const headcountBySprint = new Map<number, number>();
        for (const row of rows) {
          headcountBySprint.set(
            row.sprintNumber,
            (headcountBySprint.get(row.sprintNumber) ?? 0) + row.headcount
          );
        }
        const sprintNumbers = Array.from(headcountBySprint.keys()).sort((a, b) => a - b);
        this.headcountTrend = {
          state: 'ready',
          options: buildLineChart(
            sprintNumbers.map(sprintNumber => `Sprint ${sprintNumber}`),
            [{ name: 'Headcount', data: sprintNumbers.map(sprintNumber => headcountBySprint.get(sprintNumber) ?? 0) }],
            [SERIES_COLORS[1]],
            260,
            'Headcount',
            this.selectedProductNames
          )
        };
      });

    // 7. Resource Wise Actual vs Trailing Velocity Trends â€” per-employee panels
    this.service.getResourceVelocityTrends(primaryProductId, sprints)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.resourceVelocity = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.resourceVelocity = { state: 'empty', panels: [], legend: [] }; return; }
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

    // 8. Resource Completion Trends â€” one member chart for the selected team
    this.service.getResourceCompletion(primaryProductId, sprints)
      .pipe(catchError(() => of(null)))
      .subscribe(rows => {
        if (rows === null) { this.resourceCompletion = { state: 'error', panels: [], legend: [] }; return; }
        if (rows.length === 0) { this.resourceCompletion = { state: 'empty', panels: [], legend: [] }; return; }

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

  private setAllLoading(): void {
    this.velocity = { state: 'loading', options: null };
    this.headcountTrend = { state: 'loading', options: null };
    this.completionTrend = { state: 'loading', options: null };
    this.plannedDeliveredItemsTrend = { state: 'loading', options: null };
    this.rolloverRolloverPointsTrend = { state: 'loading', options: null };
    this.velocityAssignedDeliveredTrend = { state: 'loading', options: null };
    this.rollover = { state: 'loading', options: null };
    this.teamRollover = { state: 'loading', options: null };
    this.resourceCompletion = { state: 'loading', panels: [], legend: [] };
    this.resourceCompletionRows = [];
    this.resourceCompletionTeams = [];
    this.teamVelocity = { state: 'loading', panels: [], legend: [] };
    this.teamCompletion = { state: 'loading', panels: [], legend: [] };
    this.velocityHeadcount = { state: 'loading', panels: [], legend: [] };
    this.resourceVelocity = { state: 'loading', panels: [], legend: [] };
  }

  private setAllEmpty(): void {
    this.velocity = { state: 'empty', options: null };
    this.headcountTrend = { state: 'empty', options: null };
    this.completionTrend = { state: 'empty', options: null };
    this.plannedDeliveredItemsTrend = { state: 'empty', options: null };
    this.rolloverRolloverPointsTrend = { state: 'empty', options: null };
    this.velocityAssignedDeliveredTrend = { state: 'empty', options: null };
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
}


