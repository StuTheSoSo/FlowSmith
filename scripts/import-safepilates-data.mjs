import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const flowSmithRoot = resolve(currentDir, '..');
const safePilatesRoot = resolve(flowSmithRoot, '../PilateSafe/SafePilates');
const sourceData = resolve(safePilatesRoot, 'src/assets/data');
const sourceI18n = resolve(safePilatesRoot, 'src/assets/i18n');
const targetData = resolve(flowSmithRoot, 'src/assets/data');
const targetI18n = resolve(flowSmithRoot, 'src/assets/i18n');

await mkdir(resolve(flowSmithRoot, 'src/assets'), { recursive: true });
await rm(targetData, { recursive: true, force: true });
await rm(targetI18n, { recursive: true, force: true });
await cp(sourceData, targetData, { recursive: true });
await cp(sourceI18n, targetI18n, { recursive: true });

console.log('SafePilates data imported into FlowSmith assets.');
