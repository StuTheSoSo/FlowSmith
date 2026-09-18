import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { FlowPlanService } from '../flow-plan.service';
import { FlowPlan, PilatesDataBundle, Program } from '../models';

@Component({
  selector: 'app-templates',
  templateUrl: 'templates.page.html',
  styleUrls: ['templates.page.scss'],
  standalone: false,
})
export class TemplatesPage implements OnInit, OnDestroy {
  bundle: PilatesDataBundle | null = null;
  isLoading = true;
  isNavigating = false;
  errorMessage = '';
  expandedTemplateId = '';
  activeView: 'templates' | 'flows' = 'templates';
  savedFlows: FlowPlan[] = [];

  private languageSubscription?: Subscription;
  private dataSubscription?: Subscription;
  private savedFlowsSubscription?: Subscription;

  constructor(
    private readonly flowData: FlowDataService,
    private readonly flowPlanService: FlowPlanService,
    private readonly classRunner: ClassRunnerService,
    private readonly alertController: AlertController,
    private readonly translate: TranslateService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe((language) => {
      this.loadBundle(language);
    });
    this.savedFlowsSubscription = this.flowPlanService.savedFlows$.subscribe((flows) => {
      this.savedFlows = flows;
      this.changeDetector.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
    this.savedFlowsSubscription?.unsubscribe();
  }

  get templates(): Program[] {
    return this.bundle?.programs.slice(0, 12) ?? [];
  }

  private loadBundle(language: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.dataSubscription?.unsubscribe();
    this.dataSubscription = this.flowData.load(language).subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.isLoading = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.bundle = null;
        this.isLoading = false;
        this.errorMessage = this.translate.instant('TEMPLATES.ERROR_BODY');
        this.changeDetector.detectChanges();
      },
    });
  }

  toggleTemplate(program: Program): void {
    this.expandedTemplateId = this.expandedTemplateId === program.id ? '' : program.id;
  }

  isExpanded(program: Program): boolean {
    return this.expandedTemplateId === program.id;
  }

  getTemplateDurationMinutes(program: Program): number {
    return program.exerciseIds.length * 5;
  }

  retryLoad(): void {
    this.loadBundle(this.flowData.currentLanguage);
  }

  getExerciseName(exerciseId: string): string {
    if (!this.bundle) {
      return exerciseId;
    }

    return this.flowData.findExercise(this.bundle, exerciseId)?.name ?? exerciseId;
  }

  startTemplate(program: Program): void {
    if (this.isNavigating) {
      return;
    }

    this.isNavigating = true;
    const plan = this.flowPlanService.createPlanFromProgram(program);
    this.classRunner.loadPlan(plan, 'template');
    this.router.navigateByUrl('/run').finally(() => {
      this.isNavigating = false;
      this.changeDetector.detectChanges();
    });
  }

  trackProgram(_: number, program: Program): string {
    return program.id;
  }

  setView(view: 'templates' | 'flows'): void {
    this.activeView = view;
  }

  getFlowExerciseCount(flow: FlowPlan): number {
    return flow.segments.reduce((total, segment) => total + segment.items.length, 0);
  }

  getFlowDurationMinutes(flow: FlowPlan): number {
    return flow.segments.reduce(
      (total, segment) => total + segment.items.reduce((segmentTotal, item) => segmentTotal + item.durationMinutes, 0),
      0
    );
  }

  createNewFlow(): void {
    this.flowPlanService.startBlankFlow();
    this.router.navigateByUrl('/home');
  }

  editFlow(flow: FlowPlan): void {
    this.flowPlanService.loadSavedFlowIntoPlanner(flow.id);
    this.router.navigateByUrl('/home');
  }

  startFlow(flow: FlowPlan): void {
    if (this.isNavigating) {
      return;
    }

    this.isNavigating = true;
    const plan = this.flowPlanService.clonePlan(flow);
    this.classRunner.loadPlan(plan, 'planner');
    this.router.navigateByUrl('/run').finally(() => {
      this.isNavigating = false;
      this.changeDetector.detectChanges();
    });
  }

  async confirmDeleteFlow(flow: FlowPlan): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('TEMPLATES.DELETE_CONFIRM_HEADER'),
      message: this.translate.instant('TEMPLATES.DELETE_CONFIRM_MESSAGE', { name: flow.name || this.translate.instant('HOME.UNTITLED_FLOW') }),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        { text: this.translate.instant('COMMON.DELETE'), role: 'destructive', handler: () => this.flowPlanService.deleteSavedFlow(flow.id) },
      ],
    });
    await alert.present();
  }

  trackFlow(_: number, flow: FlowPlan): string {
    return flow.id;
  }
}
