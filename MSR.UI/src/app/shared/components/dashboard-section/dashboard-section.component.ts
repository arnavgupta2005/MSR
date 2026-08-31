import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-dashboard-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="section card">
      <header class="section-header">
        <h2 class="section-title">
          <span *ngIf="index" class="index">{{ index }}.</span> {{ title }}
        </h2>
        <div class="section-filter">
          <ng-content select="[filter]"></ng-content>
        </div>
      </header>
      <div class="section-body">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styles: [`
    .section {
      padding: var(--space-6);
      margin-bottom: var(--space-6);
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      margin-bottom: var(--space-5);
    }
    .section-title .index { color: var(--color-primary); }
    .section-filter { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
  `]
})
export class DashboardSectionComponent {
  @Input() title = '';
  @Input() index?: number;
}
