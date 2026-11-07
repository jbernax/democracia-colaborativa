/**
 * Almacenamiento persistente en disco para el Catalogo de Planes y Proyectos.
 * Guarda y carga el estado completo en data/projects_state.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialProjectsCatalog } from '../data/projectsData.js';
import { computeClauseDiff } from '../engine/collaborationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_PATH = path.resolve(__dirname, '../../data/projects_state.json');

export class RepositoryStore {
  constructor(filePath = DEFAULT_DATA_PATH) {
    this.filePath = filePath;
    this.state = null;
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.state = JSON.parse(raw);
        return this.state;
      } catch (err) {
        console.error('Aviso: regenerando estado inicial por error de lectura:', err.message);
      }
    }

    return this.reset();
  }

  getState() {
    if (!this.state) {
      this.init();
    }
    return this.state;
  }

  save() {
    if (!this.state) {
      throw new Error('No hay estado inicializado para guardar');
    }
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
    return this.state;
  }

  reset() {
    this.state = createInitialProjectsCatalog();
    this.save();
    return this.state;
  }

  getProjects(filter = 'all') {
    const state = this.getState();
    let list = state.projects.map((p) => ({
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

  getProject(id) {
    const state = this.getState();
    const project = state.projects.find((p) => p.id === id);
    if (!project) {
      return null;
    }
    return project;
  }

  addProject(payload) {
    const state = this.getState();
    const title = sanitizeText(payload.title);
    if (!title) {
      throw new Error('El titulo del plan es obligatorio');
    }

    const summary = sanitizeText(payload.summary);
    if (!summary) {
      throw new Error('El resumen del plan es obligatorio');
    }

    const category = sanitizeText(payload.category) || 'Politica Publica';
    const author = sanitizeText(payload.author) || 'Iniciativa Ciudadana';
    const today = new Date().toISOString().slice(0, 10);
    const randomSuffix = Math.floor(Math.random() * 900 + 100);

    const baseSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const id = baseSlug || `plan-${Date.now()}`;
    const code = sanitizeText(payload.code) || `EXP-2026-CIUD-${randomSuffix}`;

    // Construir secciones monograficas
    let monograph = [];
    if (Array.isArray(payload.monograph) && payload.monograph.length > 0) {
      monograph = payload.monograph.map((s, idx) => ({
        id: sanitizeText(s.id) || `sec-${idx + 1}`,
        title: sanitizeText(s.title) || `Seccion ${idx + 1}`,
        content: String(s.content || '').trim()
      }));
    } else if (payload.initialContent && String(payload.initialContent).trim()) {
      monograph = [
        {
          id: 'diagnostico',
          title: '1. Diagnostico y Motivacion',
          content: sanitizeText(payload.initialContent)
        },
        {
          id: 'medidas',
          title: '2. Medidas y Articulado Propuesto',
          content:
            sanitizeText(payload.measuresContent) ||
            'Texto articulado y medidas especificas pendientes de desarrollo colaborativo.'
        },
        {
          id: 'impacto',
          title: '3. Evaluacion de Impacto Previsto',
          content:
            sanitizeText(payload.impactContent) ||
            'Impacto presupuestario, social y organizativo a evaluar por los participantes.'
        },
        {
          id: 'debate',
          title: '4. Aspectos a Debate',
          content: 'Puntos criticos y posibles debilidades abiertas a aportaciones ciudadanas.'
        }
      ];
    } else {
      monograph = [
        {
          id: 'diagnostico',
          title: '1. Diagnostico y Justificacion',
          content: summary
        },
        {
          id: 'medidas',
          title: '2. Medidas Propuestas',
          content: 'Propuestas de accion normativa abiertas a enmiendas.'
        }
      ];
    }

    const newProject = {
      id,
      code,
      title,
      category,
      stage: 'Debate abierto',
      summary,
      author,
      createdAt: today,
      updatedAt: today,
      popularity: 15,
      monograph,
      proposals: [],
      opinions: []
    };

    if (!Array.isArray(state.projects)) {
      state.projects = [];
    }
    state.projects.unshift(newProject);
    this.save();
    return newProject;
  }

  addProposal(projectId, payload) {
    const state = this.getState();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error(`No se encontro el plan con id ${projectId}`);
    }

    const title = sanitizeText(payload.title);
    if (!title) {
      throw new Error('El titulo de la propuesta es obligatorio');
    }

    const author = sanitizeText(payload.author) || 'Ciudadano Colaborador';
    const reason = sanitizeText(payload.reason || '');
    const sectionId = sanitizeText(payload.sectionId || project.monograph[0]?.id || 'seccion');
    const originalText = String(payload.originalText || '').trim();
    const proposedText = String(payload.proposedText || '').trim();

    if (!proposedText) {
      throw new Error('El texto propuesto no puede estar vacio');
    }

    const diff = computeClauseDiff(originalText, proposedText);

    const newProposal = {
      id: `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sectionId,
      title,
      author,
      originalText,
      proposedText,
      diff,
      reason,
      status: 'Abierta para debate',
      createdAt: new Date().toISOString().slice(0, 10)
    };

    if (!Array.isArray(project.proposals)) {
      project.proposals = [];
    }
    project.proposals.unshift(newProposal);
    project.popularity = (project.popularity || 0) + 5;
    project.updatedAt = newProposal.createdAt;

    this.save();
    return newProposal;
  }

  addOpinion(projectId, payload) {
    const state = this.getState();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error(`No se encontro el plan con id ${projectId}`);
    }

    const text = sanitizeText(payload.text);
    if (!text) {
      throw new Error('El texto de la opinion o comentario es obligatorio');
    }

    const author = sanitizeText(payload.author) || 'Ciudadano Participante';
    const type = sanitizeText(payload.type || 'Aportacion ciudadana');

    const newOpinion = {
      id: `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      author,
      type,
      text,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    if (!Array.isArray(project.opinions)) {
      project.opinions = [];
    }
    project.opinions.unshift(newOpinion);
    project.popularity = (project.popularity || 0) + 2;
    project.updatedAt = newOpinion.createdAt;

    this.save();
    return newOpinion;
  }

  addSeed(payload) {
    const state = this.getState();
    const title = sanitizeText(payload.title);
    if (!title) {
      throw new Error('El titulo de la idea es obligatorio');
    }

    const description = sanitizeText(payload.description);
    if (!description) {
      throw new Error('La descripcion de la idea es obligatoria');
    }

    const author = sanitizeText(payload.author) || 'Ciudadano Proponente';
    const category = sanitizeText(payload.category || 'Iniciativa Ciudadana');

    const newSeed = {
      id: `idea-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      category,
      author,
      description,
      votes: 1,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    if (!Array.isArray(state.seeds)) {
      state.seeds = [];
    }
    state.seeds.unshift(newSeed);
    this.save();
    return newSeed;
  }

  addIdea(payload) {
    return this.addSeed(payload);
  }

  getSeeds() {
    const state = this.getState();
    return state.seeds || [];
  }

  getIdeas() {
    return this.getSeeds();
  }
}

function sanitizeText(val) {
  return String(val ?? '')
    .replace(/[<>]/g, '')
    .trim();
}
