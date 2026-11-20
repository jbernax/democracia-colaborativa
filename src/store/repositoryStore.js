/**
 * Almacenamiento persistente en disco para desarrollo local (Democracia Colaborativa).
 * Delega las reglas de dominio en public/shared/catalogDomain.js y realiza escritura atómica
 * en .local-state.json (ignorado por Git) para no ensuciar los archivos versionados en data/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialProjectsCatalog } from '../data/projectsData.js';
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
} from '../../public/shared/catalogDomain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_PATH = path.resolve(__dirname, '../../.local-state.json');

export class RepositoryStore {
  constructor(filePath = DEFAULT_DATA_PATH, catalogDir = undefined) {
    this.filePath = filePath;
    this.catalogDir = catalogDir;
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
        const parsed = JSON.parse(raw);
        if (parsed?.meta?.schemaVersion === 2 && Array.isArray(parsed.projects)) {
          this.state = {
            ...parsed,
            projects: parsed.projects.map((p) => enrichProject(p))
          };
          return this.state;
        }
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
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
    return this.state;
  }

  reset() {
    this.state = createInitialProjectsCatalog(this.catalogDir);
    this.save();
    return this.state;
  }

  getMeta() {
    return this.getState().meta || {};
  }

  getCategories() {
    return getCategories(this.getState().projects || []);
  }

  getProjects(options = 'all') {
    const state = this.getState();
    return listProjects(state.projects || [], options);
  }

  getProject(id) {
    const state = this.getState();
    const project = (state.projects || []).find((p) => p.id === id);
    return project ? enrichProject(project) : null;
  }

  _findRawProject(projectId) {
    const state = this.getState();
    const project = (state.projects || []).find((p) => p.id === projectId);
    if (!project) {
      throw new Error(`No se encontró el plan con id ${projectId}`);
    }
    return project;
  }

  addProject(payload) {
    const state = this.getState();
    const newProject = createProjectRecord(payload, state.projects || []);
    if (!Array.isArray(state.projects)) {
      state.projects = [];
    }
    state.projects.unshift(newProject);

    if (newProject.sourceSeedId && Array.isArray(state.seeds)) {
      const sourceSeed = state.seeds.find((s) => s.id === newProject.sourceSeedId);
      if (sourceSeed) {
        sourceSeed.promotedProjectId = newProject.id;
      }
    }

    this.save();
    return newProject;
  }

  addProposal(projectId, payload) {
    const project = this._findRawProject(projectId);
    const proposal = createProposalRecord(project, payload);
    this.save();
    return proposal;
  }

  elaborateProposal(projectId, proposalId, payload) {
    const project = this._findRawProject(projectId);
    const proposal = elaborateProposalRecord(project, proposalId, payload);
    this.save();
    return proposal;
  }

  consolidateProposal(projectId, proposalId, reviewerNote = '') {
    const project = this._findRawProject(projectId);
    const result = consolidateProposalRecord(project, proposalId, reviewerNote);
    this.save();
    return result;
  }

  addWeakness(projectId, payload) {
    const project = this._findRawProject(projectId);
    const weakness = createWeaknessRecord(project, payload);
    this.save();
    return weakness;
  }

  addOpinion(projectId, payload) {
    const project = this._findRawProject(projectId);
    const opinion = createOpinionRecord(project, payload);
    this.save();
    return opinion;
  }

  addSeed(payload) {
    const state = this.getState();
    const newSeed = createSeedRecord(payload);
    if (!Array.isArray(state.seeds)) {
      state.seeds = [];
    }
    state.seeds.unshift(newSeed);
    this.save();
    return newSeed;
  }

  endorseSeed(seedId) {
    const state = this.getState();
    const seed = endorseSeedRecord(state.seeds || [], seedId);
    this.save();
    return seed;
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
