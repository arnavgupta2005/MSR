import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty" [style.height.px]="height">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <path d="M3 9h18M8 4v5"></path>
      </svg>
      <span>{{ message }}</span>
    </div>
  `,
  styles: [`
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-height: 120px;
      color: var(--color-text-faint);
      font-size: var(--fs-sm);
      text-align: center;
      padding: var(--space-4);
    }
  `]
})
export class EmptyStateComponent {
  @Input() message = 'No data available.';
  @Input() height = 120;
}
