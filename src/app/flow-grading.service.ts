import { Injectable } from '@angular/core';
import {
  Exercise,
  FlowGradeCategory,
  FlowGradeReport,
  FlowItem,
  FlowPlan,
  FlowSegment,
  FlowShortcoming,
  PilatesDataBundle,
  SpinalAction,
} from './models';

interface GradedItem {
  item: FlowItem;
  segment: FlowSegment;
  exercise?: Exercise;
  actions: SpinalAction[];
  centered: boolean;
  expansion: boolean;
  breath: boolean;
  complexity: number;
}

@Injectable({ providedIn: 'root' })
export class FlowGradingService {
  gradeFlow(plan: FlowPlan, bundle: PilatesDataBundle): FlowGradeReport {
    const gradedItems = this.getGradedItems(plan, bundle);
    if (!gradedItems.length) {
      return this.emptyFlowReport();
    }

    const categories = [
      this.gradeStructure(plan, gradedItems),
      this.gradeBalance(gradedItems),
      this.gradeProgression(gradedItems),
      this.gradePrinciples(gradedItems),
      this.gradeTransitions(gradedItems),
    ];
    const shortcomings = this.findShortcomings(plan, gradedItems);
    const strengths = this.findStrengths(categories, gradedItems);
    const total = categories.reduce((sum, category) => sum + category.score, 0);
    const maxTotal = categories.reduce((sum, category) => sum + category.maxScore, 0);
    const overallScore = Math.round((total / maxTotal) * 100);

    return {
      overallScore,
      status: this.getStatus(overallScore),
      categories,
      strengths,
      shortcomings,
    };
  }

  private emptyFlowReport(): FlowGradeReport {
    return {
      overallScore: 0,
      status: 'needs-attention',
      categories: [
        this.category('structure', 'Structure and purpose', 0, 20, 'Add exercises before grading the class arc.'),
        this.category('balance', 'Movement balance', 0, 20, 'Add exercises before assessing movement variety.'),
        this.category('progression', 'Progression', 0, 15, 'Add exercises before assessing challenge progression.'),
        this.category('principles', 'Breath, centering, and expansion', 0, 20, 'Add exercises before assessing Pilates principles.'),
        this.category('transitions', 'Control and flow', 0, 10, 'Add exercises before assessing transitions.'),
      ],
      strengths: [],
      shortcomings: [{
        id: 'empty',
        severity: 'attention',
        title: 'The flow is empty',
        description: 'There are no exercises to assess yet.',
        suggestion: 'Add a few exercises, then review the score for balance, progression, breath, and transitions.',
        segmentIds: [],
        exerciseIds: [],
      }],
    };
  }

  private getGradedItems(plan: FlowPlan, bundle: PilatesDataBundle): GradedItem[] {
    return plan.segments.flatMap((segment) =>
      segment.items.map((item) => {
        const exercise = bundle.exercises.find((candidate) => candidate.id === item.exerciseId);
        const profile = exercise?.movementProfile;
        const text = this.exerciseText(exercise);
        return {
          item,
          segment,
          exercise,
          actions: profile?.spinalActions?.length ? profile.spinalActions : this.inferActions(text),
          centered: profile?.centered ?? this.hasAny(text, ['abdominal', 'core', 'pelvis', 'ribcage', 'center']),
          expansion: profile?.expansion ?? this.hasAny(text, ['length', 'lengthen', 'open', 'stretch', 'expand', 'long spine']),
          breath: profile?.breath ?? Boolean(exercise?.breathing),
          complexity: profile?.complexity ?? this.inferComplexity(exercise),
        };
      })
    );
  }

  private gradeStructure(plan: FlowPlan, items: GradedItem[]): FlowGradeCategory {
    const populatedSegments = new Set(items.map((item) => item.segment.id));
    const hasPreparation = plan.segments.some((segment) => populatedSegments.has(segment.id) && this.isPreparation(segment));
    const hasClosing = plan.segments.some((segment) => populatedSegments.has(segment.id) && this.isClosing(segment));
    const hasMain = plan.segments.some((segment) => populatedSegments.has(segment.id) && this.isMain(segment));
    const points = [hasPreparation, hasMain, hasClosing].filter(Boolean).length;
    return this.category('structure', 'Structure and purpose', points * 20 / 3, 20,
      points === 3 ? 'Preparation, main work, and closing are all represented.' : 'The flow has a recognizable shape, but one phase is not yet clear.');
  }

