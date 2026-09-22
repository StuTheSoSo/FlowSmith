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
});
