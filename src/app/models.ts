export interface Exercise {
  id: string;
  name: string;
  shortDescription?: string;
  focus?: string;
  benefits?: string;
  category?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  equipment?: string;
  reps?: string;
  breathing?: string;
  setup?: string;
  instructions?: Array<string | string[]>;
  modifications?: string[];
  progressions?: string[];
  commonMistakes?: string[];
  primaryMuscles?: string[];
  contraindicationsNote?: string;
  alternativeExercise?: string;
  teachingCues?: string[];
}

export interface SafetyCondition {
  id: string;
  label: string;
  description?: string;
  hasTrimester?: boolean;
}

export interface Contraindication {
  exerciseId: string;
  reason: string;
  alternative?: string;
}

export type ContraindicationMap = Record<string, Contraindication[]>;

export interface Program {
  id: string;
  name: string;
  description?: string;
  level?: string;
  goal?: string;
  focusAreas?: string[];
  exerciseIds: string[];
  accessLevel?: 'Free' | 'Pro' | string;
}

export interface FlowItem {
  id: string;
  exerciseId: string;
  durationMinutes: number;
  notes: string;
  apparatus: string;
}

export interface FlowSegment {
  id: string;
  name: string;
  intent: string;
  durationTargetMinutes: number;
  items: FlowItem[];
}

export interface FlowPlan {
  id: string;
  name: string;
  clientName: string;
  goal: string;
  selectedConditionIds: string[];
  segments: FlowSegment[];
}

export interface PilatesDataBundle {
  exercises: Exercise[];
  conditions: SafetyCondition[];
  contraindications: ContraindicationMap;
  programs: Program[];
}

export interface LanguageOption {
  code: string;
  label: string;
}

export type ClassRunSource = 'planner' | 'template';
export type RunnerStatus = 'ready' | 'running' | 'paused' | 'completed';

export interface RunnerSettings {
  autoAdvanceOnExerciseEnd: boolean;
}

export interface RunExercise {
  id: string;
  exerciseId: string;
  segmentId: string;
  segmentName: string;
  durationSeconds: number;
  notes: string;
  apparatus: string;
}

export interface ClassRunState {
  source: ClassRunSource;
  plan: FlowPlan;
  exercises: RunExercise[];
  currentIndex: number;
  currentExerciseElapsedSeconds: number;
  elapsedSeconds: number;
  status: RunnerStatus;
  completedExerciseId?: string;
}
