/**
 * Genera el paquete estático listo para desplegar en GitHub Pages en dist-pages/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialProjectsCatalog } from '../src/data/projectsData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUT_DIR = path.join(ROOT_DIR, 'dist-pages');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.cpSync(PUBLIC_DIR, OUT_DIR, { recursive: true });

const catalog = createInitialProjectsCatalog();
fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '', 'utf-8');

console.log(`GitHub Pages bundle generated at ${OUT_DIR}`);
