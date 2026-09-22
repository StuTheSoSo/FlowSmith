import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TranslateService } from '@ngx-translate/core';
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
  gradeExpanded = true;
  pickerOpen = false;
  equipmentFilter = '';
  levelFilter = '';
  expandedItemId = '';
  pickerAddedCount = 0;

  private languageSubscription?: Subscription;
  private dataSubscription?: Subscription;
  private highlightTimeout?: ReturnType<typeof setTimeout>;

  plan: FlowPlan;

  constructor(
    readonly flowData: FlowDataService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly flowPlanService: FlowPlanService,
    private readonly flowGradingService: FlowGradingService,
    private readonly classRunner: ClassRunnerService,
    private readonly alertController: AlertController,
    private readonly translate: TranslateService,
    private readonly router: Router,
    private readonly actionSheetController: ActionSheetController
  ) {
    this.plan = this.flowPlanService.currentPlan;
  }

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe((language) => this.loadBundle(language));
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
    clearTimeout(this.highlightTimeout);
  }

  private loadBundle(language: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.searchTerm = '';
    this.equipmentFilter = '';
    this.levelFilter = '';
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = this.flowData.load(language).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.refreshGrade();
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.errorMessage = this.translate.instant('HOME.LOAD_ERROR');
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  get selectedSegment(): FlowSegment {
    return this.plan.segments.find((segment) => segment.id === this.selectedSegmentId) ?? this.plan.segments[0];
  }

  openExercisePicker(segment: FlowSegment): void {
    this.selectedSegmentId = segment.id;
    this.searchTerm = '';
    this.equipmentFilter = '';
    this.levelFilter = '';
    this.pickerAddedCount = 0;
    this.pickerOpen = true;
  }

  get filteredExercises(): Exercise[] {
    return this.flowData.searchExercises(this.bundle, this.searchTerm).filter((exercise) =>
      (!this.equipmentFilter || exercise.equipment === this.equipmentFilter) &&
      (!this.levelFilter || exercise.level === this.levelFilter)
    );
  }

  get equipmentOptions(): string[] {
    return [...new Set(this.bundle?.exercises.map((exercise) => exercise.equipment).filter((value): value is string => !!value) ?? [])].sort();
  }

  get levelOptions(): string[] {
    return [...new Set(this.bundle?.exercises.map((exercise) => exercise.level).filter((value): value is string => !!value) ?? [])].sort();
  }

  getExerciseCountInSection(exercise: Exercise): number {
    return this.selectedSegment.items.filter((item) => item.exerciseId === exercise.id).length;
  }

  toggleItem(item: FlowItem): void {
    this.expandedItemId = this.expandedItemId === item.id ? '' : item.id;
  }

  async showItemActions(segment: FlowSegment, item: FlowItem): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: this.getExercise(item)?.name || item.exerciseId,
      buttons: [
        { text: this.translate.instant('HOME.DUPLICATE_ARIA'), icon: 'copy-outline', handler: () => this.duplicateItem(segment, item) },
        { text: this.translate.instant('HOME.MOVE_UP_ARIA'), icon: 'arrow-up-outline', handler: () => this.moveItem(segment, item, -1) },
        { text: this.translate.instant('HOME.MOVE_DOWN_ARIA'), icon: 'arrow-down-outline', handler: () => this.moveItem(segment, item, 1) },
        { text: this.translate.instant('HOME.REMOVE_ARIA'), icon: 'trash-outline', role: 'destructive', handler: () => this.removeItem(segment, item) },
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  moveItem(segment: FlowSegment, item: FlowItem, direction: number): void {
    const index = segment.items.indexOf(item);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= segment.items.length) {
      return;
    }
    moveItemInArray(segment.items, index, nextIndex);
    this.commitPlanChange();
  }

  get planDurationMinutes(): number {
    return this.plan.segments.reduce((total, segment) => total + this.getSegmentDuration(segment), 0);
  }

  get planExerciseCount(): number {
    return this.plan.segments.reduce((total, segment) => total + segment.items.length, 0);
  }

  get planSavedAtTime(): string | null {
    const savedAt = this.flowPlanService.lastEditedAt;
    return savedAt ? savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  }

  get isSavedToLibrary(): boolean {
    return !!this.plan.savedAt;
  }

  async saveFlow(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant(this.isSavedToLibrary ? 'HOME.SAVE_ALERT_HEADER_UPDATE' : 'HOME.SAVE_ALERT_HEADER_NEW'),
      inputs: [{ name: 'name', type: 'text', value: this.plan.name, placeholder: this.translate.instant('HOME.SAVE_ALERT_PLACEHOLDER'), attributes: { required: true } }],
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.SAVE'),
          handler: (data) => {
            const name = typeof data?.name === 'string' ? data.name.trim() : '';
            if (!name) {
              alert.message = this.translate.instant('HOME.TITLE_REQUIRED');
              return false;
            }
            this.flowPlanService.saveCurrentPlanAsFlow(name);
            this.changeDetector.detectChanges();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmClearFlow(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('HOME.CLEAR_CONFIRM_HEADER'),
      message: this.translate.instant('HOME.CLEAR_CONFIRM_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('HOME.CLEAR'),
          role: 'destructive',
          handler: () => {
            this.plan = this.flowPlanService.startBlankFlow('');
            clearTimeout(this.highlightTimeout);
            this.selectedSegmentId = this.plan.segments[0].id;
            this.highlightedItemId = '';
            this.expandedItemId = '';
            this.searchTerm = '';
            this.equipmentFilter = '';
            this.levelFilter = '';
            this.pickerAddedCount = 0;
            this.pickerOpen = false;
            this.refreshGrade();
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
    this.pickerAddedCount += 1;
    this.commitPlanChange();
    this.highlightedItemId = item.id;
    clearTimeout(this.highlightTimeout);
    this.changeDetector.detectChanges();

    this.highlightTimeout = setTimeout(() => {
      this.highlightedItemId = '';
      this.changeDetector.detectChanges();
    }, 1400);
  }

  startClass(): void {
    if (!this.planExerciseCount) {
      this.addFirstExercise();
      return;
    }

    this.classRunner.loadPlan(this.plan, 'planner');
    this.router.navigateByUrl('/run');
  }

  addFirstExercise(): void {
    this.openExercisePicker(this.plan.segments[0]);
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

  dropItem(segment: FlowSegment, event: CdkDragDrop<FlowItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    moveItemInArray(segment.items, event.previousIndex, event.currentIndex);
    this.commitPlanChange();
  }

  async editDuration(item: FlowItem): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('HOME.DURATION_ARIA'),
      subHeader: this.getExercise(item)?.name || item.exerciseId,
      inputs: [{ name: 'minutes', type: 'number', value: item.durationMinutes, min: 0.25, attributes: { step: 0.25, 'aria-label': this.translate.instant('HOME.DURATION_ARIA') } }],
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.SAVE'),
          handler: (data) => {
            if (this.updateDuration(item, data?.minutes)) return true;
            alert.message = this.translate.instant('COMMON.INVALID_DURATION', { seconds: 15 });
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  updateDuration(item: FlowItem, value: unknown): boolean {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue) || nextValue < 0.25 || !Number.isSafeInteger(Math.round(nextValue * 60))) {
      return false;
    }
    item.durationMinutes = nextValue;
    this.commitPlanChange();
    return true;
  }

  updateNotes(item: FlowItem, value: unknown): void {
    item.notes = String(value ?? '');
    this.flowPlanService.updateCurrentPlan(this.plan);
  }

  updatePlanName(value: unknown): void {
    this.plan.name = String(value ?? '');
    // Skip commitPlanChange's forced detectChanges() here: it re-writes the
    // ion-input's value mid-keystroke and resets the caret to the start.
    this.flowPlanService.updateCurrentPlan(this.plan);
    this.refreshGrade();
  }

  finalizePlanName(): void {
    // Leave the name blank so the input's placeholder ("Untitled Flow") shows
    // as an obvious hint rather than being committed as a real title.
    const trimmed = this.plan.name.trim();
    if (trimmed !== this.plan.name) {
      this.plan.name = trimmed;
      this.commitPlanChange();
    }
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

  isSegmentComplete(segment: FlowSegment): boolean {
    return segment.items.length > 0;
  }

  getSegmentProgressPercent(segment: FlowSegment): number {
    if (!segment.durationTargetMinutes) {
      return segment.items.length ? 100 : 0;
    }

    return Math.min(140, Math.round((this.getSegmentDuration(segment) / segment.durationTargetMinutes) * 100));
  }

  getSegmentProgressStatus(segment: FlowSegment): 'empty' | 'under' | 'good' | 'over' {
    if (!segment.items.length) {
      return 'empty';
    }

    const percent = this.getSegmentProgressPercent(segment);
    if (percent < 70) {
      return 'under';
    }
    if (percent > 115) {
      return 'over';
    }
    return 'good';
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
      return 'HOME.SEGMENT_ARRIVE';
    }
    if (segment.id === 'closing') {
      return 'HOME.SEGMENT_CLOSE';
    }
    if (segment.id === 'main-flow') {
      return 'HOME.SEGMENT_MAIN';
    }
    return segment.name;
  }

  get gradeStatusKey(): string {
    switch (this.flowGrade?.status) {
      case 'strong':
        return 'HOME.GRADE_STATUS_STRONG';
      case 'developing':
        return 'HOME.GRADE_STATUS_DEVELOPING';
      default:
        return 'HOME.GRADE_STATUS_NEEDS_ATTENTION';
    }
  }

  toggleGradeExpanded(): void {
    this.gradeExpanded = !this.gradeExpanded;
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
