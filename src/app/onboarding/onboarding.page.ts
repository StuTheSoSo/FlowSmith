import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FlowPlanService } from '../flow-plan.service';
import { OnboardingService } from './onboarding.service';

interface OnboardingStep {
  icon: string;
  eyebrowKey: string;
  titleKey: string;
  bodyKey: string;
  bulletKeys?: string[];
}

@Component({
  selector: 'app-onboarding',
  templateUrl: 'onboarding.page.html',
  styleUrls: ['onboarding.page.scss'],
  standalone: false,
})
export class OnboardingPage {
  readonly steps: OnboardingStep[] = [
    {
      icon: 'sparkles-outline',
      eyebrowKey: 'ONBOARDING.STEP1_EYEBROW',
      titleKey: 'ONBOARDING.STEP1_TITLE',
      bodyKey: 'ONBOARDING.STEP1_BODY',
    },
    {
      icon: 'library-outline',
      eyebrowKey: 'ONBOARDING.STEP2_EYEBROW',
      titleKey: 'ONBOARDING.STEP2_TITLE',
      bodyKey: 'ONBOARDING.STEP2_BODY',
      bulletKeys: ['ONBOARDING.STEP2_BULLET1', 'ONBOARDING.STEP2_BULLET2', 'ONBOARDING.STEP2_BULLET3'],
    },
    {
      icon: 'calendar-clear-outline',
      eyebrowKey: 'ONBOARDING.STEP3_EYEBROW',
      titleKey: 'ONBOARDING.STEP3_TITLE',
      bodyKey: 'ONBOARDING.STEP3_BODY',
      bulletKeys: ['ONBOARDING.STEP3_BULLET1', 'ONBOARDING.STEP3_BULLET2', 'ONBOARDING.STEP3_BULLET3'],
    },
    {
      icon: 'bookmark-outline',
      eyebrowKey: 'ONBOARDING.STEP4_EYEBROW',
      titleKey: 'ONBOARDING.STEP4_TITLE',
      bodyKey: 'ONBOARDING.STEP4_BODY',
      bulletKeys: ['ONBOARDING.STEP4_BULLET1', 'ONBOARDING.STEP4_BULLET2', 'ONBOARDING.STEP4_BULLET3'],
    },
    {
      icon: 'timer-outline',
      eyebrowKey: 'ONBOARDING.STEP5_EYEBROW',
      titleKey: 'ONBOARDING.STEP5_TITLE',
      bodyKey: 'ONBOARDING.STEP5_BODY',
      bulletKeys: ['ONBOARDING.STEP5_BULLET1', 'ONBOARDING.STEP5_BULLET2', 'ONBOARDING.STEP5_BULLET3'],
    },
    {
      icon: 'settings-outline',
      eyebrowKey: 'ONBOARDING.STEP6_EYEBROW',
      titleKey: 'ONBOARDING.STEP6_TITLE',
      bodyKey: 'ONBOARDING.STEP6_BODY',
      bulletKeys: ['ONBOARDING.STEP6_BULLET1', 'ONBOARDING.STEP6_BULLET2', 'ONBOARDING.STEP6_BULLET3'],
    },
    {
      icon: 'flag-outline',
      eyebrowKey: 'ONBOARDING.STEP7_EYEBROW',
      titleKey: 'ONBOARDING.STEP7_TITLE',
      bodyKey: 'ONBOARDING.STEP7_BODY',
    },
  ];

  currentStepIndex = 0;

  constructor(
    private readonly onboarding: OnboardingService,
    private readonly flowPlanService: FlowPlanService,
    private readonly router: Router
  ) {}

  get currentStep(): OnboardingStep {
    return this.steps[this.currentStepIndex];
  }

  get isFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.steps.length - 1;
  }

  next(): void {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
    }
  }

  back(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    }
  }

  goToStep(index: number): void {
    this.currentStepIndex = index;
  }

  skip(): void {
    this.finish();
    this.router.navigateByUrl('/home');
  }

  startBlankFlow(): void {
    this.finish();
    this.flowPlanService.startBlankFlow();
    this.router.navigateByUrl('/planner');
  }

  browseTemplates(): void {
    this.finish();
    this.router.navigateByUrl('/templates');
  }

  browseLibrary(): void {
    this.finish();
    this.router.navigateByUrl('/library');
  }

  trackStep(index: number): number {
    return index;
  }

  private finish(): void {
    this.onboarding.completeOnboarding();
  }
}
