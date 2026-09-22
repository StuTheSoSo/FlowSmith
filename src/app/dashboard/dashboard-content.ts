import { Exercise } from '../models';

export const ARTICLES = [
  { slug: 'principles', key: 'PRINCIPLES', icon: 'compass-outline' },
  { slug: 'breathing', key: 'BREATHING', icon: 'leaf-outline' },
  { slug: 'alignment', key: 'ALIGNMENT', icon: 'body-outline' },
] as const;

export const FURTHER_RESOURCES = [
  { publisher: 'NHS', key: 'EXERCISE', url: 'https://www.nhs.uk/live-well/exercise/' },
  { publisher: 'Pilates Foundation', key: 'PILATES', url: 'https://www.pilatesfoundation.com/pilates/' },
  { publisher: 'Pilates Method Alliance', key: 'PROFESSIONAL', url: 'https://www.pilatesmethodalliance.org/' },
  { publisher: 'NIH / NCCIH', key: 'RELAXATION', url: 'https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know' },
] as const;

export function dailyFeaturedExercise(exercises: readonly Exercise[], date = new Date()): Exercise | null {
  const ordered = [...exercises].sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return ordered[((day % ordered.length) + ordered.length) % ordered.length] ?? null;
}