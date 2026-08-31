import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SPRINT_RANGE_OPTIONS, SprintRangeOption } from '../../../core/config/report.config';

@Component({
  selector: 'app-sprint-range-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="range-selector">
      <label *ngIf="label" class="inline-label">{{ label }}</label>
      <select class="form-select" (change)="onChange($event)">
        <option *ngFor="let r of ranges; let i = index" [value]="i" [selected]="i === selectedIndex">
          {{ r.label }}
        </option>
      </select>
    </div>
  `,
  styles: [`
    .range-selector { display: flex; align-items: center; gap: var(--space-3); }
    .inline-label { font-size: var(--fs-sm); font-weight: 600; color: var(--color-navy); white-space: nowrap; }
  `]
})
export class SprintRangeSelectorComponent {
  @Input() ranges: SprintRangeOption[] = SPRINT_RANGE_OPTIONS;
  @Input() selectedIndex = 3;
  @Input() label = '';
  @Output() rangeChange = new EventEmitter<SprintRangeOption>();

  onChange(event: Event): void {
    const idx = Number((event.target as HTMLSelectElement).value);
    this.selectedIndex = idx;
    this.rangeChange.emit(this.ranges[idx]);
  }
}
