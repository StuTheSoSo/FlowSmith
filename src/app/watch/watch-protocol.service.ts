import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ClassRunState, PilatesDataBundle, RunExercise } from '../models';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import {
  WATCH_PROTOCOL_VERSION,
  WatchAppearance,
  WatchCommandAck,
  WatchCommandMessage,
  WatchCommandRejection,
  WatchExerciseState,
  WatchStateMessage,
  isWatchCommandMessage,
} from './watch-protocol';

interface ObservedRunnerState {
  sessionId: string;
  currentExerciseEndsAt?: string;
  status: string;
  currentIndex: number;
  currentDurationSeconds: number;
  currentExerciseElapsedSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class WatchProtocolService implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<WatchStateMessage | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  private bundle: PilatesDataBundle | null = null;
  private lastObservedState?: ObservedRunnerState;
  private lastPublishedState?: ObservedRunnerState;
  private processedSessionId = '';
  private commandRevision = 0;
  private readonly processedMessageIds = new Set<string>();
  private readonly themeObserver = new MutationObserver(() => this.publishState(this.classRunner.state, true));

  constructor(
    private readonly classRunner: ClassRunnerService,
    flowData: FlowDataService
  ) {
    this.classRunner.state$.subscribe((state) => this.publishState(state));
    flowData.data$.subscribe((bundle) => {
      this.bundle = bundle;
      this.publishState(this.classRunner.state, true);
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  ngOnDestroy(): void {
    this.themeObserver.disconnect();
  }

  get latestState(): WatchStateMessage | null {
    return this.stateSubject.value;
  }

  handleCommand(candidate: unknown): WatchCommandAck {
    if (!isWatchCommandMessage(candidate)) {
      return this.reject('', '', 'invalid-message');
    }
    if (candidate.protocolVersion !== WATCH_PROTOCOL_VERSION) {
      return this.reject(candidate.sessionId, candidate.messageId, 'unsupported-protocol');
    }
    if (!this.hasActiveSession() || candidate.sessionId !== this.classRunner.currentSessionId) {
      return this.reject(candidate.sessionId, candidate.messageId, 'unknown-session');
    }

    this.resetProcessedCommandsForSession(candidate.sessionId);
    if (this.processedMessageIds.has(candidate.messageId)) {
      return this.reject(candidate.sessionId, candidate.messageId, 'duplicate-command');
    }
    if (candidate.command !== 'requestState' && candidate.baseRevision !== undefined &&
      (candidate.baseRevision < this.commandRevision || candidate.baseRevision > this.classRunner.currentRevision)) {
      return this.reject(candidate.sessionId, candidate.messageId, 'stale-command');
    }
    if (!this.canApply(candidate)) {
      return this.reject(candidate.sessionId, candidate.messageId, 'invalid-state');
    }

    this.applyCommand(candidate);
    this.processedMessageIds.add(candidate.messageId);
    this.publishState(this.classRunner.state, true);
    return this.ack(candidate.sessionId, candidate.messageId, true);
  }

  private publishState(state: ClassRunState, force = false): void {
    if (!state.exercises.length) {
      this.lastObservedState = undefined;
      this.lastPublishedState = undefined;
      this.stateSubject.next(null);
      return;
    }

    const observed: ObservedRunnerState = {
      sessionId: this.classRunner.currentSessionId,
      currentExerciseEndsAt: this.classRunner.currentExerciseEndsAt,
      status: state.status,
      currentIndex: state.currentIndex,
      currentDurationSeconds: state.exercises[state.currentIndex]?.durationSeconds ?? 0,
      currentExerciseElapsedSeconds: state.currentExerciseElapsedSeconds,
    };
    const previouslyObserved = this.lastObservedState;
    this.lastObservedState = observed;

    const stateChanged = !this.lastPublishedState ||
      observed.sessionId !== this.lastPublishedState.sessionId ||
      observed.status !== this.lastPublishedState.status ||
      observed.currentExerciseEndsAt !== this.lastPublishedState.currentExerciseEndsAt ||
      observed.currentIndex !== this.lastPublishedState.currentIndex ||
      observed.currentDurationSeconds !== this.lastPublishedState.currentDurationSeconds ||
      (!!previouslyObserved && observed.currentExerciseElapsedSeconds < previouslyObserved.currentExerciseElapsedSeconds);

    if (stateChanged) this.commandRevision = this.classRunner.currentRevision;
    if (!force && !stateChanged) return;

    const now = new Date().toISOString();
    this.lastPublishedState = observed;
    this.stateSubject.next({
      type: 'runner.state',
      protocolVersion: WATCH_PROTOCOL_VERSION,
      sessionId: observed.sessionId,
      revision: this.classRunner.currentRevision,
      sentAt: now,
      updatedAt: now,
      currentExerciseEndsAt: observed.currentExerciseEndsAt,
      status: state.status,
      currentIndex: state.currentIndex,
      totalExercises: state.exercises.length,
      currentExercise: this.toExerciseState(state.exercises[state.currentIndex], this.classRunner.getCurrentExerciseRemainingSeconds(state)),
      nextExercise: this.toExerciseState(state.exercises[state.currentIndex + 1]),
      className: state.plan.name,
      appearance: this.readAppearance(),
    });
  }

  private readAppearance(): WatchAppearance {
    const style = getComputedStyle(document.documentElement);
    const color = (property: string, fallback: string) => style.getPropertyValue(property).trim() || fallback;
    return {
      accent: color('--ion-color-primary', '#2a8fa5'),
      background: color('--sp-bg-start', '#f3fbfd'),
      text: color('--sp-ink', '#0f172a'),
      secondaryText: color('--sp-ink-2', '#334155'),
      timerNormal: color('--sp-timer-normal', '#173c35'),
      timerWarning: color('--sp-timer-warning', '#8b5b13'),
      timerDanger: color('--sp-timer-danger', '#a42c40'),
    };
  }

  private toExerciseState(exercise: RunExercise | undefined, remainingSeconds?: number): WatchExerciseState | undefined {
    if (!exercise) return undefined;
    const name = this.bundle ? this.findExerciseName(exercise.exerciseId) : exercise.exerciseId;
    return {
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      name,
      remainingSeconds,
      durationSeconds: remainingSeconds === undefined ? undefined : exercise.durationSeconds,
    };
  }

  private findExerciseName(exerciseId: string): string {
    return this.bundle?.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
  }

  private hasActiveSession(): boolean {
    return this.classRunner.state.exercises.length > 0 && this.classRunner.state.status !== 'completed';
  }

  private canApply(message: WatchCommandMessage): boolean {
    const status = this.classRunner.state.status;
    switch (message.command) {
      case 'start':
      case 'resume':
        return status === 'ready' || status === 'setup' || status === 'paused';
      case 'pause':
        return status === 'running';
      case 'next':
      case 'previous':
        return status !== 'completed';
      case 'stop':
      case 'requestState':
        return true;
    }
  }

  private applyCommand(message: WatchCommandMessage): void {
    switch (message.command) {
      case 'start':
      case 'resume':
        this.classRunner.start();
        return;
      case 'pause':
        this.classRunner.pause();
        return;
      case 'next':
        this.classRunner.next();
        return;
      case 'previous':
        this.classRunner.previous();
        return;
      case 'stop':
        this.classRunner.stop();
        return;
      case 'requestState':
        return;
    }
  }

  private resetProcessedCommandsForSession(sessionId: string): void {
    if (sessionId === this.processedSessionId) return;
    this.processedSessionId = sessionId;
    this.processedMessageIds.clear();
  }

  private ack(sessionId: string, messageId: string, accepted: boolean, reason?: WatchCommandRejection): WatchCommandAck {
    return {
      type: 'runner.commandAck',
      protocolVersion: WATCH_PROTOCOL_VERSION,
      sessionId,
      messageId,
      accepted,
      revision: this.classRunner.currentRevision,
      sentAt: new Date().toISOString(),
      reason,
    };
  }

  private reject(sessionId: string, messageId: string, reason: WatchCommandRejection): WatchCommandAck {
    this.publishState(this.classRunner.state, true);
    return this.ack(sessionId, messageId, false, reason);
  }
}
