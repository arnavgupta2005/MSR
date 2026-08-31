import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type KpiTheme = 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'red';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-card">
      <div class="icon" [attr.data-theme]="theme">
        <ng-content select="[icon]"></ng-content>
      </div>
      <div class="body">
        <span class="label">{{ label }}</span>
        <div class="value-row">
          <span class="value" *ngIf="!unavailable">{{ displayValue }}</span>
          <span class="value na" *ngIf="unavailable">—</span>
        </div>
        <span class="unit" *ngIf="unit && !unavailable">{{ unit }}</span>
        <span class="unit na" *ngIf="unavailable">No data</span>
      </div>
    </div>
  `,
  styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: number | null = null;
  @Input() unit = '';
  @Input() theme: KpiTheme = 'blue';
  /** When true, the metric has no backend data and shows a neutral state. */
  @Input() unavailable = false;
  @Input() isPercentage = false;

  get displayValue(): string {
    if (this.value === null || this.value === undefined) {
      return '—';
    }
    if (this.isPercentage) {
      return `${Math.round(this.value)}%`;
    }
    return this.value.toLocaleString();
  }
}
