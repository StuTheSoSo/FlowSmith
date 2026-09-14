import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, shareReplay, throwError } from 'rxjs';
import { Contraindication, PilatesDataBundle, Exercise, LanguageOption } from './models';

@Injectable({ providedIn: 'root' })
export class FlowDataService {
  private static readonly LANGUAGE_KEY = 'flowsmith-language';

  readonly languages: LanguageOption[] = [
    { code: 'en', label: 'English', labelKey: 'SETTINGS.LANG_EN' },
    { code: 'ar', label: 'Arabic', labelKey: 'SETTINGS.LANG_AR' },
    { code: 'de', label: 'German', labelKey: 'SETTINGS.LANG_DE' },
    { code: 'es', label: 'Spanish', labelKey: 'SETTINGS.LANG_ES' },
    { code: 'fr', label: 'French', labelKey: 'SETTINGS.LANG_FR' },
    { code: 'it', label: 'Italian', labelKey: 'SETTINGS.LANG_IT' },
    { code: 'ja', label: 'Japanese', labelKey: 'SETTINGS.LANG_JA' },
    { code: 'pt', label: 'Portuguese', labelKey: 'SETTINGS.LANG_PT' },
    { code: 'zh-Hans', label: 'Chinese', labelKey: 'SETTINGS.LANG_ZH' },
  ];

  private readonly dataSubject = new BehaviorSubject<PilatesDataBundle | null>(null);
  readonly data$ = this.dataSubject.asObservable();

  private readonly languageSubject = new BehaviorSubject<string>(this.readStoredLanguage());
  readonly language$ = this.languageSubject.asObservable();

  private readonly bundleCache = new Map<string, Observable<PilatesDataBundle>>();

  constructor(
    private readonly http: HttpClient,
    private readonly translate: TranslateService
  ) {
    this.translate.addLangs(this.languages.map((language) => language.code));
    this.translate.setDefaultLang('en');
    this.translate.use(this.currentLanguage);
  }

  get currentLanguage(): string {
    return this.languageSubject.value;
  }

  setLanguage(language: string): void {
    if (language === this.currentLanguage) {
      return;
    }

    localStorage.setItem(FlowDataService.LANGUAGE_KEY, language);
    this.languageSubject.next(language);
    this.translate.use(language);
  }

  private readStoredLanguage(): string {
    const stored = localStorage.getItem(FlowDataService.LANGUAGE_KEY);
    return stored && this.languages.some((language) => language.code === stored) ? stored : 'en';
  }

  load(language = 'en'): Observable<PilatesDataBundle> {
    const cached = this.bundleCache.get(language);
    if (cached) {
      return cached;
    }

    const basePath = language === 'en' ? 'assets/data' : `assets/data/${language}`;

    const request$ = forkJoin({
      exercises: this.http.get<Exercise[]>(`${basePath}/exercises.json`),
      conditions: this.http.get<PilatesDataBundle['conditions']>(`${basePath}/safety-conditions.json`),
      contraindications: this.http.get<PilatesDataBundle['contraindications']>(`${basePath}/contraindications.json`),
      programs: this.http.get<PilatesDataBundle['programs']>(`${basePath}/programs.json`),
    }).pipe(
      catchError((error: unknown) => {
        this.bundleCache.delete(language);

        if (language !== 'en') {
          return this.load('en');
        }

        return throwError(() => error);
      }),
      map((bundle) => {
        this.dataSubject.next(bundle);
        return bundle;
      }),
      shareReplay(1)
    );

    this.bundleCache.set(language, request$);
    return request$;
  }

  findExercise(bundle: PilatesDataBundle, exerciseId: string): Exercise | undefined {
    return bundle.exercises.find((exercise) => exercise.id === exerciseId);
  }

  getWarnings(bundle: PilatesDataBundle, exerciseId: string, conditionIds: string[]): Contraindication[] {
    return conditionIds.flatMap((conditionId) =>
      (bundle.contraindications[conditionId] ?? []).filter((entry) => entry.exerciseId === exerciseId)
    );
  }

  searchExercises(bundle: PilatesDataBundle | null, query: string, limit = 18): Exercise[] {
    if (!bundle) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const matches = normalizedQuery
      ? bundle.exercises.filter((exercise) => this.exerciseSearchText(exercise).includes(normalizedQuery))
      : bundle.exercises;

    return matches.slice(0, limit);
  }

  getConditionLabel(bundle: PilatesDataBundle | null, conditionId: string): string {
    return bundle?.conditions.find((condition) => condition.id === conditionId)?.label ?? conditionId;
  }

  private exerciseSearchText(exercise: Exercise): string {
    return [
      exercise.name,
      exercise.shortDescription,
      exercise.focus,
      exercise.category,
      exercise.level,
      exercise.equipment,
      exercise.primaryMuscles?.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
}
