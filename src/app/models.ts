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
  movementProfile?: ExerciseMovementProfile;
}

export type SpinalAction = 'flexion' | 'extension' | 'rotation' | 'lateral-flexion' | 'neutral';
export type FlowRole = 'preparation' | 'main' | 'closing';

export interface ExerciseMovementProfile {
  spinalActions?: SpinalAction[];
  centered?: boolean;
  expansion?: boolean;
  breath?: boolean;
  bodyPosition?: 'supine' | 'prone' | 'seated' | 'kneeling' | 'standing' | 'side-lying' | string;
  complexity?: 1 | 2 | 3 | 4 | 5;
  flowRoles?: FlowRole[];
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
  /** Set only when this plan has been saved to the flow library; absent for demo/template/draft plans. */
  savedAt?: string;
}

export interface PilatesDataBundle {
  exercises: Exercise[];
  conditions: SafetyCondition[];
  contraindications: ContraindicationMap;
  programs: Program[];
}

export type FlowGradeStatus = 'strong' | 'developing' | 'needs-attention';

export interface FlowGradeCategory {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  status: FlowGradeStatus;
  summary: string;
}

export interface FlowShortcoming {
  id: string;
  severity: 'info' | 'attention';
  title: string;
  description: string;
  suggestion: string;
  segmentIds: string[];
  exerciseIds: string[];
}

export interface FlowGradeReport {
  overallScore: number;
  status: FlowGradeStatus;
  categories: FlowGradeCategory[];
  strengths: string[];
  shortcomings: FlowShortcoming[];
}

export interface LanguageOption {
  code: string;
  label: string;
}

export type ClassRunSource = 'planner' | 'template';
export type RunnerStatus = 'ready' | 'running' | 'paused' | 'completed';

export interface RunnerSettings {
  autoAdvanceOnExerciseEnd: boolean;
  exerciseEndSound: boolean;
  exerciseEndHaptics: boolean;
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
