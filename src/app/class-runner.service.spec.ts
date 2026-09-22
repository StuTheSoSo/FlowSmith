import { ClassRunnerService } from './class-runner.service';
import { FlowPlan } from './models';
import { FlowPlanService } from './flow-plan.service';

const SNAPSHOT_KEY = 'flowsmith-runner-snapshot';

const plan: FlowPlan = {
  id: 'test-plan',
  name: 'Test plan',
  clientName: '',
  goal: '',
  selectedConditionIds: [],
  segments: [{
    id: 'arrival',
    name: 'Arrival',
    intent: '',
    durationTargetMinutes: 2,
    items: [
      { id: 'first', exerciseId: 'first', durationMinutes: 1, notes: '', apparatus: 'Mat' },
      { id: 'second', exerciseId: 'second', durationMinutes: 1, notes: '', apparatus: 'Mat' },
    ],
  }],
};

const flowPlanService = {
  currentPlan: plan,
  clonePlan: (value: FlowPlan) => JSON.parse(JSON.stringify(value)) as FlowPlan,
} as FlowPlanService;

describe('ClassRunnerService', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('flowsmith-runner-settings', JSON.stringify({ autoAdvanceOnExerciseEnd: true }));
  });
  afterEach(() => localStorage.clear());

  it('edits paused duration without consuming time, changing the source plan, or starting the timer', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-22T12:00:00Z'));
    const runner = new ClassRunnerService(flowPlanService);
    try {
      runner.loadPlan(plan, 'planner');
      expect(runner.updateCurrentExerciseDuration(75)).toBeTrue();
      runner.start();
      jasmine.clock().tick(20000);
      expect(runner.updateCurrentExerciseDuration(90)).toBeFalse();
      runner.pause();
      for (const invalid of [NaN, Infinity, 14, 20, 30.5]) {
        expect(runner.updateCurrentExerciseDuration(invalid)).toBeFalse();
      }
      expect(runner.updateCurrentExerciseDuration(45)).toBeTrue();
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(25);
      expect(runner.getTotalDurationSeconds()).toBe(105);
      expect(runner.state.elapsedSeconds).toBe(20);
      expect(runner.state.status).toBe('paused');
      expect(plan.segments[0].items[0].durationMinutes).toBe(1);
      jasmine.clock().tick(30000);
      expect(runner.state.elapsedSeconds).toBe(20);
      const restored = new ClassRunnerService(flowPlanService);
      expect(restored.getCurrentExerciseRemainingSeconds()).toBe(25);
      expect(restored.state.plan.segments[0].items[0].durationMinutes).toBe(0.75);
      restored.stop();
      expect(restored.state.exercises[0].durationSeconds).toBe(45);
      runner.start();
      jasmine.clock().tick(25000);
      expect(runner.state.currentIndex).toBe(1);
      runner.next();
      expect(runner.updateCurrentExerciseDuration(90)).toBeFalse();
    } finally {
      runner.stop();
      jasmine.clock().uninstall();
    }
  });

  it('waits for Go at the next exercise without consuming setup time and completes the final exercise', () => {
    localStorage.removeItem('flowsmith-runner-settings');
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-22T12:00:00Z'));
    const runner = new ClassRunnerService(flowPlanService);
    try {
      runner.loadPlan(plan, 'planner');
      runner.start();
      jasmine.clock().tick(65000);
      expect(runner.state.status).toBe('setup');
      expect(runner.state.currentIndex).toBe(1);
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(60);
      expect(runner.state.elapsedSeconds).toBe(60);
      expect(runner.currentExerciseEndsAt).toBeUndefined();
      expect(runner.updateCurrentExerciseDuration(75)).toBeTrue();
      expect(runner.getCurrentExerciseRemainingSeconds()).toBe(75);
      jasmine.clock().tick(30000);
      expect(runner.state.elapsedSeconds).toBe(60);
      const restored = new ClassRunnerService(flowPlanService);
      expect(restored.state.status).toBe('setup');
      expect(restored.hasRestorableSession).toBeTrue();
      runner.start();
      runner.start();
      jasmine.clock().tick(75000);
      expect(runner.state.status).toBe('completed');
      expect(runner.state.elapsedSeconds).toBe(135);
    } finally {
      runner.stop();
      jasmine.clock().uninstall();
    }
  });

  it('realigns refreshes to the deadline after delayed callbacks during a long run', () => {
    let now = Date.parse('2026-09-22T12:00:00.250Z');
    spyOn(Date, 'now').and.callFake(() => now);
    const scheduled = spyOn(window, 'setTimeout').and.returnValue(123);
    const runner = new ClassRunnerService(flowPlanService);
    try {
      runner.loadPlan(plan, 'planner');
      runner.start();
      expect(scheduled).toHaveBeenCalled();
      if (!scheduled.calls.count()) return;
      expect(scheduled.calls.mostRecent().args[1]).toBe(1000);

      for (let elapsed = 1; elapsed <= 90; elapsed += 1) {
        const callback = scheduled.calls.mostRecent().args[0] as () => void;
        now = Date.parse('2026-09-22T12:00:00.250Z') + elapsed * 1000 + 350;
        callback();
        expect(runner.state.elapsedSeconds).toBe(elapsed);
        expect(scheduled.calls.mostRecent().args[1]).toBe(650);
      }
      expect(runner.state.currentIndex).toBe(1);
      expect(runner.currentExerciseEndsAt).toBe('2026-09-22T12:02:00.250Z');

      const callback = scheduled.calls.mostRecent().args[0] as () => void;
      now += 5000;
      callback();
      expect(runner.state.elapsedSeconds).toBe(95);
      expect(scheduled.calls.mostRecent().args[1]).toBe(650);
      runner.pause();
      const scheduledCount = scheduled.calls.count();
      callback();
      expect(scheduled.calls.count()).toBe(scheduledCount);
    } finally {
      runner.stop();
    }
  });

  it('catches up from wall-clock time across an exercise boundary', () => {
    const runner = new ClassRunnerService(flowPlanService);
    runner.loadPlan(plan, 'planner');
    runner.start();

    (runner as any).runningSince = Date.now() - 65_000;
    (runner as any).reconcileTime();

    expect(runner.state.status).toBe('running');
    expect(runner.state.currentIndex).toBe(1);
    expect(runner.state.currentExerciseElapsedSeconds).toBe(5);
    expect(runner.state.elapsedSeconds).toBe(65);
    runner.stop();
  });

  it('restores a running class as paused until the instructor chooses to resume', () => {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      version: 1,
      sessionId: 'restored-session',
      state: {
        source: 'planner',
        plan,
        exercises: [
          { id: 'first', exerciseId: 'first', segmentId: 'arrival', segmentName: 'Arrival', durationSeconds: 60, notes: '', apparatus: 'Mat' },
          { id: 'second', exerciseId: 'second', segmentId: 'arrival', segmentName: 'Arrival', durationSeconds: 60, notes: '', apparatus: 'Mat' },
        ],
        currentIndex: 0,
        currentExerciseElapsedSeconds: 10,
        elapsedSeconds: 10,
        status: 'running',
      },
      runningSince: new Date(Date.now() - 5_000).toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const runner = new ClassRunnerService(flowPlanService);

    expect(runner.state.status).toBe('paused');
    expect(runner.hasRestorableSession).toBeTrue();
    expect(runner.state.elapsedSeconds).toBeGreaterThanOrEqual(15);

    runner.resumeRestoredSession();

    expect(runner.state.status).toBe('running');
    expect(runner.hasRestorableSession).toBeFalse();
    runner.stop();
  });

  it('clears the durable snapshot after completion', () => {
    const runner = new ClassRunnerService(flowPlanService);
    runner.loadPlan(plan, 'planner');
    runner.next();
    runner.next();

    expect(runner.state.status).toBe('completed');
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });
});
