import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { ClassRunState, Contraindication, Exercise, PilatesDataBundle, RunExercise } from '../models';

@Component({
  selector: 'app-run',
  templateUrl: 'run.page.html',
  styleUrls: ['run.page.scss'],
  standalone: false,
})
export class RunPage implements OnInit, OnDestroy {
  state = this.classRunner.state;
  bundle: PilatesDataBundle | null = null;
  isLoading = true;
  errorMessage = '';
  completionMessage = '';

  private stateSubscription?: Subscription;
  private languageSubscription?: Subscription;
  private dataSubscription?: Subscription;
  private lastCompletedExerciseId = '';

  constructor(
    readonly classRunner: ClassRunnerService,
    private readonly flowData: FlowDataService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly alertController: AlertController,
    private readonly translate: TranslateService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.stateSubscription = this.classRunner.state$.subscribe((state) => {
      this.state = state;
      if (state.completedExerciseId && state.completedExerciseId !== this.lastCompletedExerciseId) {
        this.announceExerciseComplete(state.completedExerciseId);
      } else if (!state.completedExerciseId) {
        this.completionMessage = '';
        this.lastCompletedExerciseId = '';
      }
      this.changeDetector.detectChanges();
    });

    this.languageSubscription = this.flowData.language$.subscribe((language) => {
      this.loadBundle(language);
    });
  }

  ngOnDestroy(): void {
    this.classRunner.pauseOnRouteLeave();
    this.stateSubscription?.unsubscribe();
    this.languageSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  private loadBundle(language: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = this.flowData.load(language).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.bundle = null;
        this.isLoading = false;
        this.errorMessage = this.translate.instant('RUN.LOAD_ERROR');
        this.changeDetector.detectChanges();
      },
    });
  }

  get currentRunExercise(): RunExercise | undefined {
    return this.state.exercises[this.state.currentIndex];
  }

  get nextRunExercise(): RunExercise | undefined {
    return this.state.exercises[this.state.currentIndex + 1];
  }

  get currentExercise(): Exercise | undefined {
    const current = this.currentRunExercise;
    return current && this.bundle ? this.flowData.findExercise(this.bundle, current.exerciseId) : undefined;
  }

  get nextExercise(): Exercise | undefined {
    const next = this.nextRunExercise;
    return next && this.bundle ? this.flowData.findExercise(this.bundle, next.exerciseId) : undefined;
  }

  get warnings(): Contraindication[] {
    const current = this.currentRunExercise;
    return current && this.bundle
      ? this.flowData.getWarnings(this.bundle, current.exerciseId, this.state.plan.selectedConditionIds)
      : [];
  }

  get exerciseRemainingSeconds(): number {
    return this.classRunner.getCurrentExerciseRemainingSeconds(this.state);
  }

  get totalRemainingSeconds(): number {
    return this.classRunner.getTotalRemainingSeconds(this.state);
  }

  get totalDurationSeconds(): number {
    return this.classRunner.getTotalDurationSeconds(this.state);
  }

  get progressPercent(): number {
    return Math.round(this.classRunner.getProgress(this.state) * 100);
  }

  get isRunning(): boolean {
    return this.state.status === 'running';
  }

  get isPaused(): boolean {
    return this.state.status === 'paused';
  }

  get isCompleted(): boolean {
    return this.state.status === 'completed';
  }

  get hasClass(): boolean {
    return this.state.exercises.length > 0;
  }

  formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  getExerciseName(runExercise: RunExercise | undefined): string {
    if (!runExercise || !this.bundle) {
      return this.translate.instant('RUN.READY');
    }

    return this.flowData.findExercise(this.bundle, runExercise.exerciseId)?.name ?? runExercise.exerciseId;
  }

  get currentBreathingCue(): string {
    return this.currentExercise?.breathing || this.translate.instant('RUN.DEFAULT_BREATHING_CUE');
  }

  get apparatusLabel(): string {
    return this.currentRunExercise?.apparatus || this.translate.instant('COMMON.MAT');
  }

  private announceExerciseComplete(completedExerciseId: string): void {
    this.lastCompletedExerciseId = completedExerciseId;
    const completedName = this.getExerciseName(this.state.exercises.find((exercise) => exercise.id === completedExerciseId));
    this.completionMessage = this.isCompleted
      ? this.translate.instant('RUN.EXERCISE_COMPLETE', { name: completedName })
      : this.translate.instant('RUN.EXERCISE_COMPLETE_NEXT', { name: completedName, next: this.getExerciseName(this.nextRunExercise) });

    if (this.classRunner.settings.exerciseEndHaptics && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 70, 120]);
    }

    if (this.classRunner.settings.exerciseEndSound) {
      this.playCompletionTone();
    }
  }

  private playCompletionTone(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
    } catch {
      // Audio feedback is optional and can be unavailable in a browser context.
    }
  }

  async confirmRestartExercise(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('RUN.RESTART_EXERCISE_CONFIRM_HEADER'),
      message: this.translate.instant('RUN.RESTART_EXERCISE_CONFIRM_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        { text: this.translate.instant('RUN.RESTART'), role: 'destructive', handler: () => this.classRunner.restartExercise() },
      ],
    });
    await alert.present();
  }

  async confirmStopClass(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('RUN.STOP_CLASS_CONFIRM_HEADER'),
      message: this.translate.instant('RUN.STOP_CLASS_CONFIRM_MESSAGE'),
      buttons: [
        { text: this.translate.instant('RUN.KEEP_RUNNING'), role: 'cancel' },
        { text: this.translate.instant('RUN.STOP_CLASS'), role: 'destructive', handler: () => this.classRunner.stop() },
      ],
    });
    await alert.present();
  }

  restartClass(): void {
    this.classRunner.stop();
  }

  returnToPlanner(): void {
    this.router.navigateByUrl('/home');
  }

  browseTemplates(): void {
    this.router.navigateByUrl('/templates');
  }

  retryLoad(): void {
    this.loadBundle(this.flowData.currentLanguage);
  }
}
