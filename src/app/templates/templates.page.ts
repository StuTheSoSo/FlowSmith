import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClassRunnerService } from '../class-runner.service';
import { FlowDataService } from '../flow-data.service';
import { FlowPlanService } from '../flow-plan.service';
import { PilatesDataBundle, Program } from '../models';

@Component({
  selector: 'app-templates',
  templateUrl: 'templates.page.html',
  styleUrls: ['templates.page.scss'],
  standalone: false,
})
export class TemplatesPage implements OnInit, OnDestroy {
  bundle: PilatesDataBundle | null = null;
  errorMessage = '';
  expandedTemplateId = '';

  private languageSubscription?: Subscription;

  constructor(
    private readonly flowData: FlowDataService,
    private readonly flowPlanService: FlowPlanService,
    private readonly classRunner: ClassRunnerService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.languageSubscription = this.flowData.language$.subscribe((language) => {
      this.flowData.load(language).subscribe({
        next: (bundle) => {
          this.bundle = bundle;
          this.errorMessage = '';
          this.changeDetector.detectChanges();
        },
        error: () => {
          this.errorMessage = 'FlowSmith could not load templates.';
          this.changeDetector.detectChanges();
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.languageSubscription?.unsubscribe();
  }

  get templates(): Program[] {
    return this.bundle?.programs.slice(0, 12) ?? [];
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

  getExerciseName(exerciseId: string): string {
    if (!this.bundle) {
      return exerciseId;
    }

    return this.flowData.findExercise(this.bundle, exerciseId)?.name ?? exerciseId;
  }

  startTemplate(program: Program): void {
    const plan = this.flowPlanService.createPlanFromProgram(program);
    this.classRunner.loadPlan(plan, 'template');
    this.router.navigateByUrl('/run');
  }

  trackProgram(_: number, program: Program): string {
    return program.id;
  }
}
