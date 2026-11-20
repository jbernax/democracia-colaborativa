/**
 * Procesador de Issues aprobados de GitHub (`agora-payload`) hacia data/catalog/.
 * Valida estrictamente la carga útil y verifica el catálogo completo antes de escribir en disco.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProjectRecord,
  createProposalRecord,
  elaborateProposalRecord,
  createWeaknessRecord,
  createSeedRecord,
  enrichProject
} from '../public/shared/catalogDomain.js';
import { createInitialProjectsCatalog, DEFAULT_CATALOG_DIR } from '../src/data/projectsData.js';
import { validateCatalog } from './validate-catalog.mjs';

const PAYLOAD_BLOCK_REGEX = /```json\s+agora-payload\r?\n([\s\S]*?)\r?\n```/;
const SLUG_REGEX = /^[a-z0-9-]+$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertNoPrototypePollution(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrototypePollution(item);
    return;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Clave no permitida en la carga útil: ${key}`);
    }
    assertNoPrototypePollution(value[key]);
  }
}

export function extractAgoraPayload(rawBody = '') {
  const match = String(rawBody || '').match(PAYLOAD_BLOCK_REGEX);
  if (!match) {
    throw new Error('No se encontró el bloque estructurado `agora-payload` en el cuerpo del Issue.');
  }

  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (_err) {
    throw new Error('El bloque `agora-payload` no contiene JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('La carga útil `agora-payload` debe ser un objeto JSON.');
  }
  assertNoPrototypePollution(parsed);
  return parsed;
}

function resolvePlanFilePath(plansDir, projectId) {
  if (!projectId || !SLUG_REGEX.test(projectId)) {
    throw new Error(`Identificador de plan inválido: "${projectId}"`);
  }
  const resolvedPlansDir = path.resolve(plansDir);
  const targetPath = path.resolve(resolvedPlansDir, `${projectId}.json`);
  if (!targetPath.startsWith(resolvedPlansDir + path.sep)) {
    throw new Error('Ruta de plan fuera del directorio permitido.');
  }
  return targetPath;
}

function stripDerivedPlanFields(plan) {
  const clean = structuredClone(plan);
  delete clean.icmn;
  if (Array.isArray(clean.proposals)) {
    for (const prop of clean.proposals) {
      delete prop.diff;
    }
  }
  if (clean.pilotModel && Array.isArray(clean.pilotModel.branches)) {
    for (const branch of clean.pilotModel.branches) {
      delete branch.impact;
      delete branch.readiness;
    }
  }
  return clean;
}

/**
 * Aplica una aportación estructurada sobre un directorio de catálogo modular.
 */
