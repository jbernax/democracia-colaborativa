/**
 * Cargador modular del Catálogo de Planes e Ideas Ciudadanas desde data/catalog/.
 * Enriquece cada plan con diffs LCS, simulación MAIN (si aplica) e índice ICMN.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichProject } from '../../public/shared/catalogDomain.js';
import { DEFAULT_REPO_URL } from '../../public/shared/githubBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_CATALOG_DIR = path.resolve(__dirname, '../../data/catalog');

const FEATURED_ORDER = [
  'reincorporacion-laboral-maternidad',
  'acceso-vivienda-alquiler-asequible',
  'transicion-energetica-autoconsumo-comunitario',
  'simplificacion-pymes-autonomos',
  'teletrabajo-municipios-rurales'
];

function resolveRepoUrl() {
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY}`;
  }
  return DEFAULT_REPO_URL;
}

export function createInitialProjectsCatalog(catalogDir = DEFAULT_CATALOG_DIR) {
  const plansDir = path.join(catalogDir, 'plans');
  const ideasFile = path.join(catalogDir, 'ideas.json');

  const planFiles = fs.existsSync(plansDir)
    ? fs
        .readdirSync(plansDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : [];

  const rawProjects = planFiles.map((file) => {
    const raw = fs.readFileSync(path.join(plansDir, file), 'utf-8');
    return enrichProject(JSON.parse(raw));
  });

  rawProjects.sort((a, b) => {
    const idxA = FEATURED_ORDER.indexOf(a.id);
    const idxB = FEATURED_ORDER.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  const seeds = fs.existsSync(ideasFile)
    ? JSON.parse(fs.readFileSync(ideasFile, 'utf-8'))
    : [];

  return {
    projects: rawProjects,
    seeds,
    meta: {
      schemaVersion: 2,
      repositoryUrl: resolveRepoUrl()
    }
  };
}
