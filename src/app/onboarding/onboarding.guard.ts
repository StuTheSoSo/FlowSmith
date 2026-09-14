import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingService } from './onboarding.service';

export const onboardingGuard: CanActivateFn = () => {
  const onboarding = inject(OnboardingService);
  const router = inject(Router);
  return onboarding.hasCompletedOnboarding() ? true : router.parseUrl('/onboarding');
};