export function ingestIssuePayload(rawBody, options = {}) {
  const catalogDir = path.resolve(options.catalogDir || DEFAULT_CATALOG_DIR);
  const plansDir = path.join(catalogDir, 'plans');
  const ideasFile = path.join(catalogDir, 'ideas.json');
  const dryRun = Boolean(options.dryRun);
  const issueNumber = options.issueNumber ? Number(options.issueNumber) : undefined;
  const issueUrl = options.issueUrl ? String(options.issueUrl) : undefined;
  const issueAuthor = options.issueAuthor ? String(options.issueAuthor) : '';

  const payload = extractAgoraPayload(rawBody);
  const kind = String(payload.kind || '').trim();
  const catalog = createInitialProjectsCatalog(catalogDir);

  let updatedFilePaths = [];
  let summary = '';

  if (kind === 'enmienda') {
    const planPath = resolvePlanFilePath(plansDir, payload.projectId);
    if (!fs.existsSync(planPath)) {
      throw new Error(`No existe el archivo del plan "${payload.projectId}".`);
    }
    const rawPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
    const proposal = createProposalRecord(rawPlan, {
      ...payload,
      author: payload.author || issueAuthor || 'Colaborador GitHub',
      githubIssueNumber: issueNumber,
      githubIssueUrl: issueUrl
    });

    const idx = catalog.projects.findIndex((p) => p.id === rawPlan.id);
    if (idx !== -1) catalog.projects[idx] = enrichProject(rawPlan);

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      throw new Error(`Validación fallida tras ingesta: ${validation.errors.join(' | ')}`);
    }

    if (!dryRun) {
      fs.writeFileSync(planPath, JSON.stringify(stripDerivedPlanFields(rawPlan), null, 2) + '\n', 'utf-8');
    }
    updatedFilePaths = [planPath];
    summary = `Enmienda ${proposal.id} incorporada al plan ${rawPlan.id}`;
  } else if (kind === 'debilidad') {
    const planPath = resolvePlanFilePath(plansDir, payload.projectId);
    if (!fs.existsSync(planPath)) {
      throw new Error(`No existe el archivo del plan "${payload.projectId}".`);
    }
    const rawPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
    const weakness = createWeaknessRecord(rawPlan, {
      ...payload,
      reportedBy: payload.reportedBy || issueAuthor || 'Auditor GitHub',
      githubIssueNumber: issueNumber,
      githubIssueUrl: issueUrl
    });

    const idx = catalog.projects.findIndex((p) => p.id === rawPlan.id);
    if (idx !== -1) catalog.projects[idx] = enrichProject(rawPlan);

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      throw new Error(`Validación fallida tras ingesta: ${validation.errors.join(' | ')}`);
    }

    if (!dryRun) {
      fs.writeFileSync(planPath, JSON.stringify(stripDerivedPlanFields(rawPlan), null, 2) + '\n', 'utf-8');
    }
    updatedFilePaths = [planPath];
    summary = `Debilidad ${weakness.id} registrada en el plan ${rawPlan.id}`;
  } else if (kind === 'coautoria') {
    const planPath = resolvePlanFilePath(plansDir, payload.projectId);
    if (!fs.existsSync(planPath)) {
      throw new Error(`No existe el archivo del plan "${payload.projectId}".`);
    }
    const rawPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
    const proposal = elaborateProposalRecord(rawPlan, payload.proposalId, {
      ...payload,
      contributorName: payload.contributorName || issueAuthor || 'Especialista GitHub'
    });

    const idx = catalog.projects.findIndex((p) => p.id === rawPlan.id);
    if (idx !== -1) catalog.projects[idx] = enrichProject(rawPlan);

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      throw new Error(`Validación fallida tras ingesta: ${validation.errors.join(' | ')}`);
    }

    if (!dryRun) {
      fs.writeFileSync(planPath, JSON.stringify(stripDerivedPlanFields(rawPlan), null, 2) + '\n', 'utf-8');
    }
    updatedFilePaths = [planPath];
    summary = `Co-autoría incorporada a ${proposal.id} en ${rawPlan.id}`;
  } else if (kind === 'idea') {
    const rawIdeas = fs.existsSync(ideasFile)
      ? JSON.parse(fs.readFileSync(ideasFile, 'utf-8'))
      : [];
    const seed = createSeedRecord({
      ...payload,
      author: payload.author || issueAuthor || 'Ciudadano GitHub',
      githubIssueNumber: issueNumber,
      githubIssueUrl: issueUrl
    });
    rawIdeas.unshift(seed);
    catalog.seeds = rawIdeas;

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      throw new Error(`Validación fallida tras ingesta: ${validation.errors.join(' | ')}`);
    }

    if (!dryRun) {
      fs.writeFileSync(ideasFile, JSON.stringify(rawIdeas, null, 2) + '\n', 'utf-8');
    }
    updatedFilePaths = [ideasFile];
    summary = `Idea ${seed.id} incorporada a ideas.json`;
  } else if (kind === 'plan') {
    const newProject = createProjectRecord(
      {
        ...payload,
        author: payload.author || issueAuthor || 'Iniciativa Ciudadana'
      },
      catalog.projects
    );
    const planPath = resolvePlanFilePath(plansDir, newProject.id);
    catalog.projects.unshift(newProject);

    let ideasUpdated = false;
    const rawIdeas = fs.existsSync(ideasFile)
      ? JSON.parse(fs.readFileSync(ideasFile, 'utf-8'))
      : [];
    if (newProject.sourceSeedId) {
      const targetSeed = rawIdeas.find((s) => s.id === newProject.sourceSeedId);
      if (targetSeed) {
        targetSeed.promotedProjectId = newProject.id;
        ideasUpdated = true;
      }
      catalog.seeds = rawIdeas;
    }

    const validation = validateCatalog(catalog);
    if (!validation.valid) {
      throw new Error(`Validación fallida tras ingesta: ${validation.errors.join(' | ')}`);
    }

    if (!dryRun) {
      fs.mkdirSync(plansDir, { recursive: true });
      fs.writeFileSync(
        planPath,
        JSON.stringify(stripDerivedPlanFields(newProject), null, 2) + '\n',
        'utf-8'
      );
      if (ideasUpdated) {
        fs.writeFileSync(ideasFile, JSON.stringify(rawIdeas, null, 2) + '\n', 'utf-8');
      }
    }
    updatedFilePaths = ideasUpdated ? [planPath, ideasFile] : [planPath];
    summary = `Plan ${newProject.id} creado en el catálogo`;
  } else {
    throw new Error(`Tipo de aportación \`kind\` no soportado: "${kind}"`);
  }

  return {
    kind,
    summary,
    updatedFilePaths
  };
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--issue-file' && argv[i + 1]) {
      args.issueFile = argv[++i];
    } else if (token === '--catalog-dir' && argv[i + 1]) {
      args.catalogDir = argv[++i];
    } else if (token === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    let rawBody = process.env.ISSUE_BODY || '';
    let issueNumber = process.env.ISSUE_NUMBER;
    let issueUrl = process.env.ISSUE_URL;
    let issueAuthor = process.env.ISSUE_AUTHOR;

    if (args.issueFile) {
      const issueJson = JSON.parse(fs.readFileSync(args.issueFile, 'utf-8'));
      rawBody = issueJson.body || rawBody;
      issueNumber = issueJson.number ?? issueNumber;
      issueUrl = issueJson.html_url || issueJson.url || issueUrl;
      issueAuthor = issueJson.user?.login || issueAuthor;
    }

    const result = ingestIssuePayload(rawBody, {
      catalogDir: args.catalogDir,
      dryRun: args.dryRun,
      issueNumber,
      issueUrl,
      issueAuthor
    });
    console.log(result.summary);
  } catch (err) {
    console.error(`Error al procesar Issue: ${err.message}`);
    process.exit(1);
  }
}