  private gradeBalance(items: GradedItem[]): FlowGradeCategory {
    const actions = new Set(items.flatMap((item) => item.actions));
    const pairs = [
      actions.has('flexion') && actions.has('extension'),
      actions.has('rotation') || actions.has('lateral-flexion'),
      actions.has('neutral'),
    ];
    const points = pairs.filter(Boolean).length;
    return this.category('balance', 'Movement balance', points * 20 / 3, 20,
      points >= 2 ? 'The movement vocabulary has useful variety.' : 'The flow leans heavily on one movement pattern.');
  }

  private gradeProgression(items: GradedItem[]): FlowGradeCategory {
    if (items.length < 2) {
      return this.category('progression', 'Progression', 5, 15, 'Add more exercises to assess progression.');
    }

    let increases = 0;
    let reversals = 0;
    for (let index = 1; index < items.length; index += 1) {
      const difference = items[index].complexity - items[index - 1].complexity;
      if (difference >= 0) {
        increases += 1;
      }
      if (difference > 1) {
        reversals += 1;
      }
    }
    const ratio = increases / (items.length - 1);
    const score = Math.max(0, Math.round((ratio * 15) - reversals * 2));
    return this.category('progression', 'Progression', score, 15,
      reversals ? 'At least one jump in complexity may arrive before the body is prepared.' : 'Challenge builds without abrupt jumps.');
  }

  private gradePrinciples(items: GradedItem[]): FlowGradeCategory {
    if (!items.length) {
      return this.category('principles', 'Breath, centering, and expansion', 0, 20, 'Add exercises to assess Pilates principles.');
    }

    const breath = items.filter((item) => item.breath).length / items.length;
    const centered = items.filter((item) => item.centered).length / items.length;
    const expansion = items.filter((item) => item.expansion).length / items.length;
    const score = Math.round(((breath + centered + expansion) / 3) * 20);
    return this.category('principles', 'Breath, centering, and expansion', score, 20,
      breath >= 0.6 && centered >= 0.6 && expansion >= 0.4
        ? 'Breath, center, and length are present throughout the flow.'
        : 'The flow has some principle-based work, but breath, center, or expansion is inconsistent.');
  }

  private gradeTransitions(items: GradedItem[]): FlowGradeCategory {
    if (items.length < 2) {
      return this.category('transitions', 'Control and flow', 0, 10, 'Add at least two exercises to assess transitions.');
    }

    let changes = 0;
    for (let index = 1; index < items.length; index += 1) {
      if (items[index].exercise?.movementProfile?.bodyPosition !== items[index - 1].exercise?.movementProfile?.bodyPosition) {
        changes += 1;
      }
    }
    const score = Math.max(0, 10 - Math.max(0, changes - 2) * 2);
    return this.category('transitions', 'Control and flow', score, 10,
      changes <= 2 ? 'Transitions are economical and support a continuous flow.' : 'Frequent position changes may interrupt the rhythm of the class.');
  }

