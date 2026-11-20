/**
 * Genera el paquete estático listo para desplegar en GitHub Pages en dist-pages/.
 * Valida previamente la integridad del catálogo modular e incorpora un hash de versión
 * (?v=<hash>) en los recursos estáticos y módulos ESM para evitar mezclas de caché.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialProjectsCatalog } from '../src/data/projectsData.js';
import { validateCatalog } from './validate-catalog.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');

function collectFilesRecursively(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function computeBundleHash(outDir) {
  const hash = crypto.createHash('sha256');
  for (const filePath of collectFilesRecursively(outDir)) {
    const rel = path.relative(outDir, filePath).replaceAll(path.sep, '/');
    if (rel === '.nojekyll' || rel === 'index.html') continue;
    hash.update(rel);
    hash.update('\0');
    hash.update(fs.readFileSync(filePath));
  }
  return hash.digest('hex').slice(0, 8);
}

function stampBundleUrls(outDir, buildHash) {
  const indexPath = path.join(outDir, 'index.html');
  const indexHtml = fs
    .readFileSync(indexPath, 'utf-8')
    .replace('href="styles.css"', `href="styles.css?v=${buildHash}"`)
    .replace('src="app.js"', `src="app.js?v=${buildHash}"`);
  fs.writeFileSync(indexPath, indexHtml, 'utf-8');

  const staticStorePath = path.join(outDir, 'staticStore.js');
  if (fs.existsSync(staticStorePath)) {
    const staticStoreJs = fs
      .readFileSync(staticStorePath, 'utf-8')
      .replace("fetch('catalog.json')", `fetch('catalog.json?v=${buildHash}')`);
    fs.writeFileSync(staticStorePath, staticStoreJs, 'utf-8');
  }

  for (const filePath of collectFilesRecursively(outDir)) {
    if (!filePath.endsWith('.js')) continue;
    const js = fs
      .readFileSync(filePath, 'utf-8')
      .replace(/(\b(?:from|import)\s+['"])(\.\.?\/[^'"]+\.js)(['"])/g, `$1$2?v=${buildHash}$3`);
    fs.writeFileSync(filePath, js, 'utf-8');
  }
}

export function buildPagesBundle(options = {}) {
  const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
  const publicDir = options.publicDir || path.join(rootDir, 'public');
  const outDir = options.outDir || path.join(rootDir, 'dist-pages');

  const catalog = createInitialProjectsCatalog(options.catalogDir);
  const validation = validateCatalog(catalog);

  if (!validation.valid) {
    throw new Error(
      `El catálogo contiene inconsistencias:\n- ${validation.errors.join('\n- ')}`
    );
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(publicDir, outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf-8');

  const buildHash = computeBundleHash(outDir);
  stampBundleUrls(outDir, buildHash);

  return {
    outDir,
    buildHash,
    stats: validation.stats
  };
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  try {
    const res = buildPagesBundle();
    console.log(
      `GitHub Pages bundle generated at ${res.outDir} (${res.stats.projectsCount} plans, ${res.stats.seedsCount} ideas, v=${res.buildHash})`
    );
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
