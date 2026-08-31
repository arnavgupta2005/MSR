import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { SPRINT_OPTIONS, SprintOption } from '../../../core/config/report.config';

@Component({
  selector: 'app-sprint-multi-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="multi-select" (click)="$event.stopPropagation()">
      <label *ngIf="label" class="inline-label">{{ label }}</label>
      <div class="control" [class.open]="open" (click)="toggle()">
        <span class="summary">{{ summary }}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      <div class="panel" *ngIf="open">
        <label class="option select-all">
          <input type="checkbox" [checked]="allSelected" (change)="toggleAll()" />
          <span>Select All</span>
        </label>
        <div class="divider"></div>
        <div class="options-scroll">
          <label class="option" *ngFor="let s of sprints">
            <input
              type="checkbox"
              [checked]="isSelected(s.sprintNumber)"
              (change)="toggleSprint(s.sprintNumber)" />
            <span>{{ s.label }}</span>
          </label>
        </div>
        <div class="divider"></div>
        <button class="clear-btn" type="button" (click)="clear()">Clear selection</button>
      </div>
    </div>
  `,
  styleUrl: './sprint-multi-select.component.scss'
})
export class SprintMultiSelectComponent {
  @Input() sprints: SprintOption[] = SPRINT_OPTIONS;
  @Input() selected: number[] = [];
  @Input() label = '';
  @Output() selectedChange = new EventEmitter<number[]>();

  open = false;

  get allSelected(): boolean {
    return this.selected.length === this.sprints.length && this.sprints.length > 0;
  }

  get summary(): string {
    if (this.selected.length === 0) {
      return 'Select sprints';
    }
    if (this.allSelected) {
      return 'All Sprints';
    }
    if (this.selected.length === 1) {
      return `Sprint ${this.selected[0]}`;
    }
    return `${this.selected.length} sprints selected`;
  }

  toggle(): void {
    this.open = !this.open;
  }

  isSelected(n: number): boolean {
    return this.selected.includes(n);
  }

  toggleSprint(n: number): void {
    const next = this.isSelected(n)
      ? this.selected.filter(x => x !== n)
      : [...this.selected, n].sort((a, b) => a - b);
    this.emit(next);
  }

  toggleAll(): void {
    this.emit(this.allSelected ? [] : this.sprints.map(s => s.sprintNumber));
  }

  clear(): void {
    this.emit([]);
  }

  private emit(next: number[]): void {
    this.selected = next;
    this.selectedChange.emit(next);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.open = false;
  }
}
