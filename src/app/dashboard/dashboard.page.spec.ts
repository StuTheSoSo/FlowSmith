import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { PilatesDataBundle } from '../models';
import { ArticlePage } from './article.page';
import { DashboardPage } from './dashboard.page';
import { FEATURED_EXERCISE_ID } from './dashboard-content';

describe('Pilates Home', () => {
  const bundle: PilatesDataBundle = { exercises: [{ id: FEATURED_EXERCISE_ID, name: 'Hundred' }], conditions: [], programs: [], contraindications: {} };
  const detector = { detectChanges: () => undefined } as ChangeDetectorRef;

  it('loads the featured exercise and refreshes it when the language changes', () => {
    const language = new BehaviorSubject('en');
    const service = {
      language$: language, load: jasmine.createSpy().and.callFake((locale: string) => of({ ...bundle, exercises: [{ id: FEATURED_EXERCISE_ID, name: locale }] })),
      findExercise: (data: PilatesDataBundle, id: string) => data.exercises.find(exercise => exercise.id === id),
    };
    const page = new DashboardPage(service as unknown as FlowDataService, detector);
    page.ngOnInit();
    expect(page.exercise?.name).toBe('en');
    language.next('fr');
    expect(page.exercise?.name).toBe('fr');
    expect(page.articles.length).toBe(3);
    page.ngOnDestroy();
    language.next('de');
    expect(service.load).toHaveBeenCalledTimes(2);
  });

  it('keeps articles available if the featured exercise fails', () => {
    const request = new Subject<PilatesDataBundle>();
    const page = new DashboardPage({ language$: of('en'), load: () => request } as unknown as FlowDataService, detector);
    page.ngOnInit();
    expect(page.loading).toBeTrue();
    request.error(new Error('offline'));
    expect(page.failed).toBeTrue();
    expect(page.loading).toBeFalse();
    expect(page.articles.length).toBe(3);
    page.ngOnDestroy();
  });

  it('resolves article slugs and redirects unknown articles to Home', () => {
    const params = new BehaviorSubject(convertToParamMap({ slug: 'breathing' }));
    const router = { navigateByUrl: jasmine.createSpy() };
    const page = new ArticlePage({ paramMap: params } as unknown as ActivatedRoute, router as unknown as Router, {} as FlowDataService);
    page.ngOnInit();
    expect(page.article?.key).toBe('BREATHING');
    params.next(convertToParamMap({ slug: 'missing' }));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
    page.ngOnDestroy();
  });
});