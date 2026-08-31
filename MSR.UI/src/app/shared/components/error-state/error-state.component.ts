import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error" [style.height.px]="height">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 8v4M12 16h.01"></path>
      </svg>
      <span>{{ message }}</span>
      <button *ngIf="showRetry" type="button" (click)="retry.emit()">Retry</button>
    </div>
  `,
  styles: [`
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      min-height: 120px;
      color: var(--color-danger);
      font-size: var(--fs-sm);
      text-align: center;
      padding: var(--space-4);
    }
    button {
      border: 1px solid var(--color-border-strong);
      background: var(--color-surface);
      color: var(--color-navy);
      border-radius: var(--radius-md);
      padding: 6px 16px;
      font-weight: 600;
      font-size: var(--fs-sm);
      transition: background 0.15s ease;
    }
    button:hover { background: var(--color-surface-alt); }
  `]
})
export class ErrorStateComponent {
  @Input() message = 'Something went wrong while loading data.';
  @Input() showRetry = true;
  @Input() height = 120;
  @Output() retry = new EventEmitter<void>();
}
