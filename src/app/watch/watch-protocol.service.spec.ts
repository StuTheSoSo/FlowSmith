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

  it('publishes duration-only edits and resumes from the revised remaining time', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-22T12:00:00Z'));
    const { runner, protocol } = createProtocol();
    try {
      runner.loadPlan(plan, 'planner');
      runner.start();
      jasmine.clock().tick(10000);
      runner.pause();
      const oldRevision = protocol.latestState!.revision;
      runner.updateCurrentExerciseDuration(75);
      expect(protocol.latestState?.currentExercise?.durationSeconds).toBe(75);
      expect(protocol.latestState?.currentExercise?.remainingSeconds).toBe(65);
      expect(protocol.latestState?.status).toBe('paused');
      expect(protocol.latestState?.currentExerciseEndsAt).toBeUndefined();
      const command = {
        type: 'runner.command', protocolVersion: 1, sessionId: runner.currentSessionId,
        messageId: 'resume-edited', sentAt: new Date().toISOString(), command: 'resume',
        baseRevision: oldRevision,
      };
      expect(protocol.handleCommand(command).reason).toBe('stale-command');
      expect(protocol.handleCommand({ ...command, baseRevision: protocol.latestState!.revision }).accepted).toBeTrue();
      expect(protocol.latestState?.currentExerciseEndsAt).toBe('2026-09-22T12:01:15.000Z');
    } finally {
      runner.stop();
      jasmine.clock().uninstall();
    }
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

  it('accepts watch Go, Pause after timer ticks, and Resume while rejecting duplicate and stale controls', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-22T12:00:00Z'));
    const { runner, protocol } = createProtocol();
    const command = (name: string, messageId: string, baseRevision = protocol.latestState!.revision) => ({
      type: 'runner.command', protocolVersion: 1, sessionId: runner.currentSessionId,
      messageId, sentAt: new Date().toISOString(), command: name, baseRevision,
    });
    try {
      runner.loadPlan(plan, 'planner');
      runner.updateSettings({ ...runner.settings, autoAdvanceOnExerciseEnd: false });
      runner.start();
      const runningRevision = protocol.latestState!.revision;
      jasmine.clock().tick(60000);
      expect(protocol.latestState?.status).toBe('setup');
      expect(protocol.handleCommand(command('pause', 'old-pause', runningRevision)).reason).toBe('stale-command');
      const go = command('start', 'go');
      expect(protocol.handleCommand(go).accepted).toBeTrue();
      const deadline = runner.currentExerciseEndsAt;
      expect(protocol.handleCommand(go).reason).toBe('duplicate-command');
      expect(protocol.handleCommand({ ...go, messageId: 'second-tap' }).accepted).toBeFalse();
      expect(runner.currentExerciseEndsAt).toBe(deadline);
      const watchRevision = protocol.latestState!.revision;
      jasmine.clock().tick(5000);
      expect(protocol.handleCommand(command('pause', 'pause-after-ticks', watchRevision)).accepted).toBeTrue();
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(55);
      expect(protocol.handleCommand(command('resume', 'resume')).accepted).toBeTrue();
      expect(runner.state.status).toBe('running');
      const stop = command('stop', 'stop');
      expect(protocol.handleCommand(stop).accepted).toBeTrue();
      expect(runner.state.status).toBe('ready');
      expect(runner.state.currentIndex).toBe(0);
      expect(runner.state.elapsedSeconds).toBe(0);
      expect(runner.currentSessionId).not.toBe(stop.sessionId);
      expect(protocol.handleCommand(stop).reason).toBe('unknown-session');
    } finally {
      runner.stop();
      jasmine.clock().uninstall();
    }
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
