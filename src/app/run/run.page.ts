import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { FlowPlanService } from '../flow-plan.service';
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

  private stateSubscription?: Subscription;
  private dataSubscription?: Subscription;

  constructor(
    readonly classRunner: ClassRunnerService,
    private readonly flowData: FlowDataService,
    private readonly flowPlanService: FlowPlanService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (this.classRunner.state.exercises.length === 0) {
      this.classRunner.loadPlan(this.flowPlanService.currentPlan, 'planner');
    }

    this.stateSubscription = this.classRunner.state$.subscribe((state) => {
      this.state = state;
      this.changeDetector.detectChanges();
    });

    this.dataSubscription = this.flowData.language$.subscribe((language) => {
      this.flowData.load(language).subscribe((bundle) => {
        this.bundle = bundle;
        this.changeDetector.detectChanges();
      });
    });
  }

  ngOnDestroy(): void {
    this.classRunner.pauseOnRouteLeave();
    this.stateSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
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

  formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  getExerciseName(runExercise: RunExercise | undefined): string {
    if (!runExercise || !this.bundle) {
      return 'Ready';
    }

    return this.flowData.findExercise(this.bundle, runExercise.exerciseId)?.name ?? runExercise.exerciseId;
  }
}
