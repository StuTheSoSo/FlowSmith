import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { BehaviorSubject } from 'rxjs';
import { ClassRunSource, ClassRunState, FlowPlan, RunExercise, RunnerSettings, RunnerSnapshot } from './models';
import { FlowPlanService } from './flow-plan.service';

const RUNNER_SETTINGS_KEY = 'flowsmith-runner-settings';
const RUNNER_SNAPSHOT_KEY = 'flowsmith-runner-snapshot';
const RUNNER_SNAPSHOT_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class ClassRunnerService {
  private readonly settingsSubject = new BehaviorSubject<RunnerSettings>(this.readSettings());
  readonly settings$ = this.settingsSubject.asObservable();

  private readonly stateSubject = new BehaviorSubject<ClassRunState>(this.createState(this.unloadedPlan(), 'planner'));
  readonly state$ = this.stateSubject.asObservable();

  private timerId?: ReturnType<typeof setTimeout>;
  private runningSince?: number;
  private sessionId = this.createSessionId();
  private revision = 0;
  private lifecycleInitialized = false;
  private restorePromptPending = false;

  constructor(private readonly flowPlanService: FlowPlanService) {
    this.restoreSnapshot();
  }

  get settings(): RunnerSettings {
    return this.settingsSubject.value;
  }

  get state(): ClassRunState {
    return this.stateSubject.value;
  }

  get currentSessionId(): string {
    return this.sessionId;
  }

  get currentRevision(): number {
    return this.revision;
  }

  get currentExerciseEndsAt(): string | undefined {
    if (this.state.status !== 'running' || this.runningSince === undefined) return undefined;
    return new Date(this.runningSince + this.getCurrentExerciseRemainingSeconds() * 1000).toISOString();
  }

  get hasRestorableSession(): boolean {
    return this.restorePromptPending;
  }

  updateSettings(settings: RunnerSettings): void {
    localStorage.setItem(RUNNER_SETTINGS_KEY, JSON.stringify(settings));
    this.settingsSubject.next(settings);
  }

  initializeLifecycle(): void {
    if (this.lifecycleInitialized) return;
    this.lifecycleInitialized = true;
    void App.addListener('appStateChange', ({ isActive }) => {
      this.reconcileTime();
      if (isActive) this.startTimer();
    });
  }

  loadPlan(plan: FlowPlan, source: ClassRunSource): void {
    this.clearTimer();
    this.runningSince = undefined;
    this.sessionId = this.createSessionId();
    this.revision = 0;
    this.restorePromptPending = false;
    this.emitState(this.createState(this.flowPlanService.clonePlan(plan), source));
  }

  resumeRestoredSession(): void {
    if (!this.restorePromptPending) return;
    this.restorePromptPending = false;
    this.start();
  }

  discardRestoredSession(): void {
    if (!this.restorePromptPending) return;
    this.restorePromptPending = false;
    this.stop();
  }

  start(): void {
    const state = this.state;
    if (state.status === 'running' || state.status === 'completed' || state.exercises.length === 0) return;

    this.runningSince = Date.now();
    this.emitState({ ...state, status: 'running', completedExerciseId: undefined });
    this.startTimer();
  }

  pause(): void {
    if (this.state.status !== 'running') return;
    this.reconcileTime();
    if (this.state.status !== 'running') return;

    this.clearTimer();
    this.runningSince = undefined;
    this.emitState({ ...this.state, status: 'paused' });
  }

  stop(): void {
    this.clearTimer();
    this.runningSince = undefined;
    this.sessionId = this.createSessionId();
    this.revision = 0;
    this.restorePromptPending = false;
    this.stateSubject.next(this.createState(this.state.plan, this.state.source));
    localStorage.removeItem(RUNNER_SNAPSHOT_KEY);
  }

  next(): void {
    this.reconcileTime();
    const state = this.state;
    if (state.currentIndex >= state.exercises.length - 1) {
      this.completeRun();
      return;
    }

    if (state.status === 'running') {
      this.runningSince = Date.now();
      this.startTimer();
    }
    this.emitState({
      ...state,
      currentIndex: state.currentIndex + 1,
      currentExerciseElapsedSeconds: 0,
      completedExerciseId: undefined,
    });
  }

  previous(): void {
    this.reconcileTime();
    const state = this.state;
    if (state.status === 'running') {
      this.runningSince = Date.now();
      this.startTimer();
    }
    if (state.currentIndex <= 0) {
      this.emitState({ ...state, currentExerciseElapsedSeconds: 0, completedExerciseId: undefined });
      return;
    }

    this.emitState({
      ...state,
      currentIndex: state.currentIndex - 1,
      currentExerciseElapsedSeconds: 0,
      completedExerciseId: undefined,
    });
  }

  restartExercise(): void {
    this.reconcileTime();
    if (this.state.status === 'running') {
      this.runningSince = Date.now();
      this.startTimer();
    }
    this.emitState({ ...this.state, currentExerciseElapsedSeconds: 0, completedExerciseId: undefined });
  }

  pauseOnRouteLeave(): void {
    if (this.state.status === 'running') this.pause();
  }

  getCurrentExerciseRemainingSeconds(state = this.state): number {
    const current = state.exercises[state.currentIndex];
    return current ? Math.max(0, current.durationSeconds - state.currentExerciseElapsedSeconds) : 0;
  }

  getTotalDurationSeconds(state = this.state): number {
    return state.exercises.reduce((total, exercise) => total + exercise.durationSeconds, 0);
  }

  getTotalRemainingSeconds(state = this.state): number {
    const currentRemaining = this.getCurrentExerciseRemainingSeconds(state);
    const futureRemaining = state.exercises.slice(state.currentIndex + 1)
      .reduce((total, exercise) => total + exercise.durationSeconds, 0);
    return currentRemaining + futureRemaining;
  }

  getProgress(state = this.state): number {
    const total = this.getTotalDurationSeconds(state);
    return total > 0 ? Math.min(1, state.elapsedSeconds / total) : 0;
  }

  private startTimer(): void {
    this.clearTimer();
    if (this.state.status !== 'running' || this.runningSince === undefined) return;
    const delay = Math.max(1, this.runningSince + 1000 - Date.now());
    this.timerId = setTimeout(() => {
      this.timerId = undefined;
      this.reconcileTime();
      this.startTimer();
    }, delay);
  }

  private reconcileTime(now = Date.now()): void {
    if (this.state.status !== 'running' || !this.runningSince) return;
    const elapsedSeconds = Math.floor((now - this.runningSince) / 1000);
    if (elapsedSeconds < 1) return;

    this.runningSince += elapsedSeconds * 1000;
    this.advanceBySeconds(elapsedSeconds);
  }

  private advanceBySeconds(seconds: number): void {
    let nextState = this.state;
    let remainingSeconds = seconds;

    while (remainingSeconds > 0 && nextState.status === 'running') {
      const current = nextState.exercises[nextState.currentIndex];
      if (!current) {
        this.completeRun();
        return;
      }

      const untilExerciseEnd = current.durationSeconds - nextState.currentExerciseElapsedSeconds;
      if (remainingSeconds < untilExerciseEnd) {
        nextState = {
          ...nextState,
          currentExerciseElapsedSeconds: nextState.currentExerciseElapsedSeconds + remainingSeconds,
          elapsedSeconds: nextState.elapsedSeconds + remainingSeconds,
          completedExerciseId: undefined,
        };
        remainingSeconds = 0;
        continue;
      }

      const completedExerciseId = current.id;
      nextState = {
        ...nextState,
        currentExerciseElapsedSeconds: current.durationSeconds,
        elapsedSeconds: nextState.elapsedSeconds + untilExerciseEnd,
        completedExerciseId,
      };
      remainingSeconds -= untilExerciseEnd;

      if (!this.settings.autoAdvanceOnExerciseEnd) {
        this.clearTimer();
        this.runningSince = undefined;
        this.emitState({ ...nextState, status: 'paused' });
        return;
      }
      if (nextState.currentIndex >= nextState.exercises.length - 1) {
        this.clearTimer();
        this.runningSince = undefined;
        this.emitState({ ...nextState, status: 'completed' });
        return;
      }
      nextState = {
        ...nextState,
        currentIndex: nextState.currentIndex + 1,
        currentExerciseElapsedSeconds: 0,
      };
    }

    this.emitState(nextState);
  }

  private completeRun(): void {
    this.clearTimer();
    this.runningSince = undefined;
    this.emitState({
      ...this.state,
      status: 'completed',
      currentExerciseElapsedSeconds: this.state.exercises[this.state.currentIndex]?.durationSeconds ?? 0,
    });
  }

  private clearTimer(): void {
    if (this.timerId !== undefined) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
  }

  private emitState(state: ClassRunState): void {
    this.revision += 1;
    this.stateSubject.next(state);
    if (state.status === 'completed') {
      localStorage.removeItem(RUNNER_SNAPSHOT_KEY);
      return;
    }
    this.persistSnapshot();
  }

  private persistSnapshot(): void {
    const snapshot: RunnerSnapshot = {
      version: RUNNER_SNAPSHOT_VERSION,
      sessionId: this.sessionId,
      revision: this.revision,
      state: this.state,
      runningSince: this.runningSince ? new Date(this.runningSince).toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(RUNNER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }

  private restoreSnapshot(): void {
    const stored = localStorage.getItem(RUNNER_SNAPSHOT_KEY);
    if (!stored) return;
    try {
      const snapshot = JSON.parse(stored) as RunnerSnapshot;
      if (snapshot.version !== RUNNER_SNAPSHOT_VERSION || !this.isValidState(snapshot.state)) {
        localStorage.removeItem(RUNNER_SNAPSHOT_KEY);
        return;
      }
      this.sessionId = snapshot.sessionId || this.createSessionId();
      const revision = snapshot.revision ?? 0;
      this.revision = Number.isInteger(revision) && revision >= 0 ? revision : 0;
      this.runningSince = snapshot.runningSince ? Date.parse(snapshot.runningSince) : undefined;
      this.stateSubject.next(snapshot.state);
      if (snapshot.state.status === 'running' && this.runningSince && Number.isFinite(this.runningSince)) {
        this.reconcileTime();
      }
      if (this.state.status === 'running') {
        this.runningSince = undefined;
        this.stateSubject.next({ ...this.state, status: 'paused' });
        this.persistSnapshot();
      }
      this.restorePromptPending = this.state.status === 'paused' && this.state.exercises.length > 0;
    } catch {
      localStorage.removeItem(RUNNER_SNAPSHOT_KEY);
    }
  }

  private isValidState(state: ClassRunState | undefined): state is ClassRunState {
    return !!state && Array.isArray(state.exercises) && Array.isArray(state.plan?.segments) &&
      Number.isInteger(state.currentIndex) && state.currentIndex >= 0 &&
      Number.isFinite(state.currentExerciseElapsedSeconds) && Number.isFinite(state.elapsedSeconds) &&
      ['ready', 'running', 'paused', 'completed'].includes(state.status);
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
    return plan.segments.flatMap((segment) => segment.items.map((item) => ({
      id: item.id,
      exerciseId: item.exerciseId,
      segmentId: segment.id,
      segmentName: segment.name,
      durationSeconds: Math.max(1, Math.round(item.durationMinutes * 60)),
      notes: item.notes,
      apparatus: item.apparatus,
    })));
  }

  private readSettings(): RunnerSettings {
    const fallback: RunnerSettings = {
      autoAdvanceOnExerciseEnd: true,
      exerciseEndSound: false,
      exerciseEndHaptics: false,
    };
    const stored = localStorage.getItem(RUNNER_SETTINGS_KEY);
    if (!stored) return fallback;
    try {
      return { ...fallback, ...JSON.parse(stored) };
    } catch {
      return fallback;
    }
  }

  private createSessionId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
