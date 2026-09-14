import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { OnboardingService } from '../onboarding/onboarding.service';

interface ThemeOption {
  labelKey: string;
  value: string;
}

const THEME_STORAGE_KEY = 'flowsmith-theme';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  readonly themeOptions: ThemeOption[] = [
    { labelKey: 'SETTINGS.THEME_ROSE', value: 'theme-rose' },
    { labelKey: 'SETTINGS.THEME_LILAC', value: 'theme-lilac' },
    { labelKey: 'SETTINGS.THEME_OCEAN', value: 'theme-ocean' },
    { labelKey: 'SETTINGS.THEME_SAGE', value: 'theme-sage' },
  ];

  selectedTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? 'theme-ocean';

  constructor(
    readonly flowData: FlowDataService,
    readonly classRunner: ClassRunnerService,
    private readonly onboarding: OnboardingService,
    private readonly router: Router
  ) {}

  onThemeChange(theme: string): void {
    this.selectedTheme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.remove(...this.themeOptions.map((option) => option.value));
    document.documentElement.classList.add(theme);
  }

  onLanguageChange(code: string): void {
    this.flowData.setLanguage(code);
  }

  replayTutorial(): void {
    this.onboarding.resetOnboarding();
    this.router.navigateByUrl('/onboarding');
  }

  onAutoAdvanceChange(checked: boolean): void {
    this.classRunner.updateSettings({
      ...this.classRunner.settings,
      autoAdvanceOnExerciseEnd: checked,
    });
  }

  onExerciseEndSoundChange(checked: boolean): void {
    this.classRunner.updateSettings({
      ...this.classRunner.settings,
      exerciseEndSound: checked,
    });
  }

  onExerciseEndHapticsChange(checked: boolean): void {
    this.classRunner.updateSettings({
      ...this.classRunner.settings,
      exerciseEndHaptics: checked,
    });
  }
}
