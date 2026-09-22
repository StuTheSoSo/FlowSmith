import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { PilatesDataBundle } from '../models';
import { LibraryPage } from './library.page';

describe('Library exercise links', () => {
  it('resolves links after load, translates details, clears dismissed links and handles repeated navigation', () => {
    const params = new BehaviorSubject(convertToParamMap({ exercise: 'the_hundred' }));
    const language = new BehaviorSubject('en');
    const requests: Subject<PilatesDataBundle>[] = [];
    const service = {
      language$: language,
      load: () => { const request = new Subject<PilatesDataBundle>(); requests.push(request); return request; },
      findExercise: (bundle: PilatesDataBundle, id: string) => bundle.exercises.find(exercise => exercise.id === id),
    };
    const router = { navigate: jasmine.createSpy() };
    const page = new LibraryPage(service as unknown as FlowDataService, {} as TranslateService,
      { detectChanges: () => undefined } as ChangeDetectorRef,
      { queryParamMap: params } as unknown as ActivatedRoute, router as unknown as Router);
    const bundle = (name: string): PilatesDataBundle => ({ exercises: [{ id: 'the_hundred', name }], conditions: [], programs: [], contraindications: {} });
    page.ngOnInit();
    expect(page.selectedExercise).toBeNull();
    requests[0].next(bundle('Hundred'));
    expect(page.selectedExercise?.name).toBe('Hundred');
    language.next('fr');
    requests[1].next(bundle('Cent'));
    expect(page.selectedExercise?.name).toBe('Cent');
    page.closeExercise();
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { exercise: null }, replaceUrl: true }));
    params.next(convertToParamMap({}));
    language.next('en');
    requests[2].next(bundle('Hundred'));
    expect(page.selectedExercise).toBeNull();
    params.next(convertToParamMap({ exercise: 'missing' }));
    expect(page.selectedExercise).toBeNull();
    params.next(convertToParamMap({ exercise: 'the_hundred' }));
    expect(page.selectedExercise?.name).toBe('Hundred');
    page.ngOnDestroy();
  });
});