  private findShortcomings(plan: FlowPlan, items: GradedItem[]): FlowShortcoming[] {
    const shortcomings: FlowShortcoming[] = [];
    const actions = new Set(items.flatMap((item) => item.actions));
    const add = (shortcoming: FlowShortcoming): void => {
      shortcomings.push(shortcoming);
    };

    if (!items.length) {
      add(this.issue('empty', 'No exercises yet', 'The flow cannot be graded until it has exercises.', 'Add a preparation, main-work, and closing exercise to establish a complete arc.', [], []));
      return shortcomings;
    }
    if (!plan.segments.some((segment) => this.isPreparation(segment))) {
      add(this.issue('no-preparation', 'Preparation is missing', 'The flow begins without a clearly identified arrival or warm-up phase.', 'Start with breath, alignment, gentle articulation, or low-complexity stability work.', plan.segments.slice(0, 1).map((segment) => segment.id), []));
    }
    if (!plan.segments.some((segment) => this.isClosing(segment))) {
      add(this.issue('no-closing', 'Closing is missing', 'There is no clear downshift or integration phase.', 'Finish with breath, length, gentle mobility, or a simple takeaway.', plan.segments.slice(-1).map((segment) => segment.id), []));
    }
    if (actions.has('flexion') && !actions.has('extension')) {
      add(this.issue('flexion-heavy', 'Flexion is not balanced', 'The flow includes flexion without a clear extension counterpoint.', 'Add supported extension, neutral-spine, or posterior-chain work if it suits the class goal.', this.uniqueSegments(items.filter((item) => item.actions.includes('flexion'))), this.uniqueExercises(items.filter((item) => item.actions.includes('flexion')))));
    }
    if (items.filter((item) => item.breath).length / items.length < 0.5) {
      add(this.issue('breath', 'Breath guidance is sparse', 'Fewer than half of the exercises have breathing guidance in the library data.', 'Add breath cues to the plan notes or choose exercises with clear breathing instructions.', this.uniqueSegments(items.filter((item) => !item.breath)), []));
    }
    return shortcomings;
  }

  private findStrengths(categories: FlowGradeCategory[], items: GradedItem[]): string[] {
    return categories.filter((category) => category.score / category.maxScore >= 0.75).map((category) => category.summary).slice(0, 3)
      .concat(items.length >= 5 ? ['The flow has enough variety for a meaningful sequence review.'] : []);
  }

  private category(id: string, label: string, score: number, maxScore: number, summary: string): FlowGradeCategory {
    const roundedScore = Math.max(0, Math.min(maxScore, Math.round(score)));
    return { id, label, score: roundedScore, maxScore, status: this.getStatus(Math.round((roundedScore / maxScore) * 100)), summary };
  }

  private issue(id: string, title: string, description: string, suggestion: string, segmentIds: string[], exerciseIds: string[]): FlowShortcoming {
    return { id, severity: 'attention', title, description, suggestion, segmentIds, exerciseIds };
  }

  private uniqueSegments(items: GradedItem[]): string[] { return [...new Set(items.map((item) => item.segment.id))]; }
  private uniqueExercises(items: GradedItem[]): string[] { return [...new Set(items.map((item) => item.item.exerciseId))]; }
  private isPreparation(segment: FlowSegment): boolean { return /arrival|warm|prep/i.test(`${segment.id} ${segment.name} ${segment.intent}`); }
  private isClosing(segment: FlowSegment): boolean { return /clos|cool|integrat|downshift/i.test(`${segment.id} ${segment.name} ${segment.intent}`); }
  private isMain(segment: FlowSegment): boolean { return !this.isPreparation(segment) && !this.isClosing(segment); }
  private getStatus(score: number): 'strong' | 'developing' | 'needs-attention' { return score >= 75 ? 'strong' : score >= 50 ? 'developing' : 'needs-attention'; }

  private exerciseText(exercise?: Exercise): string {
    return [exercise?.name, exercise?.shortDescription, exercise?.focus, exercise?.benefits, exercise?.breathing, exercise?.primaryMuscles?.join(' ')].filter(Boolean).join(' ').toLowerCase();
  }

  private hasAny(text: string, terms: string[]): boolean { return terms.some((term) => text.includes(term)); }

  private inferActions(text: string): SpinalAction[] {
    const actions: SpinalAction[] = [];
    if (this.hasAny(text, ['flexion', 'forward', 'roll up', 'roll down', 'curl', 'round'])) actions.push('flexion');
    if (this.hasAny(text, ['extension', 'swan', 'back extension', 'chest lift'])) actions.push('extension');
    if (this.hasAny(text, ['twist', 'rotation', 'mermaid'])) actions.push('rotation');
    if (this.hasAny(text, ['side bend', 'lateral'])) actions.push('lateral-flexion');
    if (this.hasAny(text, ['neutral', 'stability', 'stabil'])) actions.push('neutral');
    return actions.length ? actions : ['neutral'];
  }

  private inferComplexity(exercise?: Exercise): number {
    if (exercise?.level === 'Advanced') return 4;
    if (exercise?.level === 'Intermediate') return 3;
    return 1;
  }
}