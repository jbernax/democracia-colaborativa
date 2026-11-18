/**
 * Almacén estático en navegador (localStorage + catalog.json) para despliegues sin backend
 * como GitHub Pages. Replica los endpoints REST de src/server.js.
 */

const STORAGE_KEY = 'democracia_colaborativa_pages_state_v1';

export function isStaticHost() {
  const { protocol, hostname } = window.location;
  return protocol === 'file:' || hostname.endsWith('.github.io');
}

function sanitizeText(val) {
  return String(val ?? '')
    .replace(/[<>]/g, '')
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchInitialCatalog() {
  const response = await fetch('catalog.json');
  if (!response.ok) {
    throw new Error('No se pudo cargar el catálogo estático inicial.');
  }
  return response.json();
}

async function loadState() {
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignorar errores de almacenamiento privado y recargar desde catalog.json
  }

  const initial = await fetchInitialCatalog();
  saveState(initial);
  return initial;
}

function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Continuar en memoria si localStorage no está disponible
  }
}

function filterProjects(projects, filter) {
  let list = projects.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    category: p.category,
    stage: p.stage,
    summary: p.summary,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    popularity: p.popularity,
    proposalsCount: (p.proposals || []).length,
    opinionsCount: (p.opinions || []).length
  }));

  if (filter === 'recent') {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (filter === 'popular') {
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (filter === 'pending') {
    list = list.filter((p) => p.stage.toLowerCase().includes('pendiente') || p.proposalsCount < 3);
  } else if (filter === 'debate') {
    list = list.filter((p) => p.stage.toLowerCase().includes('debate'));
  }

  return list;
}

function createProjectRecord(payload) {
  const title = sanitizeText(payload.title);
  if (!title) throw new Error('El título del plan es obligatorio');
  const summary = sanitizeText(payload.summary);
  if (!summary) throw new Error('El resumen del plan es obligatorio');

  const today = new Date().toISOString().slice(0, 10);
  const randomSuffix = Math.floor(Math.random() * 900 + 100);
  const id = slugify(title) || `plan-${Date.now()}`;

  const monograph =
    payload.initialContent && String(payload.initialContent).trim()
      ? [
          {
            id: 'diagnostico',
            title: '1. Diagnóstico y Motivación',
            content: sanitizeText(payload.initialContent)
          },
          {
            id: 'medidas',
            title: '2. Medidas y Articulado Propuesto',
            content:
              sanitizeText(payload.measuresContent) ||
              'Texto articulado y medidas específicas pendientes de desarrollo colaborativo.'
          },
          {
            id: 'impacto',
            title: '3. Evaluación de Impacto Previsto',
            content:
              sanitizeText(payload.impactContent) ||
              'Impacto presupuestario, social y organizativo a evaluar por los participantes.'
          },
          {
            id: 'debate',
            title: '4. Aspectos a Debate',
            content: 'Puntos críticos y posibles debilidades abiertas a aportaciones ciudadanas.'
          }
        ]
      : [
          { id: 'diagnostico', title: '1. Diagnóstico y Justificación', content: summary },
          { id: 'medidas', title: '2. Medidas Propuestas', content: 'Propuestas de acción normativa abiertas a enmiendas.' }
        ];

  return {
    id,
    code: sanitizeText(payload.code) || `EXP-2026-CIUD-${randomSuffix}`,
    title,
    category: sanitizeText(payload.category) || 'Política Pública',
    stage: 'Debate abierto',
    summary,
    author: sanitizeText(payload.author) || 'Iniciativa Ciudadana',
    createdAt: today,
    updatedAt: today,
    popularity: 15,
    monograph,
    proposals: [],
    opinions: []
  };
}

export async function requestStaticApi(url, options = {}, computeDiff) {
  const method = (options.method || 'GET').toUpperCase();
  const parsed = new URL(url, window.location.origin);
  const pathname = parsed.pathname;
  const body = options.body ? JSON.parse(options.body) : {};

  if (method === 'POST' && pathname === '/api/reset') {
    const initial = await fetchInitialCatalog();
    saveState(initial);
    return { message: 'Catálogo restaurado al estado inicial.', state: initial };
  }

  const state = await loadState();

  if (method === 'GET' && pathname === '/api/projects') {
    const filter = parsed.searchParams.get('filter') || 'all';
    const seeds = state.seeds || [];
    return { projects: filterProjects(state.projects || [], filter), ideas: seeds, seeds };
  }

  if (method === 'POST' && pathname === '/api/projects') {
    const project = createProjectRecord(body);
    state.projects = [project, ...(state.projects || [])];
    saveState(state);
    return { project };
  }

  if (method === 'POST' && (pathname === '/api/seeds' || pathname === '/api/ideas')) {
    const title = sanitizeText(body.title);
    const description = sanitizeText(body.description);
    if (!title) throw new Error('El título de la idea es obligatorio');
    if (!description) throw new Error('La descripción de la idea es obligatoria');

    const seed = {
      id: `idea-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      category: sanitizeText(body.category || 'Iniciativa Ciudadana'),
      author: sanitizeText(body.author) || 'Ciudadano Proponente',
      description,
      votes: 1,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    state.seeds = [seed, ...(state.seeds || [])];
    saveState(state);
    return { seed, idea: seed, seeds: state.seeds, ideas: state.seeds };
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && projectMatch) {
    const project = (state.projects || []).find((p) => p.id === projectMatch[1]);
    if (!project) throw new Error('Plan no encontrado');
    return { project };
  }

  const proposalMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals$/);
  if (method === 'POST' && proposalMatch) {
    const project = (state.projects || []).find((p) => p.id === proposalMatch[1]);
    if (!project) throw new Error(`No se encontró el plan con id ${proposalMatch[1]}`);

    const title = sanitizeText(body.title);
    const proposedText = String(body.proposedText || '').trim();
    if (!title) throw new Error('El título de la propuesta es obligatorio');
    if (!proposedText) throw new Error('El texto propuesto no puede estar vacío');

    const originalText = String(body.originalText || '').trim();
    const proposal = {
      id: `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sectionId: sanitizeText(body.sectionId || project.monograph[0]?.id || 'seccion'),
      title,
      author: sanitizeText(body.author) || 'Ciudadano Colaborador',
      originalText,
      proposedText,
      diff: computeDiff(originalText, proposedText),
      reason: sanitizeText(body.reason || ''),
      status: 'Abierta para debate',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    project.proposals = [proposal, ...(project.proposals || [])];
    project.popularity = (project.popularity || 0) + 5;
    project.updatedAt = proposal.createdAt;
    saveState(state);
    return { proposal, project };
  }

  const opinionMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/opinions$/);
  if (method === 'POST' && opinionMatch) {
    const project = (state.projects || []).find((p) => p.id === opinionMatch[1]);
    if (!project) throw new Error(`No se encontró el plan con id ${opinionMatch[1]}`);

    const text = sanitizeText(body.text);
    if (!text) throw new Error('El texto de la opinión o comentario es obligatorio');

    const opinion = {
      id: `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      author: sanitizeText(body.author) || 'Ciudadano Participante',
      type: sanitizeText(body.type || 'Aportación ciudadana'),
      text,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    project.opinions = [opinion, ...(project.opinions || [])];
    project.popularity = (project.popularity || 0) + 2;
    project.updatedAt = opinion.createdAt;
    saveState(state);
    return { opinion, project };
  }

  throw new Error('Ruta de API no soportada en modo estático');
}
