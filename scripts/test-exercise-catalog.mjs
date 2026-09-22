import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const classicalMatIds = [
  'the_hundred', 'roll_up', 'roll_over', 'one_leg_circle', 'rolling_like_a_ball',
  'single_leg_stretch', 'double_leg_stretch', 'spine_stretch_forward', 'open_leg_rocker',
  'corkscrew', 'saw', 'swan_dive', 'one_leg_kick', 'double_leg_kick', 'neck_pull',
  'scissors', 'bicycle', 'shoulder_bridge', 'spine_twist', 'jackknife', 'side_kick',
  'teaser', 'hip_twist', 'swimming', 'leg_pull_front', 'leg_pull_back', 'side_kick_kneeling',
  'side_bend', 'boomerang', 'seal', 'crab', 'rocking', 'control_balance', 'push_up',
];
const languages = ['en', 'ar', 'de', 'es', 'fr', 'it', 'ja', 'pt', 'zh-Hans'];
let englishIds;

for (const language of languages) {
  const path = new URL(`../src/assets/data/${language === 'en' ? '' : `${language}/`}exercises.json`, import.meta.url);
  const exercises = JSON.parse(await readFile(path, 'utf8'));
  const ids = exercises.map((exercise) => exercise.id).sort();
  assert.equal(new Set(ids).size, ids.length, `${language}: duplicate exercise IDs`);
  englishIds ??= ids;
  assert.deepEqual(ids, englishIds, `${language}: catalog must match English IDs`);
  for (const id of classicalMatIds) {
    assert.ok(ids.includes(id), `${language}: missing classical mat exercise ${id}`);
  }
  for (const exercise of exercises) {
    for (const field of ['id', 'name', 'equipment', 'level']) {
      assert.ok(typeof exercise[field] === 'string' && exercise[field].trim(), `${language}/${exercise.id}: missing ${field}`);
    }
  }
  console.log(`PASS ${language}: ${ids.length} unique exercises; 34 classical mat entries present`);
}