import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { Exercise } from '../models';
import { ARTICLES, FEATURED_EXERCISE_ID } from './dashboard-content';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit, OnDestroy {
  readonly articles = ARTICLES;
  readonly principles = ['BREATH', 'CONCENTRATION', 'CONTROL', 'CENTERING', 'PRECISION', 'FLOW'];
  exercise: Exercise | null = null;
  loading = true;
  failed = false;
  language = 'en';
  private languageSubscription?: Subscription;
  private dataSubscription?: Subscription;

  constructor(private readonly flowData: FlowDataService, private readonly changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe(language => {
      this.language = language;
      this.loadExercise();
    });
  }

  loadExercise(): void {
    this.dataSubscription?.unsubscribe();
    this.loading = true;
    this.failed = false;
    this.exercise = null;
    this.dataSubscription = this.flowData.load(this.language).subscribe({
      next: bundle => {
        this.exercise = this.flowData.findExercise(bundle, FEATURED_EXERCISE_ID) ?? null;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.failed = true;
        this.changeDetector.detectChanges();
      },
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }
}