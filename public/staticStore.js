/**
 * Almacén estático en navegador (localStorage + catalog.json) para despliegues sin backend
 * como GitHub Pages. Comparte exactamente las mismas reglas de dominio que RepositoryStore.
 */

import {
  listProjects,
  getCategories,
  enrichProject,
  createProjectRecord,
  createProposalRecord,
  elaborateProposalRecord,
  consolidateProposalRecord,
  createWeaknessRecord,
  createOpinionRecord,
  createSeedRecord,
  endorseSeedRecord
} from './shared/catalogDomain.js';

const STORAGE_KEY = 'democracia_colaborativa_pages_state_v2';
const DIRTY_KEY = 'democracia_colaborativa_pages_dirty_v2';

export function isStaticHost() {
  const win = globalThis.window;
  if (!win || !win.location) return false;
  const { protocol, hostname } = win.location;
  return protocol === 'file:' || hostname.endsWith('.github.io');
}

export function hasLocalDraftChanges() {
  try {
    return globalThis.window?.localStorage?.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

async function fetchInitialCatalog() {
  const response = await globalThis.fetch('catalog.json');
  if (!response.ok) {
    throw new Error('No se ha podido cargar el catálogo inicial.');
  }
  const parsed = await response.json();
  return {
    ...parsed,
    projects: (parsed.projects || []).map((p) => enrichProject(p))
  };
}

function saveState(state, markAsDirty = true) {
  try {
    const storage = globalThis.window?.localStorage;
    if (!storage) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (markAsDirty) {
      storage.setItem(DIRTY_KEY, '1');
    }
  } catch {
    // Continuar en memoria si localStorage no está disponible
  }
}

async function loadState() {
  try {
    const cached = globalThis.window?.localStorage?.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.meta?.schemaVersion === 2 && Array.isArray(parsed.projects)) {
        return {
          ...parsed,
          projects: parsed.projects.map((p) => enrichProject(p))
        };
      }
    }
  } catch {
    // Ignorar errores de almacenamiento privado y recargar desde catalog.json
  }

  const initial = await fetchInitialCatalog();
  saveState(initial, false);
  return initial;
}

export async function clearLocalDrafts() {
  try {
    const storage = globalThis.window?.localStorage;
    storage?.removeItem(STORAGE_KEY);
    storage?.removeItem(DIRTY_KEY);
  } catch {
    // Ignorar errores de acceso a almacenamiento
  }
  const initial = await fetchInitialCatalog();
  saveState(initial, false);
  return { message: 'Borrador local borrado.', state: initial };
}

export async function requestStaticApi(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const origin = globalThis.window?.location?.origin || 'http://localhost';
  const parsed = new URL(url, origin);
  const pathname = parsed.pathname;
  const body = options.body ? JSON.parse(options.body) : {};

  if (method === 'POST' && pathname === '/api/reset') {
    const result = await clearLocalDrafts();
    return {
      message: result.message,
      projects: listProjects(result.state.projects || [], 'all'),
      seeds: result.state.seeds || [],
      state: result.state
    };
  }

  const state = await loadState();

  if (method === 'GET' && pathname === '/api/projects') {
    const filter = parsed.searchParams.get('filter') || 'all';
    const q = parsed.searchParams.get('q') || '';
    const category = parsed.searchParams.get('category') || '';
    const seeds = state.seeds || [];
    return {
      projects: listProjects(state.projects || [], { filter, q, category }),
      categories: getCategories(state.projects || []),
      ideas: seeds,
      seeds,
      meta: state.meta || {}
    };
  }

  if (method === 'POST' && pathname === '/api/projects') {
    const project = createProjectRecord(body, state.projects || []);
    state.projects = [project, ...(state.projects || [])];

    if (project.sourceSeedId && Array.isArray(state.seeds)) {
      const sourceSeed = state.seeds.find((s) => s.id === project.sourceSeedId);
      if (sourceSeed) {
        sourceSeed.promotedProjectId = project.id;
      }
    }

    saveState(state, true);
    return { project };
  }

  if (method === 'GET' && (pathname === '/api/seeds' || pathname === '/api/ideas')) {
    const seeds = state.seeds || [];
    return { seeds, ideas: seeds };
  }

  if (method === 'POST' && (pathname === '/api/seeds' || pathname === '/api/ideas')) {
    const seed = createSeedRecord(body);
    state.seeds = [seed, ...(state.seeds || [])];
    saveState(state, true);
    return { seed, idea: seed, seeds: state.seeds, ideas: state.seeds };
  }

  const endorseMatch = pathname.match(/^\/api\/(?:seeds|ideas)\/([a-zA-Z0-9_-]+)\/endorse$/);
  if (method === 'POST' && endorseMatch) {
    const seed = endorseSeedRecord(state.seeds || [], endorseMatch[1]);
    saveState(state, true);
    return { seed, idea: seed, seeds: state.seeds, ideas: state.seeds };
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && projectMatch) {
    const project = (state.projects || []).find((p) => p.id === projectMatch[1]);
    if (!project) throw new Error('No hemos encontrado ese plan.');
    return { project: enrichProject(project) };
  }

  const proposalMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals$/);
  if (method === 'POST' && proposalMatch) {
    const project = (state.projects || []).find((p) => p.id === proposalMatch[1]);
    if (!project) throw new Error(`No hemos encontrado el plan ${proposalMatch[1]}.`);

    const proposal = createProposalRecord(project, body);
    saveState(state, true);
    return { proposal, project: enrichProject(project) };
  }

  const coauthorMatch = pathname.match(
    /^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals\/([a-zA-Z0-9_-]+)\/coauthor$/
  );
  if (method === 'POST' && coauthorMatch) {
    const [, projectId, proposalId] = coauthorMatch;
    const project = (state.projects || []).find((p) => p.id === projectId);
    if (!project) throw new Error(`No hemos encontrado el plan ${projectId}.`);

    const proposal = elaborateProposalRecord(project, proposalId, body);
    saveState(state, true);
    return { proposal, project: enrichProject(project) };
  }

  const consolidateMatch = pathname.match(
    /^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals\/([a-zA-Z0-9_-]+)\/consolidate$/
  );
  if (method === 'POST' && consolidateMatch) {
    const [, projectId, proposalId] = consolidateMatch;
    const project = (state.projects || []).find((p) => p.id === projectId);
    if (!project) throw new Error(`No hemos encontrado el plan ${projectId}.`);

    const result = consolidateProposalRecord(project, proposalId, body.reviewerNote || '');
    saveState(state, true);
    return { ...result, project: enrichProject(project) };
  }

  const weaknessMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/weaknesses$/);
  if (method === 'POST' && weaknessMatch) {
    const project = (state.projects || []).find((p) => p.id === weaknessMatch[1]);
    if (!project) throw new Error(`No hemos encontrado el plan ${weaknessMatch[1]}.`);

    const weakness = createWeaknessRecord(project, body);
    saveState(state, true);
    return { weakness, project: enrichProject(project) };
  }

  const opinionMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/opinions$/);
  if (method === 'POST' && opinionMatch) {
    const project = (state.projects || []).find((p) => p.id === opinionMatch[1]);
    if (!project) throw new Error(`No hemos encontrado el plan ${opinionMatch[1]}.`);

    const opinion = createOpinionRecord(project, body);
    saveState(state, true);
    return { opinion, project: enrichProject(project) };
  }

  throw new Error('Esta acción no está disponible en modo estático.');
}
