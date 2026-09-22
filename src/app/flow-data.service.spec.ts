import { FlowDataService } from './flow-data.service';
import { PilatesDataBundle } from './models';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

describe('FlowDataService catalog search', () => {
  const service = Object.create(FlowDataService.prototype) as FlowDataService;
  const bundle: PilatesDataBundle = {
    exercises: Array.from({ length: 93 }, (_, index) => ({
      id: `exercise-${index}`, name: `Movement ${index}`, equipment: index < 60 ? 'Mat' : 'Reformer',
    })),
    conditions: [], contraindications: {}, programs: [],
  };

  it('returns the entire catalog and equipment matches beyond the former cutoffs', () => {
    expect(service.searchExercises(bundle, '').length).toBe(93);
    expect(service.searchExercises(bundle, 'Movement').length).toBe(93);
    expect(service.searchExercises(bundle, 'Reformer').length).toBe(33);
    expect(service.searchExercises(bundle, 'Movement 92')[0].id).toBe('exercise-92');
    expect(service.searchExercises(bundle, '', 5).length).toBe(5);
    expect(service.searchExercises(null, '')).toEqual([]);
  });

  it('republishes translated content when switching back to a cached language', () => {
    const get = jasmine.createSpy('get').and.callFake((url: string) => of(
      url.endsWith('/exercises.json') ? [{ id: 'first', name: url.includes('/fr/') ? 'La centaine' : 'The Hundred' }]
        : url.endsWith('/contraindications.json') ? {} : []
    ));
    const translate = { addLangs: () => undefined, setDefaultLang: () => undefined, use: () => undefined };
    const data = new FlowDataService({ get } as unknown as HttpClient, translate as unknown as TranslateService);
    const names: string[] = [];
    const subscription = data.data$.subscribe((value) => { if (value) names.push(value.exercises[0].name); });
    data.load('en').subscribe();
    data.load('fr').subscribe();
    data.load('en').subscribe();
    expect(names).toEqual(['The Hundred', 'La centaine', 'The Hundred']);
    expect(get).toHaveBeenCalledTimes(8);
    subscription.unsubscribe();
  });
});