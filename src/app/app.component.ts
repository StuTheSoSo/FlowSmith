import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FlowDataService } from './flow-data.service';
import { ClassRunnerService } from './class-runner.service';
import { WatchBridgeService } from './watch/watch-bridge.service';
import { WatchProtocolService } from './watch/watch-protocol.service';

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
  showTabs = true;

  // Injecting FlowDataService here (unused directly) forces it to construct at boot, so the UI language syncs before any lazy page loads.
  constructor(
    private readonly router: Router,
    private readonly flowData: FlowDataService,
    private readonly classRunner: ClassRunnerService,
    private readonly watchProtocol: WatchProtocolService,
    private readonly watchBridge: WatchBridgeService
  ) {
    void this.flowData;
    void this.watchProtocol;
    this.watchBridge.initialize();
    this.classRunner.initializeLifecycle();
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const theme = stored && ALLOWED_THEMES.has(stored) ? stored : DEFAULT_THEME;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.classList.add(theme);

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.showTabs = !event.urlAfterRedirects.startsWith('/onboarding');
    });
  }
}
