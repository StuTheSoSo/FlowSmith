import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { Exercise, PilatesDataBundle } from '../models';

@Component({
  selector: 'app-library',
  templateUrl: 'library.page.html',
  styleUrls: ['library.page.scss'],
  standalone: false,
})
export class LibraryPage implements OnInit, OnDestroy {
  bundle: PilatesDataBundle | null = null;
  selectedExercise: Exercise | null = null;
  searchTerm = '';
  isLoading = true;
  errorMessage = '';

  private languageSubscription?: Subscription;
  private dataSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private requestedExerciseId: string | null = null;

  constructor(
    private readonly flowData: FlowDataService,
    private readonly translate: TranslateService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      this.requestedExerciseId = params.get('exercise');
      this.selectedExercise = this.bundle && this.requestedExerciseId
        ? this.flowData.findExercise(this.bundle, this.requestedExerciseId) ?? null : null;
      this.changeDetector.detectChanges();
    });
    this.languageSubscription = this.flowData.language$.subscribe((language) => this.loadBundle(language));
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
  }

  private loadBundle(language: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.searchTerm = '';

    this.dataSubscription?.unsubscribe();
    this.dataSubscription = this.flowData.load(language).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        const selectedId = this.requestedExerciseId ?? this.selectedExercise?.id;
        if (selectedId) {
          this.selectedExercise = this.flowData.findExercise(bundle, selectedId) ?? null;
        }
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.bundle = null;
        this.errorMessage = this.translate.instant('LIBRARY.ERROR_BODY');
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  get filteredExercises(): Exercise[] {
    return this.flowData.searchExercises(this.bundle, this.searchTerm);
  }

  get totalExerciseCount(): number {
    return this.bundle?.exercises.length ?? 0;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  retryLoad(): void {
    this.loadBundle(this.flowData.currentLanguage);
  }

  openExercise(exercise: Exercise): void {
    this.selectedExercise = exercise;
  }

  closeExercise(): void {
    this.selectedExercise = null;
    if (this.requestedExerciseId) {
      this.requestedExerciseId = null;
      void this.router.navigate([], {
        relativeTo: this.route, queryParams: { exercise: null }, queryParamsHandling: 'merge', replaceUrl: true,
      });
    }
  }

  getExerciseInstructions(exercise: Exercise | null): string[] {
    return (exercise?.instructions ?? []).flatMap((step) => Array.isArray(step) ? step : [step]);
  }

  trackExercise(_: number, exercise: Exercise): string {
    return exercise.id;
  }
}
