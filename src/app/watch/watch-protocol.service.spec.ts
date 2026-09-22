import { BehaviorSubject } from 'rxjs';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { FlowPlan } from '../models';
import { FlowPlanService } from '../flow-plan.service';
import { WatchProtocolService } from './watch-protocol.service';

const plan: FlowPlan = {
  id: 'watch-test-plan',
  name: 'Watch test',
  clientName: '',
  goal: '',
  selectedConditionIds: [],
  segments: [{
    id: 'arrival',
    name: 'Arrival',
    intent: '',
    durationTargetMinutes: 2,
    items: [
      { id: 'first', exerciseId: 'first', durationMinutes: 1, notes: 'Private note', apparatus: 'Mat' },
      { id: 'second', exerciseId: 'second', durationMinutes: 1, notes: '', apparatus: 'Mat' },
    ],
  }],
};

const flowPlanService = {
  currentPlan: plan,
  clonePlan: (value: FlowPlan) => JSON.parse(JSON.stringify(value)) as FlowPlan,
} as FlowPlanService;

const protocols: WatchProtocolService[] = [];

function createProtocol(): { runner: ClassRunnerService; protocol: WatchProtocolService } {
  const runner = new ClassRunnerService(flowPlanService);
  const flowData = { data$: new BehaviorSubject(null) } as unknown as FlowDataService;
  const protocol = new WatchProtocolService(runner, flowData);
  protocols.push(protocol);
  return { runner, protocol };
}

describe('WatchProtocolService', () => {
  afterEach(() => {
    protocols.splice(0).forEach((protocol) => protocol.ngOnDestroy());
    localStorage.clear();
  });

  it('publishes resolved phone colors and refreshes them when the theme changes', async () => {
    const root = document.documentElement;
    const originalClass = root.className;
    let accent = '#2a8fa5';
    spyOn(window, 'getComputedStyle').and.returnValue({
      getPropertyValue: (property: string) => property === '--ion-color-primary' ? accent : '',
    } as CSSStyleDeclaration);
    const { runner, protocol } = createProtocol();
    try {
      runner.loadPlan(plan, 'planner');
      expect(protocol.latestState?.appearance).toEqual({
        accent: '#2a8fa5', background: '#f3fbfd', text: '#0f172a', secondaryText: '#334155',
        timerNormal: '#173c35', timerWarning: '#8b5b13', timerDanger: '#a42c40',
      });
      for (const [theme, color] of [['rose', '#e07a9a'], ['lilac', '#9b7bd1'], ['sage', '#4e7c73'], ['ocean', '#2a8fa5']]) {
        accent = color;
        root.className = `theme-${theme}`;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(protocol.latestState?.appearance?.accent).toBe(color);
      }
    } finally {
      protocol.ngOnDestroy();
      root.className = originalClass;
      runner.stop();
    }
  });

  it('publishes the phone deadline across pause, resume, stop, and restart', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-22T12:00:00.250Z'));
    const { runner, protocol } = createProtocol();
    try {
      runner.loadPlan(plan, 'planner');
      runner.start();
      const initial = protocol.latestState!;
      expect(initial.currentExerciseEndsAt).toBe('2026-09-22T12:01:00.250Z');
      jasmine.clock().tick(2250);
      expect(protocol.latestState).toBe(initial);
      runner.pause();
      expect(protocol.latestState?.status).toBe('paused');
      expect(protocol.latestState?.currentExercise?.remainingSeconds).toBe(58);
      expect(protocol.latestState?.currentExerciseEndsAt).toBeUndefined();
      jasmine.clock().tick(3500);
      runner.start();
      expect(protocol.latestState?.currentExerciseEndsAt).toBe('2026-09-22T12:01:04.000Z');
      jasmine.clock().tick(1000);
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(57);
      const resumedSession = protocol.latestState?.sessionId;
      runner.stop();
      expect(protocol.latestState?.status).toBe('ready');
      expect(protocol.latestState?.currentExerciseEndsAt).toBeUndefined();
      expect(protocol.latestState?.sessionId).not.toBe(resumedSession);
      runner.start();
      expect(protocol.latestState?.currentExerciseEndsAt).toBe('2026-09-22T12:01:07.000Z');
      jasmine.clock().tick(250);
      runner.restartExercise();
      expect(protocol.latestState?.currentExerciseEndsAt).toBe('2026-09-22T12:01:07.250Z');
      expect(protocol.latestState?.revision).toBe(runner.currentRevision);
      jasmine.clock().tick(750);
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(60);
      jasmine.clock().tick(250);
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(59);
    } finally {
      runner.stop();
      jasmine.clock().uninstall();
    }
  });

  it('maps the active run to a compact versioned state message', () => {
    const { runner, protocol } = createProtocol();
    runner.loadPlan(plan, 'planner');

    const state = protocol.latestState;

    expect(state?.type).toBe('runner.state');
    expect(state?.protocolVersion).toBe(1);
    expect(state?.sessionId).toBe(runner.currentSessionId);
    expect(state?.revision).toBe(runner.currentRevision);
    expect(state?.currentExercise?.exerciseId).toBe('first');
    expect(state?.currentExercise?.name).toBe('first');
    const currentExercise = state?.currentExercise as unknown as Record<string, unknown>;
    expect(currentExercise['notes']).toBeUndefined();
    runner.stop();
  });

  it('applies a valid pause command once and rejects its duplicate', () => {
    const { runner, protocol } = createProtocol();
    runner.loadPlan(plan, 'planner');
    runner.start();
    const command = {
      type: 'runner.command' as const,
      protocolVersion: 1,
      sessionId: runner.currentSessionId,
      messageId: 'pause-1',
      sentAt: new Date().toISOString(),
      command: 'pause' as const,
      baseRevision: runner.currentRevision,
    };

    const firstAck = protocol.handleCommand(command);
    const duplicateAck = protocol.handleCommand(command);

    expect(firstAck.accepted).toBeTrue();
    expect(runner.state.status).toBe('paused');
    expect(duplicateAck.accepted).toBeFalse();
    expect(duplicateAck.reason).toBe('duplicate-command');
    runner.stop();
  });

  it('rejects stale and unknown-session commands without changing the runner', () => {
    const { runner, protocol } = createProtocol();
    runner.loadPlan(plan, 'planner');
    const stale = protocol.handleCommand({
      type: 'runner.command',
      protocolVersion: 1,
      sessionId: runner.currentSessionId,
      messageId: 'stale-1',
      sentAt: new Date().toISOString(),
      command: 'start',
      baseRevision: 0,
    });
    const unknownSession = protocol.handleCommand({
      type: 'runner.command',
      protocolVersion: 1,
      sessionId: 'unknown',
      messageId: 'unknown-1',
      sentAt: new Date().toISOString(),
      command: 'start',
    });

    expect(stale.reason).toBe('stale-command');
    expect(unknownSession.reason).toBe('unknown-session');
    expect(runner.state.status).toBe('ready');
    runner.stop();
  });
});
