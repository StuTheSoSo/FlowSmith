import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { FlowGradingService } from '../flow-grading.service';
import { FlowPlanService } from '../flow-plan.service';
import { Contraindication, Exercise, FlowGradeReport, FlowItem, FlowPlan, FlowSegment, PilatesDataBundle } from '../models';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  bundle: PilatesDataBundle | null = null;
  searchTerm = '';
  selectedSegmentId = 'main-flow';
  highlightedItemId = '';
  isLoading = true;
  errorMessage = '';
  flowGrade: FlowGradeReport | null = null;

  private languageSubscription?: Subscription;
  private highlightTimeout?: ReturnType<typeof setTimeout>;

  readonly plan: FlowPlan;

  constructor(
    readonly flowData: FlowDataService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly flowPlanService: FlowPlanService,
    private readonly flowGradingService: FlowGradingService,
    private readonly classRunner: ClassRunnerService,
    private readonly alertController: AlertController,
    private readonly router: Router
  ) {
    this.plan = this.flowPlanService.currentPlan;
  }

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe((language) => this.loadBundle(language));
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    clearTimeout(this.highlightTimeout);
  }

  private loadBundle(language: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.flowData.load(language).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.refreshGrade();
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.errorMessage = 'FlowSmith could not load the Pilates library.';
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  get selectedSegment(): FlowSegment {
    return this.plan.segments.find((segment) => segment.id === this.selectedSegmentId) ?? this.plan.segments[0];
  }

  selectSegment(segmentId: string): void {
    this.selectedSegmentId = segmentId;

    this.scrollTimelineTo(document.getElementById(`segment-${segmentId}`));
  }

  private scrollTimelineTo(target: HTMLElement | null): void {
    const container = document.querySelector<HTMLElement>('.timeline');
    if (!container || !target) {
      return;
    }

    const scrollTop = container.scrollTop + (target.getBoundingClientRect().top - container.getBoundingClientRect().top);
    container.scrollTo({ top: scrollTop, behavior: 'smooth' });
  }

  get filteredExercises(): Exercise[] {
    return this.flowData.searchExercises(this.bundle, this.searchTerm);
  }

  get planDurationMinutes(): number {
    return this.plan.segments.reduce((total, segment) => total + this.getSegmentDuration(segment), 0);
  }

  get planExerciseCount(): number {
    return this.plan.segments.reduce((total, segment) => total + segment.items.length, 0);
  }

  get planSaveStatus(): string {
    const savedAt = this.flowPlanService.lastEditedAt;
    return savedAt ? `Saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not saved yet';
  }

  get isSavedToLibrary(): boolean {
    return !!this.plan.savedAt;
  }

  async saveFlow(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.isSavedToLibrary ? 'Update flow in library' : 'Save flow to library',
      inputs: [{ name: 'name', type: 'text', value: this.plan.name, placeholder: 'Flow name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            this.flowPlanService.saveCurrentPlanAsFlow(data?.name);
            this.changeDetector.detectChanges();
          },
        },
      ],
    });
    await alert.present();
  }

  get conditionLabels(): string {
    return this.plan.selectedConditionIds
      .map((conditionId) => this.flowData.getConditionLabel(this.bundle, conditionId))
      .join(', ');
  }

  addExercise(exercise: Exercise): void {
    const item = this.createItem(exercise.id, 5, exercise.equipment ?? exercise.category ?? 'Mat', '');
    this.selectedSegment.items.push(item);
    this.commitPlanChange();
    this.highlightedItemId = item.id;
    clearTimeout(this.highlightTimeout);
    this.changeDetector.detectChanges();

    requestAnimationFrame(() => this.scrollTimelineTo(document.getElementById(`item-${item.id}`)));
    this.highlightTimeout = setTimeout(() => {
      this.highlightedItemId = '';
      this.changeDetector.detectChanges();
    }, 1400);
  }

  startClass(): void {
    if (!this.planExerciseCount) {
      this.scrollToLibrary();
      return;
    }

    this.classRunner.loadPlan(this.plan, 'planner');
    this.router.navigateByUrl('/run');
  }

  addFirstExercise(): void {
    this.scrollToLibrary();
  }

  removeItem(segment: FlowSegment, item: FlowItem): void {
    segment.items = segment.items.filter((candidate) => candidate.id !== item.id);
    this.commitPlanChange();
  }

  duplicateItem(segment: FlowSegment, item: FlowItem): void {
    const index = segment.items.findIndex((candidate) => candidate.id === item.id);
    const duplicate = { ...item, id: `${item.exerciseId}-${Date.now()}` };
    segment.items.splice(index + 1, 0, duplicate);
    this.commitPlanChange();
  }

  moveItem(segment: FlowSegment, item: FlowItem, direction: -1 | 1): void {
    const currentIndex = segment.items.findIndex((candidate) => candidate.id === item.id);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= segment.items.length) {
      return;
    }

    segment.items.splice(currentIndex, 1);
    segment.items.splice(nextIndex, 0, item);
    this.commitPlanChange();
  }

  updateDuration(item: FlowItem, value: unknown): void {
    const nextValue = Number(value);
    item.durationMinutes = Number.isFinite(nextValue) && nextValue > 0 ? nextValue : item.durationMinutes;
    this.commitPlanChange();
  }

  updateNotes(item: FlowItem, value: unknown): void {
    item.notes = String(value ?? '');
    this.commitPlanChange();
  }

  getExercise(item: FlowItem): Exercise | undefined {
    return this.bundle ? this.flowData.findExercise(this.bundle, item.exerciseId) : undefined;
  }

  getWarnings(item: FlowItem): Contraindication[] {
    return this.bundle ? this.flowData.getWarnings(this.bundle, item.exerciseId, this.plan.selectedConditionIds) : [];
  }

  getSegmentDuration(segment: FlowSegment): number {
    return segment.items.reduce((total, item) => total + item.durationMinutes, 0);
  }

  trackSegment(_: number, segment: FlowSegment): string {
    return segment.id;
  }

  trackItem(_: number, item: FlowItem): string {
    return item.id;
  }

  trackExercise(_: number, exercise: Exercise): string {
    return exercise.id;
  }

  getSegmentLabel(segment: FlowSegment): string {
    if (segment.id === 'arrival') {
      return 'Arrive';
    }
    if (segment.id === 'closing') {
      return 'Close';
    }
    if (segment.id === 'main-flow') {
      return 'Main';
    }
    return segment.name;
  }

  private scrollToLibrary(): void {
    document.querySelector<HTMLElement>('.library-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private commitPlanChange(): void {
    this.flowPlanService.updateCurrentPlan(this.plan);
    this.refreshGrade();
    this.changeDetector.detectChanges();
  }

  private refreshGrade(): void {
    this.flowGrade = this.bundle ? this.flowGradingService.gradeFlow(this.plan, this.bundle) : null;
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
