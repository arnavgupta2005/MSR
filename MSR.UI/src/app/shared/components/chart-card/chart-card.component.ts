import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexStroke,
  ApexMarkers,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexTooltip,
  ApexFill,
  NgApexchartsModule
} from 'ng-apexcharts';
import { LoadingStateComponent } from '../loading-state/loading-state.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ErrorStateComponent } from '../error-state/error-state.component';

export interface ChartOptions {
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  chart: ApexChart;
  xaxis?: ApexXAxis;
  yaxis?: ApexYAxis | ApexYAxis[];
  dataLabels?: ApexDataLabels;
  stroke?: ApexStroke;
  markers?: ApexMarkers;
  grid?: ApexGrid;
  legend?: ApexLegend;
  plotOptions?: ApexPlotOptions;
  tooltip?: ApexTooltip;
  fill?: ApexFill;
  colors?: string[];
  labels?: string[];
}

export type ChartState = 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent
  ],
  template: `
    <div class="chart-card card">
      <header class="chart-header">
        <h3>
          <span *ngIf="index" class="index">{{ index }}.</span> {{ title }}
          <span *ngIf="subtitle" class="subtitle">({{ subtitle }})</span>
        </h3>
      </header>

      <div class="chart-body">
        <app-loading-state *ngIf="state === 'loading'" [height]="chartHeight"></app-loading-state>
        <app-error-state
          *ngIf="state === 'error'"
          [height]="chartHeight"
          (retry)="retry.emit()"></app-error-state>
        <app-empty-state
          *ngIf="state === 'empty'"
          [height]="chartHeight"
          [message]="emptyMessage"></app-empty-state>

        <div class="chart-scroll" [class.scrollable]="scrollMinWidth > 0"
             [class.scrollable-y]="scrollMinHeight > 0"
             *ngIf="state === 'ready' && options">
          <div [style.min-width.px]="scrollMinWidth > 0 ? scrollMinWidth : null"
               [style.height.px]="scrollMinHeight > 0 ? scrollMinHeight : null">
            <apx-chart
              [series]="options.series"
              [chart]="options.chart"
              [xaxis]="options.xaxis!"
              [yaxis]="options.yaxis!"
              [dataLabels]="options.dataLabels!"
              [stroke]="options.stroke!"
              [markers]="options.markers!"
              [grid]="options.grid!"
              [legend]="options.legend!"
              [plotOptions]="options.plotOptions!"
              [tooltip]="options.tooltip!"
              [fill]="options.fill!"
              [colors]="options.colors!"
              [labels]="options.labels!">
            </apx-chart>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './chart-card.component.scss'
})
export class ChartCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() index?: number;
  @Input() state: ChartState = 'loading';
  @Input() options: ChartOptions | null = null;
  @Input() chartHeight = 240;
  @Input() emptyMessage = 'No data available for the selected range.';
  @Output() retry = new EventEmitter<void>();
  /** When > 0, enables internal horizontal scroll with this min chart width (px). */
  @Input() scrollMinWidth = 0;
  /** When > 0, enables internal vertical scroll and fixes the inner chart height (px). */
  @Input() scrollMinHeight = 0;
}
