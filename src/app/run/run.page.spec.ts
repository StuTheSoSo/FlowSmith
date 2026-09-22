import { Capacitor } from '@capacitor/core';
import { RunPage } from './run.page';

describe('RunPage orientation', () => {
  let page: RunPage;
  let lock: jasmine.Spy;
  let unlock: jasmine.Spy;

  beforeEach(() => {
    page = Object.create(RunPage.prototype) as RunPage;
    const orientation = screen.orientation as ScreenOrientation & { lock(value: string): Promise<void> };
    lock = spyOn(orientation, 'lock').and.resolveTo();
    unlock = spyOn(screen.orientation, 'unlock');
  });

  it('returns native teaching screens to portrait', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    await (page as any).releaseTeachingScreen();
    expect(lock).toHaveBeenCalledOnceWith('portrait');
    expect(unlock).not.toHaveBeenCalled();
  });

  it('still unlocks browser rotation when teaching ends', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    await (page as any).releaseTeachingScreen();
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(lock).not.toHaveBeenCalled();
  });

  it('still requests landscape when teaching starts', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    (page as any).state = { status: 'running' };
    (page as any).classRunner = { start: jasmine.createSpy('start') };
    await page.startTeaching();
    expect(lock).toHaveBeenCalledOnceWith('landscape');
  });

  it('announces the setup exercise rather than skipping its name', () => {
    const first = { id: 'first', exerciseId: 'Hundred' };
    const second = { id: 'second', exerciseId: 'Roll Up' };
    (page as any).state = { status: 'setup', currentIndex: 1, exercises: [first, second] };
    (page as any).classRunner = { settings: {} };
    const instant = jasmine.createSpy('instant').and.returnValue('Ready for Roll Up');
    (page as any).translate = { instant };
    spyOn(page, 'getExerciseName').and.callFake((exercise) => exercise?.exerciseId ?? 'Ready');
    (page as any).announceExerciseComplete('first');
    expect(instant).toHaveBeenCalledWith('RUN.EXERCISE_COMPLETE_NEXT', { name: 'Hundred', next: 'Roll Up' });
    expect(page.isTeaching).toBeTrue();
  });

  it('rejects duration saves after a watch action changes the state, exercise, or session', async () => {
    const state = {
      status: 'paused', currentIndex: 0, currentExerciseElapsedSeconds: 10,
      exercises: [{ id: 'first', durationSeconds: 60 }, { id: 'second', durationSeconds: 60 }],
    };
    const runner = { currentSessionId: 'original', updateCurrentExerciseDuration: jasmine.createSpy('update').and.returnValue(true) };
    const alert = { present: jasmine.createSpy('present').and.resolveTo(), message: '' };
    let save: (data: { minutes: string }) => boolean = () => false;
    (page as any).state = state;
    (page as any).classRunner = runner;
    (page as any).translate = { instant: (key: string) => key };
    (page as any).alertController = {
      create: async (options: { buttons: Array<{ handler?: typeof save }> }) => {
        save = options.buttons[1].handler!;
        return alert;
      },
    };
    spyOn(page, 'getExerciseName').and.returnValue('First');
    await page.editDuration();
    state.status = 'running';
    expect(save({ minutes: '1.5' })).toBeFalse();
    state.status = 'paused';
    state.currentIndex = 1;
    expect(save({ minutes: '1.5' })).toBeFalse();
    state.currentIndex = 0;
    runner.currentSessionId = 'new-session';
    expect(save({ minutes: '1.5' })).toBeFalse();
    expect(runner.updateCurrentExerciseDuration).not.toHaveBeenCalled();
    expect(alert.message).toBe('COMMON.DURATION_CHANGED');
    runner.currentSessionId = 'original';
    expect(save({ minutes: '1.5' })).toBeTrue();
    expect(runner.updateCurrentExerciseDuration).toHaveBeenCalledOnceWith(90);
  });
});