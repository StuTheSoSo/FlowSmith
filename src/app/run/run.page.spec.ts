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
});