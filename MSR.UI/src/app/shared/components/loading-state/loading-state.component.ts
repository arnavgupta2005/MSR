import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading" [style.height.px]="height">
      <div class="spinner"></div>
      <span *ngIf="message">{{ message }}</span>
    </div>
  `,
  styles: [`
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      min-height: 120px;
      color: var(--color-text-muted);
      font-size: var(--fs-sm);
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class LoadingStateComponent {
  @Input() message = 'Loading…';
  @Input() height = 120;
}
