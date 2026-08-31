import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { FEATURE_PRODUCTS } from '../../../core/config/report.config';
import { FeatureRelease } from '../../../core/models/api-models';
import { FeatureReleaseService } from '../../../core/services/feature-release.service';

import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-feature-release-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingStateComponent,
    EmptyStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './feature-release-dashboard.component.html',
  styleUrl: './feature-release-dashboard.component.scss'
})
export class FeatureReleaseDashboardComponent implements OnInit {
  private readonly service = inject(FeatureReleaseService);

  readonly products = FEATURE_PRODUCTS;

  selectedProduct = FEATURE_PRODUCTS[0].key;
  state: LoadState = 'loading';
  rows: FeatureRelease[] = [];

  ngOnInit(): void {
    this.load();
  }

  onProductChange(event: Event): void {
    this.selectedProduct = (event.target as HTMLSelectElement).value;
    this.load();
  }

  get heading(): string {
    return `${this.selectedProduct} Feature Release`;
  }

  load(): void {
    this.state = 'loading';
    this.service
      .getFeatureReleases(this.selectedProduct)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res === null) { this.state = 'error'; this.rows = []; return; }
        this.rows = res;
        this.state = res.length === 0 ? 'empty' : 'ready';
      });
  }

  sprintLabel(n: number | null): string {
    return n === null || n === undefined ? '-' : `Sprint ${n}`;
  }
}
