import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { FlowDataService } from '../flow-data.service';
import { FlowPlanService } from '../flow-plan.service';
import { OnboardingPage } from './onboarding.page';
import { OnboardingService } from './onboarding.service';

describe('Onboarding watch guidance', () => {
  const createPage = (platform: string, native: boolean) => {
    spyOn(Capacitor, 'getPlatform').and.returnValue(platform);
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(native);
    const onboarding = { completeOnboarding: jasmine.createSpy() };
    const planner = { startBlankFlow: jasmine.createSpy() };
    const router = { navigateByUrl: jasmine.createSpy() };
    const page = new OnboardingPage(onboarding as unknown as OnboardingService, planner as unknown as FlowPlanService,
      router as unknown as Router, { currentLanguage: 'en' } as FlowDataService);
    return { page, onboarding, planner, router };
  };

  for (const configuration of [
    { platform: 'ios', native: true, expected: ['IOS'] },
    { platform: 'android', native: true, expected: ['ANDROID'] },
    { platform: 'web', native: false, expected: ['IOS', 'ANDROID'] },
    { platform: 'ios', native: false, expected: ['IOS', 'ANDROID'] },
  ]) {
    it(`selects setup for ${configuration.platform}, native=${configuration.native}`, () => {
      const { page } = createPage(configuration.platform, configuration.native);
      expect(page.watchPlatforms).toEqual(configuration.expected);
      if (!configuration.native) expect(page.nativePlatform).toBe('web');
    });
  }

  it('includes the optional watch step before completion without requiring a watch', () => {
    const { page, onboarding, planner, router } = createPage('android', true);
    expect(page.steps.length).toBe(8);
    page.goToStep(5);
    page.next();
    expect(page.currentStep.watchSetup).toBeTrue();
    expect(page.isLastStep).toBeFalse();
    page.back();
    expect(page.currentStep.titleKey).toBe('ONBOARDING.STEP6_TITLE');
    page.next();
    page.next();
    expect(page.isLastStep).toBeTrue();
    expect(page.currentStep.watchSetup).toBeUndefined();
    page.startBlankFlow();
    expect(onboarding.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(planner.startBlankFlow).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/planner');
  });

  it('allows skipping the watch step without altering a flow', () => {
    const { page, onboarding, planner, router } = createPage('ios', true);
    page.goToStep(6);
    page.skip();
    expect(onboarding.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(planner.startBlankFlow).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });
});