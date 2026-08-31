import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ReportCard {
  title: string;
  description: string;
  route: string;
  theme: 'dev' | 'qa' | 'feature';
  icon: 'analytics' | 'shield' | 'calendar';
}

@Component({
  selector: 'app-monthly-sprint-review',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './monthly-sprint-review.component.html',
  styleUrl: './monthly-sprint-review.component.scss'
})
export class MonthlySprintReviewComponent {
  readonly reports: ReportCard[] = [
    {
      title: 'Development\nMSR Report',
      description: 'Sprint performance, velocity and completion trends across development teams.',
      route: '/development',
      theme: 'dev',
      icon: 'analytics'
    },
    {
      title: 'QA\nMSR Report',
      description: 'Quality metrics, rollover and delivery trends across QA teams.',
      route: '/qa',
      theme: 'qa',
      icon: 'shield'
    },
    {
      title: 'Feature Release\nMSR Report',
      description: 'Planned vs actual feature releases and reasons for delay.',
      route: '/feature-release',
      theme: 'feature',
      icon: 'calendar'
    }
  ];
}
