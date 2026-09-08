import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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

  constructor(
    private readonly flowData: FlowDataService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe((language) => this.loadBundle(language));
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
  }

  private loadBundle(language: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.flowData.load(language).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.errorMessage = 'FlowSmith could not load the Pilates library.';
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  get filteredExercises(): Exercise[] {
    return this.flowData.searchExercises(this.bundle, this.searchTerm, 60);
  }

  openExercise(exercise: Exercise): void {
    this.selectedExercise = exercise;
  }

  closeExercise(): void {
    this.selectedExercise = null;
  }

  getExerciseInstructions(exercise: Exercise | null): string[] {
    return (exercise?.instructions ?? []).flatMap((step) => Array.isArray(step) ? step : [step]);
  }

  trackExercise(_: number, exercise: Exercise): string {
    return exercise.id;
  }
}
