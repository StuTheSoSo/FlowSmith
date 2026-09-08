import { Component } from '@angular/core';

const THEME_STORAGE_KEY = 'flowsmith-theme';
const DEFAULT_THEME = 'theme-ocean';
const ALLOWED_THEMES = new Set(['theme-rose', 'theme-lilac', 'theme-ocean', 'theme-sage']);

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const theme = stored && ALLOWED_THEMES.has(stored) ? stored : DEFAULT_THEME;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.add(theme);
  }
}
