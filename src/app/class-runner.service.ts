import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ClassRunSource, ClassRunState, FlowPlan, RunExercise, RunnerSettings } from './models';
import { FlowPlanService } from './flow-plan.service';

const RUNNER_SETTINGS_KEY = 'flowsmith-runner-settings';

@Injectable({ providedIn: 'root' })
export class ClassRunnerService {
  private readonly settingsSubject = new BehaviorSubject<RunnerSettings>(this.readSettings());
  readonly settings$ = this.settingsSubject.asObservable();

  private readonly stateSubject = new BehaviorSubject<ClassRunState>(this.createState(this.unloadedPlan(), 'planner'));
  readonly state$ = this.stateSubject.asObservable();

  private intervalId?: ReturnType<typeof setInterval>;

  constructor(private readonly flowPlanService: FlowPlanService) {}

  get settings(): RunnerSettings {
    return this.settingsSubject.value;
  }

  get state(): ClassRunState {
    return this.stateSubject.value;
  }

  updateSettings(settings: RunnerSettings): void {
    localStorage.setItem(RUNNER_SETTINGS_KEY, JSON.stringify(settings));
    this.settingsSubject.next(settings);
  }

  loadPlan(plan: FlowPlan, source: ClassRunSource): void {
    this.clearTimer();
    this.stateSubject.next(this.createState(this.flowPlanService.clonePlan(plan), source));
  }

  start(): void {
    const state = this.state;
    if (state.status === 'completed' || state.exercises.length === 0) {
      return;
    }

    this.stateSubject.next({ ...state, status: 'running', completedExerciseId: undefined });
    this.startTimer();
  }

  pause(): void {
    if (this.state.status !== 'running') {
      return;
    }

    this.clearTimer();
    this.stateSubject.next({ ...this.state, status: 'paused' });
  }

  stop(): void {
    this.clearTimer();
    this.stateSubject.next(this.createState(this.state.plan, this.state.source));
  }

  next(): void {
    const state = this.state;
    if (state.currentIndex >= state.exercises.length - 1) {
      this.completeRun();
      return;
    }

    this.stateSubject.next({
      ...state,
      currentIndex: state.currentIndex + 1,
      currentExerciseElapsedSeconds: 0,
      completedExerciseId: undefined,
    });
  }

  previous(): void {
    const state = this.state;
    if (state.currentIndex <= 0) {
      this.stateSubject.next({ ...state, currentExerciseElapsedSeconds: 0, completedExerciseId: undefined });
      return;
    }

    this.stateSubject.next({
      ...state,
      currentIndex: state.currentIndex - 1,
      currentExerciseElapsedSeconds: 0,
      completedExerciseId: undefined,
    });
  }

  restartExercise(): void {
    this.stateSubject.next({ ...this.state, currentExerciseElapsedSeconds: 0, completedExerciseId: undefined });
  }

  pauseOnRouteLeave(): void {
    if (this.state.status === 'running') {
      this.pause();
    }
  }

  getCurrentExerciseRemainingSeconds(state = this.state): number {
    const current = state.exercises[state.currentIndex];
    if (!current) {
      return 0;
    }

    return Math.max(0, current.durationSeconds - state.currentExerciseElapsedSeconds);
  }

  getTotalDurationSeconds(state = this.state): number {
    return state.exercises.reduce((total, exercise) => total + exercise.durationSeconds, 0);
  }

  getTotalRemainingSeconds(state = this.state): number {
    const currentRemaining = this.getCurrentExerciseRemainingSeconds(state);
    const futureRemaining = state.exercises
      .slice(state.currentIndex + 1)
      .reduce((total, exercise) => total + exercise.durationSeconds, 0);

    return currentRemaining + futureRemaining;
  }

  getProgress(state = this.state): number {
    const total = this.getTotalDurationSeconds(state);
    return total > 0 ? Math.min(1, state.elapsedSeconds / total) : 0;
  }

  private startTimer(): void {
    this.clearTimer();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    const state = this.state;
    const current = state.exercises[state.currentIndex];
    if (state.status !== 'running' || !current) {
      return;
    }

    const nextExerciseElapsedSeconds = state.currentExerciseElapsedSeconds + 1;
    const nextElapsedSeconds = state.elapsedSeconds + 1;

    if (nextExerciseElapsedSeconds >= current.durationSeconds) {
      const completedExerciseId = current.id;
      this.stateSubject.next({
        ...state,
        currentExerciseElapsedSeconds: current.durationSeconds,
        elapsedSeconds: nextElapsedSeconds,
        completedExerciseId,
      });

      if (this.settings.autoAdvanceOnExerciseEnd) {
        this.next();
        if (this.state.status !== 'completed') {
          this.stateSubject.next({ ...this.state, status: 'running', completedExerciseId });
        }
      } else {
        this.pause();
        this.stateSubject.next({ ...this.state, completedExerciseId });
      }

      return;
    }

    this.stateSubject.next({
      ...state,
      currentExerciseElapsedSeconds: nextExerciseElapsedSeconds,
      elapsedSeconds: nextElapsedSeconds,
      completedExerciseId: undefined,
    });
  }

  private completeRun(): void {
    this.clearTimer();
    this.stateSubject.next({
      ...this.state,
      status: 'completed',
      currentExerciseElapsedSeconds: this.state.exercises[this.state.currentIndex]?.durationSeconds ?? 0,
    });
  }

  private clearTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private createState(plan: FlowPlan, source: ClassRunSource): ClassRunState {
    return {
      source,
      plan,
      exercises: this.flattenPlan(plan),
      currentIndex: 0,
      currentExerciseElapsedSeconds: 0,
      elapsedSeconds: 0,
      status: 'ready',
    };
  }

  private unloadedPlan(): FlowPlan {
    const currentPlan = this.flowPlanService.currentPlan;
    return { ...currentPlan, segments: [] };
  }

  private flattenPlan(plan: FlowPlan): RunExercise[] {
    return plan.segments.flatMap((segment) =>
      segment.items.map((item) => ({
        id: item.id,
        exerciseId: item.exerciseId,
        segmentId: segment.id,
        segmentName: segment.name,
        durationSeconds: Math.max(1, Math.round(item.durationMinutes * 60)),
        notes: item.notes,
        apparatus: item.apparatus,
      }))
    );
  }

  private readSettings(): RunnerSettings {
    const fallback: RunnerSettings = {
      autoAdvanceOnExerciseEnd: true,
      exerciseEndSound: false,
      exerciseEndHaptics: false,
    };
    const stored = localStorage.getItem(RUNNER_SETTINGS_KEY);

    if (!stored) {
      return fallback;
    }

    try {
      return { ...fallback, ...JSON.parse(stored) };
    } catch {
      return fallback;
    }
  }
}
