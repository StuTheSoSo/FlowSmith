import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const languages = ['en', 'ar', 'de', 'es', 'fr', 'it', 'ja', 'pt', 'zh-Hans'];
const readLocale = async language => JSON.parse(await readFile(new URL(`../src/assets/i18n/ui/${language}.json`, import.meta.url), 'utf8'));
const flatten = (value, prefix = '') => Object.entries(value ?? {}).flatMap(([key, child]) =>
  child && typeof child === 'object' ? flatten(child, `${prefix}${key}.`) : [[`${prefix}${key}`, child]]);
const english = await readLocale('en');
const expected = flatten(english.DASHBOARD);
assert.ok(expected.length >= 53, 'English Home and articles must be present');
const expectedWatch = flatten(english.ONBOARDING?.WATCH);
assert.equal(expectedWatch.length, 14, 'Watch onboarding must include capabilities and setup for both platforms');

for (const language of languages) {
  const locale = await readLocale(language);
  const actual = new Map(flatten(locale.DASHBOARD));
  assert.deepEqual([...actual.keys()].sort(), expected.map(([key]) => key).sort(), `${language}: Home/article keys differ`);
  for (const [key, source] of expected) {
    const value = actual.get(key);
    assert.ok(typeof value === 'string' && value.trim(), `${language}: empty ${key}`);
    if (language !== 'en' && source.length > 25) {
      assert.notEqual(value, source, `${language}: untranslated ${key}`);
    }
  }
  for (const key of ['TITLE_REQUIRED', 'CLEAR', 'CLEAR_CONFIRM_HEADER', 'CLEAR_CONFIRM_MESSAGE']) {
    assert.ok(typeof locale.HOME?.[key] === 'string' && locale.HOME[key].trim(), `${language}: missing HOME.${key}`);
  }
  const watch = new Map(flatten(locale.ONBOARDING?.WATCH));
  assert.deepEqual([...watch.keys()].sort(), expectedWatch.map(([key]) => key).sort(), `${language}: watch onboarding keys differ`);
  for (const [key, source] of expectedWatch) {
    const value = watch.get(key);
    assert.ok(typeof value === 'string' && value.trim(), `${language}: empty ONBOARDING.WATCH.${key}`);
    if (language !== 'en') assert.notEqual(value, source, `${language}: untranslated ONBOARDING.WATCH.${key}`);
  }
  console.log(`PASS ${language}: ${actual.size} Home/article keys, ${watch.size} watch onboarding keys and planner validation`);
}