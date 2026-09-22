import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { FlowGradingService } from '../flow-grading.service';
import { FlowPlanService } from '../flow-plan.service';
import { Exercise, FlowPlan, PilatesDataBundle } from '../models';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let plan: FlowPlan;
  let persist: jasmine.Spy;
  const matExercise: Exercise = { id: 'roll', name: 'Roll', equipment: 'Mat', level: 'Beginner' };
  const chairExercise: Exercise = { id: 'press', name: 'Press', equipment: 'Chair', level: 'Advanced' };
  const bundle: PilatesDataBundle = { exercises: [matExercise, chairExercise], conditions: [], contraindications: {}, programs: [] };

  beforeEach(() => {
    plan = {
      id: 'draft', name: '', clientName: '', goal: '', selectedConditionIds: [],
      segments: ['arrival', 'main-flow', 'closing'].map((id) => ({ id, name: id, intent: '', durationTargetMinutes: 10, items: [] })),
    };
    persist = jasmine.createSpy('updateCurrentPlan');
    TestBed.configureTestingModule({
      providers: [
        HomePage,
        { provide: ChangeDetectorRef, useValue: { detectChanges: () => undefined } },
        { provide: FlowPlanService, useValue: { currentPlan: plan, updateCurrentPlan: persist } },
        { provide: FlowDataService, useValue: { searchExercises: (_bundle: PilatesDataBundle, term: string) => bundle.exercises.filter((exercise) => exercise.name.includes(term)) } },
        { provide: FlowGradingService, useValue: { gradeFlow: () => null } },
        { provide: ClassRunnerService, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: Router, useValue: {} },
        { provide: AlertController, useValue: {} },
        { provide: ActionSheetController, useValue: {} },
      ],
    });
    component = TestBed.inject(HomePage);
    component.bundle = bundle;
  });

  afterEach(() => component.ngOnDestroy());

  it('adds multiple movements to the chosen section without closing the picker', () => {
    component.openExercisePicker(plan.segments[2]);
    component.addExercise(matExercise);
    component.addExercise(chairExercise);
    expect(component.pickerOpen).toBeTrue();
    expect(component.pickerAddedCount).toBe(2);
    expect(plan.segments.map((segment) => segment.items.length)).toEqual([0, 0, 2]);
    expect(component.planDurationMinutes).toBe(10);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('resets picker filters and destination for each section', () => {
    component.openExercisePicker(plan.segments[2]);
    component.searchTerm = 'Press';
    component.equipmentFilter = 'Chair';
    component.levelFilter = 'Advanced';
    component.addExercise(chairExercise);
    component.openExercisePicker(plan.segments[0]);
    expect(component.searchTerm).toBe('');
    expect(component.equipmentFilter).toBe('');
    expect(component.levelFilter).toBe('');
    expect(component.pickerAddedCount).toBe(0);
    component.addExercise(matExercise);
    expect(plan.segments.map((segment) => segment.items.length)).toEqual([1, 0, 1]);
  });

  it('combines search, equipment and level filters', () => {
    component.searchTerm = 'Press';
    component.equipmentFilter = 'Chair';
    component.levelFilter = 'Advanced';
    expect(component.filteredExercises).toEqual([chairExercise]);
    component.levelFilter = 'Beginner';
    expect(component.filteredExercises).toEqual([]);
  });

  it('supports reordering, duplication and removal while preserving durations', () => {
    const segment = plan.segments[0];
    component.openExercisePicker(segment);
    component.addExercise(matExercise);
    component.addExercise(chairExercise);
    const first = segment.items[0];
    component.moveItem(segment, first, -1);
    expect(segment.items[0]).toBe(first);
    component.moveItem(segment, first, 1);
    expect(segment.items[1]).toBe(first);
    component.duplicateItem(segment, first);
    expect(segment.items[2].id).not.toBe(first.id);
    component.updateDuration(first, 7);
    expect(component.planDurationMinutes).toBe(17);
    component.removeItem(segment, first);
    expect(component.planDurationMinutes).toBe(10);
  });

  it('supports quarter-minute durations and rejects invalid values without persisting them', () => {
    component.openExercisePicker(plan.segments[0]);
    component.addExercise(matExercise);
    const item = plan.segments[0].items[0];
    expect(component.updateDuration(item, 0.25)).toBeTrue();
    expect(component.planDurationMinutes).toBe(0.25);
    expect(component.updateDuration(item, item.durationMinutes + 0.25)).toBeTrue();
    expect(component.planDurationMinutes).toBe(0.5);
    expect(component.updateDuration(item, item.durationMinutes - 0.25)).toBeTrue();
    persist.calls.reset();
    for (const invalid of ['', null, 'invalid', Infinity, 0, -1, 0.1]) {
      expect(component.updateDuration(item, invalid)).toBeFalse();
    }
    expect(item.durationMinutes).toBe(0.25);
    expect(persist).not.toHaveBeenCalled();
  });

  it('expands only the selected row and persists cues', () => {
    component.openExercisePicker(plan.segments[0]);
    component.addExercise(matExercise);
    const item = plan.segments[0].items[0];
    component.toggleItem(item);
    expect(component.expandedItemId).toBe(item.id);
    component.updateNotes(item, 'Exhale to move');
    expect(item.notes).toBe('Exhale to move');
    expect(persist).toHaveBeenCalledWith(plan);
    component.toggleItem(item);
    expect(component.expandedItemId).toBe('');
  });

  it('keeps a cleared title empty after blur', () => {
    component.updatePlanName('Morning Mat');
    component.updatePlanName('');
    component.finalizePlanName();
    expect(plan.name).toBe('');
  });

  it('keeps the Save dialog open for missing titles and saves a trimmed title', async () => {
    plan.name = 'Previous title';
    const save = jasmine.createSpy('saveCurrentPlanAsFlow');
    TestBed.inject(FlowPlanService).saveCurrentPlanAsFlow = save;
    const alert = { present: jasmine.createSpy().and.resolveTo(), message: '' };
    const create = jasmine.createSpy().and.resolveTo(alert);
    TestBed.inject(AlertController).create = create;
    await component.saveFlow();
    const handler = create.calls.mostRecent().args[0].buttons[1].handler;
    for (const name of ['', '   ', '\t\n', undefined]) {
      expect(handler({ name })).toBeFalse();
      expect(alert.message).toBe('HOME.TITLE_REQUIRED');
    }
    expect(save).not.toHaveBeenCalled();
    expect(handler({ name: '  Evening Mat  ' })).toBeTrue();
    expect(save).toHaveBeenCalledWith('Evening Mat');
  });

  it('only replaces the draft after confirming Clear and edits the new draft afterwards', async () => {
    component.openExercisePicker(plan.segments[0]);
    component.addExercise(matExercise);
    plan.name = 'Saved flow';
    plan.savedAt = new Date().toISOString();
    const original = JSON.stringify(plan);
    const blank: FlowPlan = {
      id: 'new-draft', name: '', clientName: '', goal: '', selectedConditionIds: [],
      segments: plan.segments.map(segment => ({ ...segment, items: [] })),
    };
    const service = TestBed.inject(FlowPlanService);
    service.startBlankFlow = jasmine.createSpy().and.returnValue(blank);
    const present = jasmine.createSpy().and.resolveTo();
    const create = jasmine.createSpy().and.resolveTo({ present });
    TestBed.inject(AlertController).create = create;

    await component.confirmClearFlow();
    expect(present).toHaveBeenCalled();
    expect(service.startBlankFlow).not.toHaveBeenCalled();
    expect(component.plan).toBe(plan);
    const buttons = create.calls.mostRecent().args[0].buttons;
    expect(buttons.find((button: { role: string }) => button.role === 'cancel').handler).toBeUndefined();
    buttons.find((button: { role: string }) => button.role === 'destructive').handler();
    expect(service.startBlankFlow).toHaveBeenCalledWith('');
    expect(component.plan).toBe(blank);
    expect(component.planExerciseCount).toBe(0);
    expect(component.isSavedToLibrary).toBeFalse();
    expect(component.pickerOpen).toBeFalse();
    expect(component.selectedSegmentId).toBe(blank.segments[0].id);
    expect(JSON.stringify(plan)).toBe(original);
    component.addExercise(chairExercise);
    expect(blank.segments[0].items[0].exerciseId).toBe(chairExercise.id);
    expect(persist).toHaveBeenCalledWith(blank);
  });
});

describe('Flow title persistence', () => {
  beforeEach(() => {
    const stored = new Map<string, string>();
    spyOn(localStorage, 'getItem').and.callFake(key => stored.get(key) ?? null);
    spyOn(localStorage, 'setItem').and.callFake((key, value) => { stored.set(key, value); });
  });

  it('starts unnamed and rejects blank titles without changing saved flows', () => {
    const service = new FlowPlanService();
    service.startBlankFlow();
    expect(service.currentPlan.name).toBe('');
    for (const name of [undefined, '', ' \t\n ']) {
      expect(() => service.saveCurrentPlanAsFlow(name)).toThrowError('A flow title is required.');
    }
    expect(service.savedFlows).toEqual([]);
    expect(service.currentPlan.savedAt).toBeUndefined();
    service.saveCurrentPlanAsFlow('  Named flow  ');
    const saved = JSON.stringify(service.savedFlows);
    expect(service.currentPlan.name).toBe('Named flow');
    expect(() => service.saveCurrentPlanAsFlow(' ')).toThrow();
    expect(JSON.stringify(service.savedFlows)).toBe(saved);
    expect(new FlowPlanService().savedFlows[0].name).toBe('Named flow');
  });
});
