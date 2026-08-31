import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductOption } from '../../../core/config/report.config';

@Component({
  selector: 'app-product-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="product-selector">
      <label class="field-label" [attr.for]="'product-select'">{{ label }}</label>
      <select
        id="product-select"
        class="form-select"
        [value]="selectedId"
        (change)="onChange($event)">
        <option *ngFor="let p of products" [value]="p.id">{{ p.name }}</option>
      </select>
    </div>
  `,
  styles: [`
    .product-selector { display: flex; flex-direction: column; align-items: flex-start; }
    .product-selector .form-select {
      width: auto;
      min-width: 220px;
      max-width: 260px;
    }
  `]
})
export class ProductSelectorComponent {
  @Input() products: ProductOption[] = [];
  @Input() selectedId!: number;
  @Input() label = 'Product';
  @Output() selectedIdChange = new EventEmitter<number>();

  onChange(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.selectedIdChange.emit(id);
  }
}
