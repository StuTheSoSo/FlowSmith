import { Injectable } from '@angular/core';

const ONBOARDING_COMPLETE_KEY = 'flowsmith-onboarding-complete';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  hasCompletedOnboarding(): boolean {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  }

  completeOnboarding(): void {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  }

  /** Clears the completion flag so the wizard runs again on the next visit to /home. */
  resetOnboarding(): void {
    localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  }
}
