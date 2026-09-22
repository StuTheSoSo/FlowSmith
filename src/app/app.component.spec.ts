import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY } from 'rxjs';

import { AppComponent } from './app.component';
import { ClassRunnerService } from './class-runner.service';
import { FlowDataService } from './flow-data.service';
import { WatchBridgeService } from './watch/watch-bridge.service';
import { WatchProtocolService } from './watch/watch-protocol.service';

describe('AppComponent', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: Router, useValue: { events: EMPTY } },
        { provide: FlowDataService, useValue: {} },
        { provide: ClassRunnerService, useValue: { initializeLifecycle: () => undefined } },
        { provide: WatchProtocolService, useValue: {} },
        { provide: WatchBridgeService, useValue: { initialize: () => undefined } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

});
