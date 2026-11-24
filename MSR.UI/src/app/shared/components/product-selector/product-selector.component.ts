import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ProductChoice {
  id: string | number;
  name: string;
}

@Component({
  selector: 'app-product-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="product-selector">
      <span class="field-label">{{ label }}</span>
      <div class="product-checks" role="group" [attr.aria-label]="label">
        <label class="product-check" *ngIf="multiple && includeAllOption">
          <input
            type="checkbox"
            [checked]="allSelected"
            (click)="$event.preventDefault(); toggleAll()" />
          <span>{{ allOptionLabel }}</span>
        </label>
        <label class="product-check" *ngFor="let p of products">
          <input
            type="checkbox"
            [checked]="isSelected(p.id)"
            (click)="$event.preventDefault(); toggle(p.id)" />
          <span>{{ p.name }}</span>
        </label>
      </div>
    </div>
  `,
  styles: [`
    .product-selector {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .product-checks {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 28px;
    }

    .product-check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      cursor: pointer;
      font-size: var(--fs-base);
      font-weight: 500;
      color: var(--color-navy);
      white-space: nowrap;
      user-select: none;
    }

    .product-check input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--color-primary);
      cursor: pointer;
    }
  `]
})
export class ProductSelectorComponent {
  @Input() products: ProductChoice[] = [];
  @Input() label = 'Product';
  /** When true, more than one product can be checked. */
  @Input() multiple = false;
  @Input() includeAllOption = false;
  @Input() allOptionLabel = 'All Products';
  @Input() selectedId: string | number | null = null;
  @Input() selectedIds: Array<string | number> = [];
  @Output() selectedIdChange = new EventEmitter<string | number>();
  @Output() selectedIdsChange = new EventEmitter<Array<string | number>>();

  get allSelected(): boolean {
    return this.products.length > 0
      && this.products.every(product => this.selectedIds.some(id => id === product.id));
  }

  isSelected(id: string | number): boolean {
    if (this.multiple) {
      return this.selectedIds.some(value => value === id);
    }
    return this.selectedId === id;
  }

  toggle(id: string | number): void {
    if (this.multiple) {
      const next = this.isSelected(id)
        ? this.selectedIds.filter(value => value !== id)
        : [...this.selectedIds, id];
      this.selectedIdsChange.emit(next);
      return;
    }

    if (this.selectedId === id) {
      return;
    }
    this.selectedIdChange.emit(id);
  }

  toggleAll(): void {
    if (!this.multiple || !this.includeAllOption) {
      return;
    }
    this.selectedIdsChange.emit(this.allSelected ? [] : this.products.map(product => product.id));
  }
}
