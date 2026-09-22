import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { PilatesDataBundle } from '../models';
import { ArticlePage } from './article.page';
import { DashboardPage } from './dashboard.page';
import { dailyFeaturedExercise } from './dashboard-content';

describe('Pilates Home', () => {
  const bundle: PilatesDataBundle = { exercises: [{ id: 'the_hundred', name: 'Hundred' }, { id: 'roll_up', name: 'Roll Up' }, { id: 'swan', name: 'Swan' }], conditions: [], programs: [], contraindications: {} };
  const detector = { detectChanges: () => undefined } as ChangeDetectorRef;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 22, 12));
  });

  afterEach(() => jasmine.clock().uninstall());

  it('loads the featured exercise and refreshes it when the language changes', () => {
    const language = new BehaviorSubject('en');
    const service = {
      language$: language, load: jasmine.createSpy().and.callFake((locale: string) => of({ ...bundle, exercises: [...bundle.exercises].reverse().map(exercise => ({ ...exercise, name: locale })) })),
      findExercise: (data: PilatesDataBundle, id: string) => data.exercises.find(exercise => exercise.id === id),
    };
    const page = new DashboardPage(service as unknown as FlowDataService, detector);
    page.ngOnInit();
    const selectedId = page.exercise?.id;
    expect(page.exercise?.name).toBe('en');
    language.next('fr');
    expect(page.exercise?.name).toBe('fr');
    expect(page.exercise?.id).toBe(selectedId);
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

  it('uses the local calendar day and stable IDs without mutating the catalog', () => {
    const original = [...bundle.exercises];
    const morning = new Date(2026, 2, 8, 0, 1);
    const evening = new Date(2026, 2, 8, 23, 59);
    const nextDay = new Date(2026, 2, 9, 0, 1);
    const selected = dailyFeaturedExercise(bundle.exercises, morning)?.id;
    expect(dailyFeaturedExercise([...bundle.exercises].reverse(), evening)?.id).toBe(selected);
    expect(dailyFeaturedExercise(bundle.exercises, nextDay)?.id).not.toBe(selected);
    expect(dailyFeaturedExercise(bundle.exercises, new Date(2026, 2, 11))?.id).toBe(selected);
    expect(bundle.exercises).toEqual(original);
    expect(dailyFeaturedExercise([], morning)).toBeNull();
    expect(dailyFeaturedExercise([bundle.exercises[0]], nextDay)).toBe(bundle.exercises[0]);
  });

  it('rotates at local midnight and stops scheduling after destruction', () => {
    jasmine.clock().mockDate(new Date(2026, 8, 22, 23, 59, 59));
    const service = { language$: of('en'), load: jasmine.createSpy().and.returnValue(of(bundle)) };
    const page = new DashboardPage(service as unknown as FlowDataService, detector);
    page.ngOnInit();
    const selectedId = page.exercise?.id;
    jasmine.clock().tick(999);
    expect(page.exercise?.id).toBe(selectedId);
    jasmine.clock().tick(1);
    expect(page.exercise?.id).not.toBe(selectedId);
    expect(service.load).toHaveBeenCalledTimes(2);
    page.ngOnDestroy();
    jasmine.clock().tick(86400000);
    expect(service.load).toHaveBeenCalledTimes(2);
  });

  it('refreshes a cached Home page when returning on another day', () => {
    spyOnProperty(document, 'visibilityState').and.returnValue('visible');
    const service = { language$: of('en'), load: jasmine.createSpy().and.returnValue(of(bundle)) };
    const page = new DashboardPage(service as unknown as FlowDataService, detector);
    page.ngOnInit();
    const selectedId = page.exercise?.id;
    page.ionViewWillEnter();
    expect(service.load).toHaveBeenCalledTimes(1);
    jasmine.clock().mockDate(new Date(2026, 8, 23, 12));
    page.ionViewWillEnter();
    expect(page.exercise?.id).not.toBe(selectedId);
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