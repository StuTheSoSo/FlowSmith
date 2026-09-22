# Exercise Catalog Coverage

Audit date: 2026-09-22.

## Findings

All nine language catalogs contain the same 93 exercise IDs. The planner previously truncated searches at 18 results before applying equipment/level filters; the Library truncated at 60. Both now search the entire catalog. "All" means all catalog entries, subject to any active search or other filter.

The catalog contains entries for all 34 classical mat exercises in the references below. Naming equivalents include One Leg Circle / Single Leg Circles, One Leg Kick / Single Leg Kick, Side Kick Kneeling / Kneeling Side Kicks, and Hip Twist / Hip Circles. Swan, Swan Prep, and Swan Dive have separate entries. This is an exercise-name coverage check, not certification of technique descriptions or clinical suitability.

The broader apparatus catalog is curated, not an exhaustive list of every school, apparatus, progression, or variation. Some entries represent entire series. Do not describe 93 as the total number of Pilates exercises. No third-party instructions or images were copied during this audit, and no duplicate exercises were added just to increase the count.

## References

- [Pilates Anytime: The 34 Pilates Mat Exercises](https://www.pilatesanytime.com/blog/mat/the-34-pilates-mat-exercises-): full original mat sequence, with naming equivalents.
- [Online Pilates Classes: Joseph Pilates' 34 Original Mat Exercises](https://onlinepilatesclasses.com/blog/the-original-34-classical-pilates-mat-exercises/): independent cross-check of the mat sequence.
- [Pilatesology: Exercise Lists and Sequences](https://pilatesology.com/exercise-lists-sequences/): separate mat, Reformer, Cadillac, Wunda Chair, barrel, and other apparatus lists for future coverage work.

## Language Behavior

English data lives directly under `src/assets/data`; the other eight catalogs live in language subdirectories. Exercise IDs stay fixed across languages so plans retain their exercise references. Language changes reset localized search/filter values, refresh open Library details by ID, cancel obsolete planner requests, and republish cached bundles to subscribers including the watch protocol. Existing translated content is reused; this audit does not certify translation quality. Missing-language requests retain the existing English fallback.

Run `npm run test:catalog` to validate matching IDs, unique entries, populated display fields, and the 34 classical mat entries across all nine catalogs. Add every new exercise to all nine locales with the same ID and appropriately reviewed instructional/safety content.