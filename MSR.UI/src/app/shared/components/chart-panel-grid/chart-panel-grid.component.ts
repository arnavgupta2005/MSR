import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
             [style.--panel-min.px]="panelMinWidth">
          <div class="panel-tile" *ngFor="let p of panels">
            <span class="panel-tile-title" [title]="p.title">{{ p.title }}</span>
            <apx-chart
              [series]="p.options.series"
              [chart]="p.options.chart"
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
  @Input() emptyMessage = 'No data available for the selected range.';
  @Output() retry = new EventEmitter<void>();
}
