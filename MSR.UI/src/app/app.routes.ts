import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/monthly-sprint-review/monthly-sprint-review.component')
        .then(m => m.MonthlySprintReviewComponent)
  },
  {
    path: 'development',
    loadComponent: () =>
      import('./features/development/development-dashboard/development-dashboard.component')
        .then(m => m.DevelopmentDashboardComponent)
  },
  {
    path: 'qa',
    loadComponent: () =>
      import('./features/qa/qa-dashboard/qa-dashboard.component')
        .then(m => m.QaDashboardComponent)
  },
  {
    path: 'feature-release',
    loadComponent: () =>
      import('./features/feature-release/feature-release-dashboard/feature-release-dashboard.component')
        .then(m => m.FeatureReleaseDashboardComponent)
  },
  { path: '**', redirectTo: '' }
];
