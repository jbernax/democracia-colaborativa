/**
 * Genera el paquete estático listo para desplegar en GitHub Pages en dist-pages/.
 * Valida previamente la integridad del catálogo modular antes de empaquetar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialProjectsCatalog } from '../src/data/projectsData.js';
import { validateCatalog } from './validate-catalog.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUT_DIR = path.join(ROOT_DIR, 'dist-pages');

const catalog = createInitialProjectsCatalog();
const validation = validateCatalog(catalog);

if (!validation.valid) {
  console.error('Error: el catálogo contiene inconsistencias y no se generará dist-pages/:');
  for (const err of validation.errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.cpSync(PUBLIC_DIR, OUT_DIR, { recursive: true });

fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '', 'utf-8');

console.log(
  `GitHub Pages bundle generated at ${OUT_DIR} (${validation.stats.projectsCount} plans, ${validation.stats.seedsCount} ideas)`
);
