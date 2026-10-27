import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ChartOptions, ChartState } from '../chart-card/chart-card.component';
import { LoadingStateComponent } from '../loading-state/loading-state.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ErrorStateComponent } from '../error-state/error-state.component';

export interface ChartPanel {
  title: string;
  options: ChartOptions;
}

/**
 * Renders a scrollable grid of small-multiple charts (per team / per resource),
 * reproducing the Power BI panel layout. Internal scroll only — never causes
 * page-level horizontal overflow.
 */
@Component({
  selector: 'app-chart-panel-grid',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent
  ],
  template: `
    <div class="chart-view-backdrop" *ngIf="expandedPanel" (click)="closeView()" aria-hidden="true"></div>
    <div class="panel-card card" [class.span-2]="span === 2">
      <header class="panel-card-header">
        <h3>
          <span *ngIf="index" class="index">{{ index }}.</span> {{ title }}
        </h3>
        <div class="legend" *ngIf="state === 'ready' && legend.length">
          <span class="legend-item" *ngFor="let l of legend">
            <i class="dot" [style.background]="l.color"></i>{{ l.name }}
          </span>
        </div>
      </header>

      <div class="panel-card-body">
        <app-loading-state *ngIf="state === 'loading'" [height]="220"></app-loading-state>
        <app-error-state *ngIf="state === 'error'" [height]="220" (retry)="retry.emit()"></app-error-state>
        <app-empty-state *ngIf="state === 'empty'" [height]="220" [message]="emptyMessage"></app-empty-state>

        <div class="panel-scroll" *ngIf="state === 'ready'"
             [class.horizontal]="horizontal"
             [style.--panel-min.px]="panelMinWidth">
          <div class="panel-tile" *ngFor="let p of panels" [class.expanded]="expandedPanel === p"
               [attr.role]="expandedPanel === p ? 'dialog' : null"
               [attr.aria-modal]="expandedPanel === p ? 'true' : null"
               [attr.aria-label]="expandedPanel === p ? p.title : null">
            <div class="panel-tile-header">
              <span class="panel-tile-title" [title]="p.title">{{ p.title }}</span>
              <button *ngIf="viewEnabled" type="button" class="view-button"
                      [attr.aria-expanded]="expandedPanel === p" (click)="toggleView(p)">
                {{ expandedPanel === p ? 'Close view' : 'View' }}
              </button>
            </div>
            <apx-chart
              [series]="p.options.series"
              [chart]="renderedOptions(p.options).chart"
              [xaxis]="p.options.xaxis!"
              [yaxis]="p.options.yaxis!"
              [dataLabels]="p.options.dataLabels!"
              [stroke]="p.options.stroke!"
              [markers]="p.options.markers!"
              [grid]="p.options.grid!"
              [legend]="p.options.legend!"
              [plotOptions]="p.options.plotOptions!"
              [tooltip]="p.options.tooltip!"
              [fill]="p.options.fill!"
              [colors]="p.options.colors!">
            </apx-chart>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './chart-panel-grid.component.scss'
})
export class ChartPanelGridComponent {
  @Input() title = '';
  @Input() index?: number;
  @Input() state: ChartState = 'loading';
  @Input() panels: ChartPanel[] = [];
  @Input() legend: { name: string; color: string }[] = [];
  @Input() span: 1 | 2 = 2;
  @Input() panelMinWidth = 240;
  /** When true, tiles lay out in 2 rows and scroll horizontally (2x2 view). */
  @Input() horizontal = false;
  @Input() emptyMessage = 'No data available for the selected range.';
  @Input() viewEnabled = false;
  @Output() retry = new EventEmitter<void>();

  expandedPanel: ChartPanel | null = null;
  private readonly expandedOptionsCache = new WeakMap<ChartOptions, ChartOptions>();

  renderedOptions(options: ChartOptions): ChartOptions {
    if (this.expandedPanel?.options !== options) { return options; }
    const cached = this.expandedOptionsCache.get(options);
    if (cached) { return cached; }
    const height = typeof window === 'undefined' ? 520 : Math.max(320, Math.floor(window.innerHeight * 0.72));
    const expandedOptions = { ...options, chart: { ...options.chart, height } };
    this.expandedOptionsCache.set(options, expandedOptions);
    return expandedOptions;
  }

  toggleView(panel: ChartPanel): void {
    this.expandedPanel = this.expandedPanel === panel ? null : panel;
  }

  closeView(): void {
    this.expandedPanel = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeView();
  }
}
