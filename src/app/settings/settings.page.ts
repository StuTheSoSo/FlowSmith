import { Component } from '@angular/core';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';

interface ThemeOption {
  label: string;
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
    { label: 'Rose', value: 'theme-rose' },
    { label: 'Lilac', value: 'theme-lilac' },
    { label: 'Ocean', value: 'theme-ocean' },
    { label: 'Sage', value: 'theme-sage' },
  ];

  selectedTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? 'theme-ocean';

  constructor(
    readonly flowData: FlowDataService,
    readonly classRunner: ClassRunnerService
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

  onAutoAdvanceChange(checked: boolean): void {
    this.classRunner.updateSettings({
      ...this.classRunner.settings,
      autoAdvanceOnExerciseEnd: checked,
    });
  }
}
