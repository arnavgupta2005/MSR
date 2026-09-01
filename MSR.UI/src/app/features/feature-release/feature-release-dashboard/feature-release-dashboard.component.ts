import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { FEATURE_PRODUCTS } from '../../../core/config/report.config';
import { FeatureRelease } from '../../../core/models/api-models';
import { FeatureReleaseService } from '../../../core/services/feature-release.service';

import { SprintMultiSelectComponent } from '../../../shared/components/sprint-multi-select/sprint-multi-select.component';
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
    SprintMultiSelectComponent,
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

  // Custom sprint filters. Empty selection = no constraint from that filter.
  selectedPlanned: number[] = [];
  selectedActual: number[] = [];

  ngOnInit(): void {
    this.load();
  }

  onProductChange(event: Event): void {
    this.selectedProduct = (event.target as HTMLSelectElement).value;
    this.load();
  }

  onPlannedChange(sprints: number[]): void {
    this.selectedPlanned = sprints;
  }

  onActualChange(sprints: number[]): void {
    this.selectedActual = sprints;
  }

  get heading(): string {
    return `${this.selectedProduct} Feature Release`;
  }

  // Union of the two selections: rows whose planned sprint is selected OR whose
  // actual sprint is selected. When both filters are empty, show all rows.
  get filteredRows(): FeatureRelease[] {
    if (this.selectedPlanned.length === 0 && this.selectedActual.length === 0) {
      return this.rows;
    }
    return this.rows.filter(r =>
      (r.plannedSprint !== null && this.selectedPlanned.includes(r.plannedSprint)) ||
      (r.releasedSprint !== null && this.selectedActual.includes(r.releasedSprint))
    );
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
