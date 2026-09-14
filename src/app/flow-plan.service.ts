import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FlowItem, FlowPlan, FlowSegment, Program } from './models';

const CURRENT_PLAN_KEY = 'flowsmith-current-plan';
const LAST_EDITED_KEY = 'flowsmith-current-plan-edited';
const SAVED_FLOWS_KEY = 'flowsmith-saved-flows';

@Injectable({ providedIn: 'root' })
export class FlowPlanService {
  private readonly currentPlanSubject = new BehaviorSubject<FlowPlan>(this.readStoredPlan() ?? this.createDemoPlan());
  readonly currentPlan$ = this.currentPlanSubject.asObservable();
  private lastEditedAtValue = this.readLastEditedAt();

  private readonly savedFlowsSubject = new BehaviorSubject<FlowPlan[]>(this.readStoredFlows());
  readonly savedFlows$ = this.savedFlowsSubject.asObservable();

  get currentPlan(): FlowPlan {
    return this.currentPlanSubject.value;
  }

  get lastEditedAt(): Date | null {
    return this.lastEditedAtValue;
  }

  get savedFlows(): FlowPlan[] {
    return this.savedFlowsSubject.value;
  }

  updateCurrentPlan(plan: FlowPlan): void {
    this.currentPlanSubject.next(plan);
    this.lastEditedAtValue = new Date();
    localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(plan));
    localStorage.setItem(LAST_EDITED_KEY, this.lastEditedAtValue.toISOString());
  }

  /** Saves the current planner draft into the flow library, upserting by id so repeat saves update the same entry. */
  saveCurrentPlanAsFlow(name?: string): FlowPlan {
    const plan = this.currentPlan;
    const trimmedName = name?.trim();
    if (trimmedName) {
      plan.name = trimmedName;
    }

    const alreadySaved = this.savedFlows.some((flow) => flow.id === plan.id);
    if (!alreadySaved) {
      plan.id = this.createSavedFlowId();
    }
    plan.savedAt = new Date().toISOString();

    const snapshot = this.clonePlan(plan);
    const nextFlows = alreadySaved
      ? this.savedFlows.map((flow) => (flow.id === snapshot.id ? snapshot : flow))
      : [...this.savedFlows, snapshot];

    this.persistSavedFlows(nextFlows);
    this.updateCurrentPlan(plan);
    return plan;
  }

  /** Loads a copy of a saved flow into the planner as the current draft. */
  loadSavedFlowIntoPlanner(flowId: string): FlowPlan | null {
    const flow = this.savedFlows.find((candidate) => candidate.id === flowId);
    if (!flow) {
      return null;
    }

    const plan = this.clonePlan(flow);
    this.updateCurrentPlan(plan);
    return plan;
  }

  deleteSavedFlow(flowId: string): void {
    this.persistSavedFlows(this.savedFlows.filter((flow) => flow.id !== flowId));
  }

  /** Starts a fresh, unsaved draft in the planner so the user can build a new flow from scratch. */
  startBlankFlow(name = 'New Flow'): FlowPlan {
    const plan = this.createBlankPlan(name);
    this.updateCurrentPlan(plan);
    return plan;
  }

  createPlanFromProgram(program: Program): FlowPlan {
    const items = program.exerciseIds.map((exerciseId) => this.createItem(exerciseId, 5, 'Mat', ''));

    return {
      id: `template-${program.id}`,
      name: program.name,
      clientName: 'Class plan',
      goal: program.goal || program.description || 'FlowSmith template flow',
      selectedConditionIds: [],
      segments: this.createProgramSegments(program, items),
    };
  }

  clonePlan(plan: FlowPlan): FlowPlan {
    return {
      ...plan,
      selectedConditionIds: [...plan.selectedConditionIds],
      segments: plan.segments.map((segment) => ({
        ...segment,
        items: segment.items.map((item) => ({ ...item })),
      })),
    };
  }

  private createDemoPlan(): FlowPlan {
    return {
      id: 'morning-studio-flow',
      name: 'Morning Studio Flow',
      clientName: 'Demo client',
      goal: 'Core control, spinal articulation, and clean transitions',
      selectedConditionIds: ['osteoporosis'],
      segments: [
        {
          id: 'arrival',
          name: 'Arrival',
          intent: 'Breath, alignment, and nervous system settling',
          durationTargetMinutes: 8,
          items: [
            this.createItem('shoulder_rolls', 4, 'Mat', 'Set breath rhythm and rib awareness.'),
            this.createItem('pelvic_curl', 4, 'Mat', 'Keep the movement small and precise.'),
          ],
        },
        {
          id: 'main-flow',
          name: 'Main Flow',
          intent: 'Build heat with connected core and leg work',
          durationTargetMinutes: 32,
          items: [
            this.createItem('the_hundred', 6, 'Mat', 'Offer head-down option immediately.'),
            this.createItem('single_leg_stretch', 6, 'Mat', 'Cue quiet pelvis and broad collarbones.'),
            this.createItem('spine_stretch_forward', 7, 'Mat', 'Watch loaded flexion for safety.'),
          ],
        },
        {
          id: 'closing',
          name: 'Closing',
          intent: 'Downshift, integrate, and leave one clear takeaway',
          durationTargetMinutes: 10,
          items: [
            this.createItem('mermaid', 5, 'Mat', 'Keep both sitting bones heavy.'),
            this.createItem('roll_down', 5, 'Mat', 'Skip for osteoporosis clients.'),
          ],
        },
      ],
    };
  }

  private createBlankPlan(name: string): FlowPlan {
    return {
      id: `flow-${Date.now().toString(36)}`,
      name,
      clientName: 'Class plan',
      goal: '',
      selectedConditionIds: [],
      segments: [
        this.createSegment('arrival', 'Arrival', 'Breath, alignment, and nervous system settling', []),
        this.createSegment('main-flow', 'Main Flow', 'Build heat with connected core and full-body work', []),
        this.createSegment('closing', 'Closing', 'Downshift, integrate, and leave one clear takeaway', []),
      ],
    };
  }

  private createSavedFlowId(): string {
    return `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private createProgramSegments(program: Program, items: FlowItem[]): FlowSegment[] {
    if (items.length <= 4) {
      return [this.createSegment('main-flow', 'Main Flow', program.goal || 'Teach the selected template.', items)];
    }

    const arrivalCount = Math.min(2, Math.max(1, Math.floor(items.length * 0.2)));
    const closingCount = Math.min(2, Math.max(1, Math.floor(items.length * 0.2)));
    const arrival = items.slice(0, arrivalCount);
    const closing = items.slice(items.length - closingCount);
    const main = items.slice(arrivalCount, items.length - closingCount);

    return [
      this.createSegment('arrival', 'Arrival', 'Prepare breath, alignment, and movement quality.', arrival),
      this.createSegment('main-flow', 'Main Flow', program.goal || 'Teach the main template sequence.', main),
      this.createSegment('closing', 'Closing', 'Integrate and downshift before closing the class.', closing),
    ];
  }

  private createSegment(id: string, name: string, intent: string, items: FlowItem[]): FlowSegment {
    return {
      id,
      name,
      intent,
      durationTargetMinutes: items.reduce((total, item) => total + item.durationMinutes, 0),
      items,
    };
  }

  private createItem(exerciseId: string, durationMinutes: number, apparatus: string, notes: string): FlowItem {
    return {
      id: `${exerciseId}-${Math.random().toString(36).slice(2, 8)}`,
      exerciseId,
      durationMinutes,
      apparatus,
      notes,
    };
  }

  private readStoredPlan(): FlowPlan | null {
    const stored = localStorage.getItem(CURRENT_PLAN_KEY);
    if (!stored) {
      return null;
    }

    try {
      const plan = JSON.parse(stored) as FlowPlan;
      if (!plan.id || !Array.isArray(plan.segments)) {
        return null;
      }
      return plan;
    } catch {
      return null;
    }
  }

  private readStoredFlows(): FlowPlan[] {
    const stored = localStorage.getItem(SAVED_FLOWS_KEY);
    if (!stored) {
      return [];
    }

    try {
      const flows = JSON.parse(stored) as FlowPlan[];
      return Array.isArray(flows) ? flows.filter((flow) => flow?.id && Array.isArray(flow.segments)) : [];
    } catch {
      return [];
    }
  }

  private persistSavedFlows(flows: FlowPlan[]): void {
    this.savedFlowsSubject.next(flows);
    localStorage.setItem(SAVED_FLOWS_KEY, JSON.stringify(flows));
  }

  private readLastEditedAt(): Date | null {
    const stored = localStorage.getItem(LAST_EDITED_KEY);
    if (!stored) {
      return null;
    }

    const date = new Date(stored);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
