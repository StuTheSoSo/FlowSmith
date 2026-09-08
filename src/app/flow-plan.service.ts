import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FlowItem, FlowPlan, FlowSegment, Program } from './models';

@Injectable({ providedIn: 'root' })
export class FlowPlanService {
  private readonly currentPlanSubject = new BehaviorSubject<FlowPlan>(this.createDemoPlan());
  readonly currentPlan$ = this.currentPlanSubject.asObservable();

  get currentPlan(): FlowPlan {
    return this.currentPlanSubject.value;
  }

  updateCurrentPlan(plan: FlowPlan): void {
    this.currentPlanSubject.next(plan);
  }

  createPlanFromProgram(program: Program): FlowPlan {
    const items = program.exerciseIds.map((exerciseId) => this.createItem(exerciseId, 5, 'Mat', ''));

    return {
      id: `template-${program.id}`,
      name: program.name,
      clientName: 'Class plan',
      goal: program.goal || program.description || 'SafePilates template flow',
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
}
