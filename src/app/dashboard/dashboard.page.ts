import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { Exercise } from '../models';
import { ARTICLES, dailyFeaturedExercise } from './dashboard-content';

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
  private featuredDay = '';
  private rotationTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly flowData: FlowDataService, private readonly changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe(language => {
      this.language = language;
      this.loadExercise();
    });
  }

  loadExercise(): void {
    clearTimeout(this.rotationTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.featuredDay = now.toDateString();
    this.rotationTimer = setTimeout(() => this.loadExercise(), midnight.getTime() - now.getTime());
    this.dataSubscription?.unsubscribe();
    this.loading = true;
    this.failed = false;
    this.exercise = null;
    this.dataSubscription = this.flowData.load(this.language).subscribe({
      next: bundle => {
        this.exercise = dailyFeaturedExercise(bundle.exercises);
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
    clearTimeout(this.rotationTimer);
    this.languageSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  ionViewWillEnter(): void {
    if (document.visibilityState === 'visible' && this.featuredDay !== new Date().toDateString()) {
      this.loadExercise();
    }
  }
}