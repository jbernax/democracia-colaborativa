/**
 * Lógica de dominio compartida para el Catálogo de Planes, Propuestas, Co-autoría,
 * Auditorías de Debilidad e Ideas Ciudadanas.
 * Isomórfico: ejecutado tanto en Node.js (RepositoryStore / ingest-issue) como en el navegador (staticStore).
 */

import { computeClauseDiff } from './textDiff.js';
import { simulatePlanImpact } from './impactSimulator.js';
import {
  POLICY_DOMAINS,
  MATURITY_LEVELS,
  calculatePlanIcmn,
  calculateReadinessScore,
  inferNeededDomainsFromText
} from './collaborationEngine.js';

export function sanitizeText(val) {
  return String(val ?? '')
    .replace(/[<>]/g, '')
    .trim();
}

export function sanitizeMultilineText(val) {
  return String(val ?? '')
    .replace(/[<>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export function normalizeForSearch(text = '') {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function slugify(text = '') {
  return normalizeForSearch(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ensureUniqueSlug(baseSlug, existingIds = []) {
  const cleanBase = slugify(baseSlug) || `plan-${Date.now()}`;
  const idSet = new Set(existingIds);
  if (!idSet.has(cleanBase)) {
    return cleanBase;
  }
  let suffix = 2;
  while (idSet.has(`${cleanBase}-${suffix}`)) {
    suffix++;
  }
  return `${cleanBase}-${suffix}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDefaultProposalMetadata(project, proposal) {
  const originalText = sanitizeMultilineText(proposal.originalText || '');
  const proposedText = sanitizeMultilineText(proposal.proposedText || '');
  const diff = computeClauseDiff(originalText, proposedText);

  const requiredDomains = Array.isArray(proposal.requiredDomains) && proposal.requiredDomains.length > 0
    ? proposal.requiredDomains.filter((d) => Boolean(POLICY_DOMAINS[d]))
    : inferNeededDomainsFromText(`${proposal.title || ''} ${proposal.reason || ''} ${proposedText}`);

  const domainAnalyses = {};
  if (proposal.domainAnalyses && typeof proposal.domainAnalyses === 'object') {
    for (const [k, v] of Object.entries(proposal.domainAnalyses)) {
      if (POLICY_DOMAINS[k] && sanitizeText(v)) {
        domainAnalyses[k] = sanitizeMultilineText(v);
      }
    }
  }

  for (const coveredKey of Object.keys(domainAnalyses)) {
    if (!requiredDomains.includes(coveredKey)) {
      requiredDomains.push(coveredKey);
    }
  }

  const coveredDomains = Object.keys(domainAnalyses);
  const pendingDomains = requiredDomains.filter((d) => !coveredDomains.includes(d));

  const isConsolidated =
    proposal.status === 'Consolidada' || proposal.maturityLevel?.level === 4;

  let maturityLevel = proposal.maturityLevel;
  let status = proposal.status;
  if (isConsolidated) {
    maturityLevel = MATURITY_LEVELS.LEVEL_4_MERGED;
    status = 'Consolidada';
  } else if (pendingDomains.length === 0) {
    maturityLevel = MATURITY_LEVELS.LEVEL_3_INTEGRATED_PR;
    status = 'Lista para consolidación';
  } else {
    maturityLevel = MATURITY_LEVELS.LEVEL_2_SCOPED_PR;
    status = proposal.status && proposal.status !== 'Abierta para debate'
      ? proposal.status
      : 'Solicita co-autoría';
  }

  const coAuthors = Array.isArray(proposal.coAuthors) && proposal.coAuthors.length > 0
    ? proposal.coAuthors
    : [
        {
          name: proposal.author || 'Ciudadano Colaborador',
          role: 'Proponente inicial',
          contributedDomains: coveredDomains.length > 0 ? coveredDomains : ['propuesta_redaccion'],
          date: proposal.createdAt || project.createdAt || todayIso()
        }
      ];

  return {
    ...proposal,
    originalText,
    proposedText,
    diff,
    requiredDomains,
    coveredDomains,
    pendingDomains,
    domainAnalyses,
    maturityLevel,
    status,
    coAuthors,
    mitigatesWeaknessIds: Array.isArray(proposal.mitigatesWeaknessIds)
      ? proposal.mitigatesWeaknessIds.filter(Boolean)
      : [],
    reviewComments: Array.isArray(proposal.reviewComments) ? proposal.reviewComments : []
  };
}

/**
 * Normaliza un plan asegurando sus colecciones, diffs LCS, modelo MAIN e índice ICMN.
 */
export function enrichProject(project) {
  if (!project) return null;

  const mainCoverage = {
    juridico: false,
    economico: false,
    laboral_pyme: false,
    social_igualdad: false,
    ambiental_territorial: false,
    ...(project.mainCoverage || {})
  };

  const weaknesses = Array.isArray(project.weaknesses) ? project.weaknesses.map((w) => ({ ...w })) : [];
  const opinions = Array.isArray(project.opinions) ? project.opinions.map((o) => ({ ...o })) : [];
  const commitHistory = Array.isArray(project.commitHistory)
    ? project.commitHistory.map((c) => ({ ...c }))
    : [];

  const proposals = Array.isArray(project.proposals)
    ? project.proposals.map((prop) => ensureDefaultProposalMetadata(project, prop))
    : [];

  let pilotModel = project.pilotModel ? structuredClone(project.pilotModel) : undefined;
  if (pilotModel && Array.isArray(pilotModel.branches)) {
    pilotModel.branches = pilotModel.branches.map((branch) => {
      const impact = simulatePlanImpact(branch.parameters);
      const enrichedBranch = { ...branch, impact };
      enrichedBranch.readiness = calculateReadinessScore(enrichedBranch, weaknesses);
      return enrichedBranch;
    });
  }

  const enriched = {
    ...project,
    mainCoverage,
    proposals,
    weaknesses,
    opinions,
    commitHistory,
    ...(pilotModel ? { pilotModel } : {})
  };

  enriched.icmn = calculatePlanIcmn(enriched);
  return enriched;
}

export function getCategories(projects = []) {
  const set = new Set();
  for (const p of projects) {
    if (p.category) {
      set.add(p.category);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

export function listProjects(projects = [], options = {}) {
  const opts = typeof options === 'string' ? { filter: options } : (options || {});
  const filter = opts.filter || 'all';
  const query = normalizeForSearch(opts.q || '');
  const category = sanitizeText(opts.category || '');

  let list = projects.map((raw) => {
    const p = raw.icmn ? raw : enrichProject(raw);
    const weaknesses = p.weaknesses || [];
    const openCriticalWeaknesses = weaknesses.filter(
      (w) => w.status !== 'mitigada' && w.severity === 'critica'
    ).length;

    return {
      id: p.id,
      code: p.code,
      title: p.title,
      category: p.category,
      stage: p.stage,
      summary: p.summary,
      author: p.author || 'Iniciativa Pública',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      popularity: p.popularity || 0,
      proposalsCount: (p.proposals || []).length,
      opinionsCount: (p.opinions || []).length,
      weaknessesCount: weaknesses.length,
      openCriticalWeaknesses,
      icmnScore: p.icmn?.totalScore ?? 0,
      readyForLegislation: Boolean(p.icmn?.readyForLegislation),
      hasSimulator: Boolean(p.pilotModel?.branches?.length),
      _searchBlob: normalizeForSearch(
        [
          p.title,
          p.summary,
          p.category,
          p.code,
          ...(p.monograph || []).map((s) => s.title)
        ].join(' ')
      )
    };
  });

  if (category && category !== 'all') {
    list = list.filter((p) => p.category === category);
  }

  if (query) {
    const terms = query.split(/\s+/).filter(Boolean);
    list = list.filter((p) => terms.every((term) => p._searchBlob.includes(term)));
  }

  if (filter === 'recent') {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (filter === 'popular') {
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (filter === 'pending') {
    list = list.filter(
      (p) =>
        p.stage.toLowerCase().includes('pendiente') ||
        p.proposalsCount < 2 ||
        p.openCriticalWeaknesses > 0
    );
  } else if (filter === 'debate') {
    list = list.filter((p) => p.stage.toLowerCase().includes('debate'));
  } else if (filter === 'ready') {
    list = list.filter((p) => p.readyForLegislation);
  }

  return list.map(({ _searchBlob, ...publicItem }) => publicItem);
}

export function createProjectRecord(payload = {}, existingProjects = []) {
  const title = sanitizeText(payload.title);
  if (!title) {
    throw new Error('El título del plan es obligatorio');
  }

  const summary = sanitizeText(payload.summary);
  if (!summary) {
    throw new Error('El resumen del plan es obligatorio');
  }

  const category = sanitizeText(payload.category) || 'Política Pública';
  const author = sanitizeText(payload.author) || 'Iniciativa Ciudadana';
  const today = todayIso();
  const randomSuffix = Math.floor(Math.random() * 900 + 100);

  const id = ensureUniqueSlug(
    payload.id || title,
    existingProjects.map((p) => p.id)
  );
  const code = sanitizeText(payload.code) || `EXP-2026-CIUD-${randomSuffix}`;

  let monograph = [];
  if (Array.isArray(payload.monograph) && payload.monograph.length > 0) {
    monograph = payload.monograph.map((s, idx) => ({
      id: sanitizeText(s.id) || `sec-${idx + 1}`,
      title: sanitizeText(s.title) || `Sección ${idx + 1}`,
      content: sanitizeMultilineText(s.content || '')
    }));
  } else if (payload.initialContent && String(payload.initialContent).trim()) {
    monograph = [
      {
        id: 'diagnostico',
        title: '1. El problema y por qué hace falta actuar',
        content: sanitizeMultilineText(payload.initialContent)
      },
      {
        id: 'articulado',
        title: '2. Medidas concretas',
        content:
          sanitizeMultilineText(payload.measuresContent) ||
          'Medidas concretas pendientes de redactar entre las personas participantes.'
      },
      {
        id: 'impacto',
        title: '3. Costes e impacto previsto',
        content:
          sanitizeMultilineText(payload.impactContent) ||
          'Costes, beneficios sociales e impacto territorial pendientes de calcular.'
      },
      {
        id: 'puntos-criticos',
        title: '4. Dudas abiertas y puntos a revisar',
        content:
          sanitizeMultilineText(payload.debateContent) ||
          'Aspectos pendientes de debate y posibles fallos para revisar.'
      }
    ];
  } else {
    monograph = [
      {
        id: 'diagnostico',
        title: '1. El problema y por qué hace falta actuar',
        content: summary
      },
      {
        id: 'articulado',
        title: '2. Medidas concretas',
        content: 'Propuestas concretas abiertas a cambios y mejoras.'
      }
    ];
  }

  const sourceSeedId = sanitizeText(payload.sourceSeedId) || null;

  const project = {
    id,
    code,
    title,
    category,
    stage: sanitizeText(payload.stage) || 'Debate abierto',
    summary,
    author,
    sourceSeedId,
    createdAt: today,
    updatedAt: today,
    popularity: 15,
    mainCoverage: {
      juridico: false,
      economico: false,
      laboral_pyme: false,
      social_igualdad: false,
      ambiental_territorial: false
    },
    monograph,
    proposals: [],
    weaknesses: [],
    opinions: [],
    commitHistory: [
      {
        commitId: `rev-${Date.now().toString(36)}`,
        date: today,
        sectionId: 'expediente',
        proposalId: null,
        title: 'Apertura inicial del plan',
        coAuthors: [author],
        mitigatedWeaknesses: []
      }
    ]
  };

  return enrichProject(project);
}

export function createProposalRecord(project, payload = {}) {
  if (!project) {
    throw new Error('No hemos encontrado este plan.');
  }

  const title = sanitizeText(payload.title);
  if (!title) {
    throw new Error('Pon un título breve a tu propuesta.');
  }

  const proposedText = sanitizeMultilineText(payload.proposedText || '');
  if (!proposedText) {
    throw new Error('El texto propuesto no puede quedar vacío.');
  }

  const requestedSectionId = sanitizeText(payload.sectionId || '');
  let targetSection = null;
  if (requestedSectionId) {
    targetSection = (project.monograph || []).find((s) => s.id === requestedSectionId);
    if (!targetSection) {
      throw new Error(`El apartado ${requestedSectionId} no existe en este plan.`);
    }
  } else {
    targetSection = (project.monograph || [])[0];
  }

  const sectionId = targetSection?.id || 'seccion';
  const originalText = sanitizeMultilineText(payload.originalText || '') || targetSection?.content || '';
  const author = sanitizeText(payload.author) || 'Ciudadano Colaborador';
  const authorRole = sanitizeText(payload.authorRole) || 'Participante / Especialista';
  const reason = sanitizeMultilineText(payload.reason || '');
  const diff = computeClauseDiff(originalText, proposedText);

  let requiredDomains = Array.isArray(payload.requiredDomains)
    ? payload.requiredDomains.filter((d) => Boolean(POLICY_DOMAINS[d]))
    : [];
  if (requiredDomains.length === 0) {
    requiredDomains = inferNeededDomainsFromText(`${title} ${reason} ${proposedText}`);
  }

  const domainAnalyses = {};
  if (payload.domainAnalyses && typeof payload.domainAnalyses === 'object') {
    for (const [key, val] of Object.entries(payload.domainAnalyses)) {
      if (POLICY_DOMAINS[key] && sanitizeText(val)) {
        domainAnalyses[key] = sanitizeMultilineText(val);
      }
    }
  }

  if (payload.primaryDomain && POLICY_DOMAINS[payload.primaryDomain]) {
    if (!requiredDomains.includes(payload.primaryDomain)) {
      requiredDomains.push(payload.primaryDomain);
    }
    const analysis = sanitizeMultilineText(payload.primaryAnalysis || '');
    if (analysis) {
      domainAnalyses[payload.primaryDomain] = analysis;
    }
  }

  for (const coveredKey of Object.keys(domainAnalyses)) {
    if (!requiredDomains.includes(coveredKey)) {
      requiredDomains.push(coveredKey);
    }
  }

  const coveredDomains = Object.keys(domainAnalyses);
  const pendingDomains = requiredDomains.filter((d) => !coveredDomains.includes(d));
  const isComplete = pendingDomains.length === 0;
  const today = todayIso();

  const existingWeaknessIds = new Set((project.weaknesses || []).map((w) => w.id));
  const mitigatesWeaknessIds = Array.isArray(payload.mitigatesWeaknessIds)
    ? payload.mitigatesWeaknessIds.filter((id) => existingWeaknessIds.has(id))
    : [];

  const proposalId = sanitizeText(payload.id) || `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const newProposal = {
    id: proposalId,
    sectionId,
    title,
    author,
    originalText,
    proposedText,
    diff,
    reason,
    requiredDomains,
    coveredDomains,
    pendingDomains,
    domainAnalyses,
    maturityLevel: isComplete
      ? MATURITY_LEVELS.LEVEL_3_INTEGRATED_PR
      : MATURITY_LEVELS.LEVEL_2_SCOPED_PR,
    status: isComplete ? 'Lista para consolidación' : 'Solicita co-autoría',
    coAuthors: [
      {
        name: author,
        role: authorRole,
        contributedDomains: coveredDomains.length > 0 ? coveredDomains : ['propuesta_redaccion'],
        date: today
      }
    ],
    mitigatesWeaknessIds,
    reviewComments: coveredDomains.map((d) => ({
      author,
      role: authorRole,
      domain: d,
      text: domainAnalyses[d],
      date: today
    })),
    createdAt: today,
    ...(payload.githubIssueNumber ? { githubIssueNumber: payload.githubIssueNumber } : {}),
    ...(payload.githubIssueUrl ? { githubIssueUrl: payload.githubIssueUrl } : {})
  };

  if (!Array.isArray(project.proposals)) {
    project.proposals = [];
  }
  project.proposals.unshift(newProposal);

  if (Array.isArray(project.weaknesses)) {
    for (const weaknessId of mitigatesWeaknessIds) {
      const weakness = project.weaknesses.find((w) => w.id === weaknessId);
      if (weakness && weakness.status === 'abierta') {
        weakness.status = 'en_mitigacion';
        weakness.linkedProposalId = newProposal.id;
      }
    }
  }

  project.popularity = (project.popularity || 0) + 5;
  project.updatedAt = today;
  project.icmn = calculatePlanIcmn(project);

  return newProposal;
}

export function elaborateProposalRecord(project, proposalId, payload = {}) {
  if (!project) {
    throw new Error('No hemos encontrado este plan.');
  }
  const proposal = (project.proposals || []).find((p) => p.id === proposalId);
  if (!proposal) {
    throw new Error(`No hemos encontrado la propuesta ${proposalId}.`);
  }
  if (proposal.status === 'Consolidada' || proposal.maturityLevel?.level === 4) {
    throw new Error('Esta propuesta ya forma parte del texto actual.');
  }

  const contributorName = sanitizeText(payload.contributorName);
  if (!contributorName) {
    throw new Error('Escribe tu nombre o el de tu equipo.');
  }
  const contributorRole = sanitizeText(payload.contributorRole) || 'Especialista colaborador';
  const domain = sanitizeText(payload.domain);
  if (!POLICY_DOMAINS[domain]) {
    throw new Error('Elige un área válida de impacto (MAIN).');
  }
  const analysisText = sanitizeMultilineText(payload.analysisText);
  if (!analysisText) {
    throw new Error('Añade tu análisis para esta área.');
  }

  const today = todayIso();
  proposal.domainAnalyses = { ...(proposal.domainAnalyses || {}), [domain]: analysisText };
  proposal.requiredDomains = Array.isArray(proposal.requiredDomains) ? [...proposal.requiredDomains] : [];
  if (!proposal.requiredDomains.includes(domain)) {
    proposal.requiredDomains.push(domain);
  }
  proposal.coveredDomains = Object.keys(proposal.domainAnalyses);
  proposal.pendingDomains = proposal.requiredDomains.filter(
    (d) => !proposal.coveredDomains.includes(d)
  );

  if (payload.proposedText && sanitizeMultilineText(payload.proposedText)) {
    proposal.proposedText = sanitizeMultilineText(payload.proposedText);
    proposal.diff = computeClauseDiff(proposal.originalText, proposal.proposedText);
  }

  proposal.coAuthors = Array.isArray(proposal.coAuthors) ? proposal.coAuthors : [];
  proposal.coAuthors.push({
    name: contributorName,
    role: contributorRole,
    contributedDomains: [domain],
    date: today
  });

  proposal.reviewComments = Array.isArray(proposal.reviewComments) ? proposal.reviewComments : [];
  proposal.reviewComments.push({
    author: contributorName,
    role: contributorRole,
    domain,
    text: analysisText,
    date: today
  });

  if (proposal.pendingDomains.length === 0) {
    proposal.maturityLevel = MATURITY_LEVELS.LEVEL_3_INTEGRATED_PR;
    proposal.status = 'Lista para consolidación';
  }

  project.popularity = (project.popularity || 0) + 3;
  project.updatedAt = today;
  project.icmn = calculatePlanIcmn(project);

  return proposal;
}

export function consolidateProposalRecord(project, proposalId, reviewerNote = '') {
  if (!project) {
    throw new Error('No hemos encontrado este plan.');
  }
  const proposal = (project.proposals || []).find((p) => p.id === proposalId);
  if (!proposal) {
    throw new Error(`No hemos encontrado la propuesta ${proposalId}.`);
  }
  if (proposal.status === 'Consolidada' || proposal.maturityLevel?.level === 4) {
    throw new Error('Esta propuesta ya se incorporó al texto.');
  }
  if (Array.isArray(proposal.pendingDomains) && proposal.pendingDomains.length > 0) {
    throw new Error(
      `Faltan análisis en dominios pendientes antes de incorporar la propuesta: ${proposal.pendingDomains.join(', ')}`
    );
  }

  const targetSection = (project.monograph || []).find((s) => s.id === proposal.sectionId);
  if (!targetSection) {
    throw new Error(`No existe el apartado ${proposal.sectionId}.`);
  }

  const today = todayIso();
  targetSection.content = proposal.proposedText;

  project.mainCoverage = { ...(project.mainCoverage || {}) };
  for (const domainKey of proposal.coveredDomains || []) {
    if (POLICY_DOMAINS[domainKey]) {
      project.mainCoverage[domainKey] = true;
    }
  }

  for (const weaknessId of proposal.mitigatesWeaknessIds || []) {
    const weakness = (project.weaknesses || []).find((w) => w.id === weaknessId);
    if (weakness) {
      weakness.status = 'mitigada';
      weakness.mitigatedByProposalId = proposal.id;
      weakness.resolutionNote =
        sanitizeText(reviewerNote) || `Mitigada mediante la consolidación de: ${proposal.title}`;
    }
  }

  proposal.status = 'Consolidada';
  proposal.maturityLevel = MATURITY_LEVELS.LEVEL_4_MERGED;
  proposal.consolidatedAt = today;

  const commitEntry = {
    commitId: `rev-${Date.now().toString(36)}`,
    date: today,
    sectionId: proposal.sectionId,
    proposalId: proposal.id,
    title: proposal.title,
    coAuthors: (proposal.coAuthors || []).map((c) => c.name),
    mitigatedWeaknesses: proposal.mitigatesWeaknessIds || []
  };

  if (!Array.isArray(project.commitHistory)) {
    project.commitHistory = [];
  }
  project.commitHistory.unshift(commitEntry);

  project.popularity = (project.popularity || 0) + 6;
  project.updatedAt = today;
  project.icmn = calculatePlanIcmn(project);

  return { proposal, commitEntry };
}

export function createWeaknessRecord(project, payload = {}) {
  if (!project) {
    throw new Error('No hemos encontrado este plan.');
  }
  const title = sanitizeText(payload.title);
  if (!title) {
    throw new Error('Pon un título breve al fallo.');
  }
  const description = sanitizeMultilineText(payload.description);
  if (!description) {
    throw new Error('Explica qué falla y por qué hay que corregirlo.');
  }

  const severity = ['critica', 'alta', 'moderada'].includes(payload.severity)
    ? payload.severity
    : 'alta';
  const domain = POLICY_DOMAINS[payload.domain] ? payload.domain : 'laboral_pyme';

  const requestedSectionId = sanitizeText(payload.sectionId || '');
  let sectionId = project.monograph?.[0]?.id || 'articulado';
  if (requestedSectionId) {
    const found = (project.monograph || []).find((s) => s.id === requestedSectionId);
    if (!found) {
      throw new Error(`El apartado ${requestedSectionId} no existe en este plan.`);
    }
    sectionId = found.id;
  }

  const today = todayIso();
  const weakness = {
    id: sanitizeText(payload.id) || `deb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    description,
    severity,
    domain,
    sectionId,
    affectedGroup: sanitizeText(payload.affectedGroup) || 'Grupo o sector afectado',
    reportedBy: sanitizeText(payload.reportedBy) || 'Colaborador ciudadano',
    status: 'abierta',
    linkedProposalId: null,
    mitigatedByProposalId: null,
    createdAt: today,
    ...(payload.githubIssueNumber ? { githubIssueNumber: payload.githubIssueNumber } : {}),
    ...(payload.githubIssueUrl ? { githubIssueUrl: payload.githubIssueUrl } : {})
  };

  if (!Array.isArray(project.weaknesses)) {
    project.weaknesses = [];
  }
  project.weaknesses.unshift(weakness);
  project.popularity = (project.popularity || 0) + 3;
  project.updatedAt = today;
  project.icmn = calculatePlanIcmn(project);

  return weakness;
}

export function createOpinionRecord(project, payload = {}) {
  if (!project) {
    throw new Error('No hemos encontrado este plan.');
  }
  const text = sanitizeMultilineText(payload.text);
  if (!text) {
    throw new Error('Escribe tu opinión antes de enviarla.');
  }

  const author = sanitizeText(payload.author) || 'Ciudadano Participante';
  const type = sanitizeText(payload.type) || 'Aportación ciudadana';
  const requestedSectionId = sanitizeText(payload.sectionId || '');
  let sectionId = null;
  if (requestedSectionId) {
    const found = (project.monograph || []).find((s) => s.id === requestedSectionId);
    if (!found) {
      throw new Error(`El apartado ${requestedSectionId} no existe en este plan.`);
    }
    sectionId = found.id;
  }

  const today = todayIso();
  const opinion = {
    id: sanitizeText(payload.id) || `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    author,
    type,
    sectionId,
    text,
    createdAt: today
  };

  if (!Array.isArray(project.opinions)) {
    project.opinions = [];
  }
  project.opinions.unshift(opinion);
  project.popularity = (project.popularity || 0) + 2;
  project.updatedAt = today;

  return opinion;
}

export function createSeedRecord(payload = {}) {
  const title = sanitizeText(payload.title);
  if (!title) {
    throw new Error('Pon un título breve a tu idea.');
  }
  const description = sanitizeMultilineText(payload.description);
  if (!description) {
    throw new Error('Explica tu idea antes de guardarla.');
  }

  return {
    id: sanitizeText(payload.id) || `idea-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    category: sanitizeText(payload.category) || 'Iniciativa ciudadana',
    author: sanitizeText(payload.author) || 'Ciudadano proponente',
    description,
    votes: Number.isFinite(Number(payload.votes)) ? Math.max(1, Number(payload.votes)) : 1,
    promotedProjectId: null,
    createdAt: todayIso(),
    ...(payload.githubIssueNumber ? { githubIssueNumber: payload.githubIssueNumber } : {}),
    ...(payload.githubIssueUrl ? { githubIssueUrl: payload.githubIssueUrl } : {})
  };
}

export function endorseSeedRecord(seeds = [], seedId) {
  const seed = seeds.find((s) => s.id === seedId);
  if (!seed) {
    throw new Error(`No hemos encontrado la idea ${seedId}.`);
  }
  seed.votes = (Number(seed.votes) || 0) + 1;
  return seed;
}
