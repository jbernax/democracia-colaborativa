/**
 * Motor de Colaboracion Normativa Progresiva ("Git para Politicas Publicas")
 * Gestiona Semillas ("Pendientes de Elaborar"), Enmiendas de Dominio (PRs parciales),
 * Co-autoria multidisciplinar, Auditorias de Debilidad (Stress Tests), Diffs normativos
 * e Indice de Calidad y Madurez Normativa (ICMN).
 */

import { simulatePlanImpact, computeImpactDelta } from './impactSimulator.js';

export const POLICY_DOMAINS = Object.freeze({
  juridico: {
    id: 'juridico',
    label: 'Juridico y Normativo',
    description: 'Redaccion articulada (ET / LGSS), encaje constitucional y Directivas UE'
  },
  economico: {
    id: 'economico',
    label: 'Economico y Presupuestario (AIReF)',
    description: 'Coste para Seguridad Social, retorno fiscal IRPF/IVA y sostenibilidad'
  },
  laboral_pyme: {
    id: 'laboral_pyme',
    label: 'Laboral, PYMEs y Autonomos (RETA)',
    description: 'Viabilidad de turnos, contratos de relevo en micropymes y cobertura RETA'
  },
  social_igualdad: {
    id: 'social_igualdad',
    label: 'Social, Demografico e Igualdad',
    description: 'Corresponsabilidad, reduccion de brecha salarial, monoparentalidad y crianza'
  },
  ambiental_territorial: {
    id: 'ambiental_territorial',
    label: 'Medioambiental y Reto Demografico',
    description: 'Reduccion de movilidad pendular (CO2) y viabilidad en municipios rurales'
  }
});

export const MATURITY_LEVELS = Object.freeze({
  LEVEL_1_SEED: {
    code: 'nivel_1_semilla',
    level: 1,
    label: 'Nivel 1: Idea / Pendiente de Elaborar'
  },
  LEVEL_2_SCOPED_PR: {
    code: 'nivel_2_enmienda_dominio',
    level: 2,
    label: 'Nivel 2: Enmienda de Dominio (Solicita Co-autoria)'
  },
  LEVEL_3_INTEGRATED_PR: {
    code: 'nivel_3_enmienda_integrada',
    level: 3,
    label: 'Nivel 3: Enmienda Integrada (Lista para Revision y Fusion)'
  },
  LEVEL_4_MERGED: {
    code: 'nivel_4_consolidada',
    level: 4,
    label: 'Nivel 4: Disposicion Consolidada (Fusionada)'
  }
});

export function computeClauseDiff(originalText = '', proposedText = '') {
  const origLines = String(originalText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const propLines = String(proposedText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const origSet = new Set(origLines);
  const propSet = new Set(propLines);
  const diffEntries = [];

  for (const line of origLines) {
    if (!propSet.has(line)) {
      diffEntries.push({ type: 'removed', text: line });
    } else {
      diffEntries.push({ type: 'unchanged', text: line });
    }
  }

  for (const line of propLines) {
    if (!origSet.has(line)) {
      diffEntries.push({ type: 'added', text: line });
    }
  }

  return diffEntries;
}

export function evaluateStakeholderSatisfaction(impact, branchWeaknesses = []) {
  const openCriticalCount = branchWeaknesses.filter(
    (w) => w.status !== 'mitigada' && w.severity === 'critica'
  ).length;
  const penalty = openCriticalCount * 8;

  // 1. Sindicatos y Representacion Sindical: priorizan subsidio salarial, retencion y corresponsabilidad
  const unionsScore = clampScore(
    impact.parameters.salarySubsidyPercent * 0.55 +
      impact.laborSme.femaleRetentionGainPercent * 2.2 +
      impact.socialEquality.coResponsibilityIndex * 0.25 -
      penalty
  );

  // 2. Asociaciones de PYMEs y Autonomos (CEPYME / ATA): priorizan baja friccion en micropymes y cobertura RETA
  const smeRetaScore = clampScore(
    (100 - impact.laborSme.smeOrganizationalFrictionIndex) * 0.55 +
      impact.laborSme.retaEffectiveCoveragePercent * 0.45 -
      penalty
  );

  // 3. Evaluacion Presupuestaria y Hacienda (Estilo AIReF): prioriza coste neto contenido y alto retorno fiscal
  const netCostRatio = Math.max(0, 100 - (impact.fiscal.netPublicCostMillionEur / 28));
  const fiscalScore = clampScore(
    netCostRatio * 0.65 +
      (impact.fiscal.inducedFiscalReturnMillionEur /
        Math.max(1, impact.fiscal.grossPublicCostMillionEur)) *
        100 *
        0.35 -
      penalty * 0.5
  );

  // 4. Colectivos de Familias, Infancia e Igualdad: priorizan horas de cuidado, equidad monoparental y renta familiar
  const familiesEqualityScore = clampScore(
    Math.min(100, impact.socialEquality.additionalCareHoursPerInfant / 7.5) * 0.4 +
      impact.socialEquality.monoparentalEquityScore * 0.3 +
      impact.socialEquality.householdIncomePreservationPercent * 0.3 -
      penalty
  );

  // 5. Municipio Rural y Transicion Ecologica: priorizan viabilidad rural y reduccion de emisiones
  const territorialEcoScore = clampScore(
    impact.environmentalTerritorial.ruralViabilityIndex * 0.65 +
      Math.min(100, impact.environmentalTerritorial.avoidedCo2KilotonnesPerYear * 1.4) * 0.35 -
      penalty
  );

  const scores = [
    {
      stakeholderId: 'sindicatos_trabajadores',
      label: 'Representacion Sindical y Laboral',
      score: unionsScore,
      minimumThreshold: 68
    },
    {
      stakeholderId: 'pymes_autonomos',
      label: 'Asociaciones de PYMEs y Autonomos (RETA)',
      score: smeRetaScore,
      minimumThreshold: 65
    },
    {
      stakeholderId: 'evaluacion_fiscal_airef',
      label: 'Sostenibilidad Presupuestaria y Fiscal',
      score: fiscalScore,
      minimumThreshold: 62
    },
    {
      stakeholderId: 'familias_igualdad',
      label: 'Colectivos de Familias, Infancia e Igualdad',
      score: familiesEqualityScore,
      minimumThreshold: 72
    },
    {
      stakeholderId: 'mundo_rural_ecologia',
      label: 'Municipios Rurales y Movilidad Sostenible',
      score: territorialEcoScore,
      minimumThreshold: 65
    }
  ];

  const satisfiedCount = scores.filter((s) => s.score >= s.minimumThreshold).length;
  const averageScore = Math.round(
    scores.reduce((acc, item) => acc + item.score, 0) / scores.length
  );
  const consensusBridgeScore = Math.round(
    averageScore * 0.65 + (satisfiedCount / scores.length) * 100 * 0.35
  );

  return {
    stakeholderScores: scores,
    satisfiedCount,
    totalStakeholders: scores.length,
    consensusBridgeScore: clampScore(consensusBridgeScore)
  };
}

export function calculateReadinessScore(branch, allWeaknesses = []) {
  const branchWeaknesses = allWeaknesses.filter(
    (w) => w.targetBranchId === branch.id || w.targetBranchId === 'all'
  );

  const openWeaknesses = branchWeaknesses.filter((w) => w.status !== 'mitigada');
  const openCriticalCount = openWeaknesses.filter((w) => w.severity === 'critica').length;
  const openHighCount = openWeaknesses.filter((w) => w.severity === 'alta').length;
  const openModerateCount = openWeaknesses.filter((w) => w.severity === 'moderada').length;

  // 1. Completitud MAIN (30%)
  const coveredAxesCount = Object.keys(POLICY_DOMAINS).filter((domainKey) => {
    return Boolean(branch.mainCoverage && branch.mainCoverage[domainKey]);
  }).length;
  const mainCoverageScore = Math.round(
    (coveredAxesCount / Object.keys(POLICY_DOMAINS).length) * 100
  );

  // 2. Solidez frente a Auditoria de Debilidades (30%)
  const rawAuditScore =
    100 - openCriticalCount * 25 - openHighCount * 12 - openModerateCount * 5;
  const weaknessAuditScore = clampScore(rawAuditScore);

  // 3. Puente de Consenso Transversal (20%)
  const impact = branch.impact || simulatePlanImpact(branch.parameters);
  const bridging = evaluateStakeholderSatisfaction(impact, branchWeaknesses);
  const consensusBridgeScore = bridging.consensusBridgeScore;

  // 4. Precision Juridica y Operativa (20%)
  const clauseCount = Array.isArray(branch.clauses) ? branch.clauses.length : 0;
  const monoparentalBonus = impact.parameters.monoparentalMultiplier >= 1.6 ? 15 : 0;
  const retaBonus = impact.parameters.selfEmployedFlatGrantEur >= 500 ? 15 : 0;
  const legalPrecisionScore = clampScore(Math.min(70, clauseCount * 22) + monoparentalBonus + retaBonus);

  const totalScore = Math.round(
    0.3 * mainCoverageScore +
      0.3 * weaknessAuditScore +
      0.2 * consensusBridgeScore +
      0.2 * legalPrecisionScore
  );

  const readyForLegislation = totalScore >= 80 && openCriticalCount === 0;
  let statusLabel = 'En Elaboracion y Auditoria Abierta';
  if (readyForLegislation) {
    statusLabel = 'Apta para Tramitacion Legislativa (ICMN >= 80 y 0 Debilidades Criticas)';
  } else if (openCriticalCount > 0) {
    statusLabel = `Bloqueada por ${openCriticalCount} Debilidad(es) Critica(s) sin Mitigar`;
  } else if (totalScore >= 70) {
    statusLabel = 'Madurez Avanzada (Requiere Ajustes de Consenso o Co-autoria)';
  }

  return {
    totalScore,
    readyForLegislation,
    statusLabel,
    breakdown: {
      mainCoverageScore,
      weaknessAuditScore,
      consensusBridgeScore,
      legalPrecisionScore,
      openCriticalCount,
      openHighCount,
      openModerateCount
    },
    stakeholderBridging: bridging
  };
}

export function inferNeededDomainsFromText(text = '', preferredDomains = []) {
  if (Array.isArray(preferredDomains) && preferredDomains.length > 0) {
    return preferredDomains.filter((d) => Boolean(POLICY_DOMAINS[d]));
  }

  const lower = String(text).toLowerCase();
  const inferred = new Set();

  if (
    lower.includes('estatuto') ||
    lower.includes('art.') ||
    lower.includes('articulo') ||
    lower.includes('ley') ||
    lower.includes('despido') ||
    lower.includes('monoparental')
  ) {
    inferred.add('juridico');
  }
  if (
    lower.includes('coste') ||
    lower.includes('presupuesto') ||
    lower.includes('cotizacion') ||
    lower.includes('seguridad social') ||
    lower.includes('bonificacion') ||
    lower.includes('irpf')
  ) {
    inferred.add('economico');
  }
  if (
    lower.includes('pyme') ||
    lower.includes('autonom') ||
    lower.includes('reta') ||
    lower.includes('relevo') ||
    lower.includes('turno') ||
    lower.includes('empresa')
  ) {
    inferred.add('laboral_pyme');
  }
  if (
    lower.includes('corresponsabilidad') ||
    lower.includes('lactancia') ||
    lower.includes('guarderia') ||
    lower.includes('escuela infantil') ||
    lower.includes('igualdad') ||
    lower.includes('brecha')
  ) {
    inferred.add('social_igualdad');
  }
  if (
    lower.includes('rural') ||
    lower.includes('pueblo') ||
    lower.includes('desplazamiento') ||
    lower.includes('transporte') ||
    lower.includes('teletrabajo') ||
    lower.includes('emisiones')
  ) {
    inferred.add('ambiental_territorial');
  }

  if (inferred.size === 0) {
    inferred.add('juridico');
    inferred.add('economico');
    inferred.add('laboral_pyme');
  } else if (inferred.size === 1) {
    // Asegura que toda semilla convoque al menos una perspectiva complementaria
    if (!inferred.has('juridico')) {
      inferred.add('juridico');
    } else {
      inferred.add('economico');
    }
  }

  return Array.from(inferred);
}

export function createSeed(state, payload) {
  const title = requireNonEmptyString(payload.title, 'El titulo de la idea es obligatorio');
  const description = requireNonEmptyString(
    payload.description,
    'La descripcion de la idea es obligatoria'
  );
  const authorName = sanitizeText(payload.authorName || 'Ciudadano Participante');
  const authorProfile = sanitizeText(payload.authorProfile || 'Ciudadania / Experiencia Directa');
  const targetBranchId = sanitizeText(payload.targetBranchId || 'rama-media-jornada-bonificada');
  const affectedCollective = sanitizeText(
    payload.affectedCollective || 'Trabajadores y familias afectadas'
  );

  const neededDomains = inferNeededDomainsFromText(
    `${title} ${description} ${affectedCollective}`,
    payload.neededDomains
  );

  const newSeed = {
    id: payload.id || `idea-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    description,
    authorName,
    authorProfile,
    targetBranchId,
    affectedCollective,
    neededDomains,
    maturityLevel: MATURITY_LEVELS.LEVEL_1_SEED,
    status: 'pendiente_de_elaborar',
    promotedAmendmentId: null,
    endorsements: 1,
    createdAt: new Date().toISOString().slice(0, 10)
  };

  state.seeds.unshift(newSeed);
  return newSeed;
}

export function createAmendment(state, payload) {
  const title = requireNonEmptyString(payload.title, 'El titulo de la enmienda es obligatorio');
  const summary = requireNonEmptyString(
    payload.summary,
    'El resumen de la enmienda es obligatorio'
  );
  const targetBranchId = sanitizeText(payload.targetBranchId || 'rama-media-jornada-bonificada');
  const targetClauseId = sanitizeText(payload.targetClauseId || 'art-37-6-et');
  const authorName = sanitizeText(payload.authorName || 'Especialista Colaborador');
  const authorRole = sanitizeText(payload.authorRole || 'Especialista de Dominio');

  const branch = findBranchOrTrunk(state, targetBranchId);
  const currentClause = findClauseInTarget(branch, targetClauseId);
  const originalClauseText = currentClause ? currentClause.text : '';
  const proposedClauseText = sanitizeText(
    payload.proposedClauseText || originalClauseText
  );

  // Dominios requeridos para considerar la enmienda completamente integrada
  const requiredDomains =
    Array.isArray(payload.requiredDomains) && payload.requiredDomains.length > 0
      ? payload.requiredDomains.filter((d) => Boolean(POLICY_DOMAINS[d]))
      : ['juridico', 'economico', 'laboral_pyme'];

  // Dominios que el autor inicial aporta en este momento (puede ser solo 1, ej. juridico)
  const rawDomainAnalyses = payload.domainAnalyses || {};
  const domainAnalyses = {};
  for (const [key, val] of Object.entries(rawDomainAnalyses)) {
    if (POLICY_DOMAINS[key] && val && String(val).trim().length > 0) {
      domainAnalyses[key] = sanitizeText(val);
    }
  }

  // Si el autor envio un campo simple primaryDomain + primaryAnalysis, lo incorporamos
  if (payload.primaryDomain && POLICY_DOMAINS[payload.primaryDomain] && payload.primaryAnalysis) {
    domainAnalyses[payload.primaryDomain] = sanitizeText(payload.primaryAnalysis);
  }

  // Asegurar que el dominio primario este dentro de requiredDomains
  for (const coveredKey of Object.keys(domainAnalyses)) {
    if (!requiredDomains.includes(coveredKey)) {
      requiredDomains.push(coveredKey);
    }
  }

  const coveredDomains = Object.keys(domainAnalyses);
  const pendingDomains = requiredDomains.filter((d) => !coveredDomains.includes(d));

  const isComplete = pendingDomains.length === 0;
  const maturityLevel = isComplete
    ? MATURITY_LEVELS.LEVEL_3_INTEGRATED_PR
    : MATURITY_LEVELS.LEVEL_2_SCOPED_PR;

  const baseParams = branch.parameters || state.branches[0].parameters;
  const proposedParameterChanges = sanitizeParameterChanges(payload.parameterChanges);
  const candidateParams = { ...baseParams, ...proposedParameterChanges };
  const impactComparison = computeImpactDelta(baseParams, candidateParams);

  const coAuthors = [
    {
      name: authorName,
      role: authorRole,
      contributedDomains: coveredDomains.length > 0 ? coveredDomains : ['propuesta_inicial'],
      date: new Date().toISOString().slice(0, 10)
    }
  ];

  // Si proviene de una Semilla ciudadana ("Pendiente de Elaborar"), conservar la trazabilidad y co-autoria
  let sourceSeedId = null;
  if (payload.fromSeedId) {
    const seed = state.seeds.find((s) => s.id === payload.fromSeedId);
    if (seed) {
      sourceSeedId = seed.id;
      seed.status = 'en_elaboracion_como_enmienda';
      coAuthors.unshift({
        name: seed.authorName,
        role: `${seed.authorProfile} (Autor de Semilla Original)`,
        contributedDomains: ['semilla_ciudadana'],
        date: seed.createdAt
      });
    }
  }

  const mitigatesWeaknessIds = Array.isArray(payload.mitigatesWeaknessIds)
    ? payload.mitigatesWeaknessIds.filter(Boolean)
    : [];

  const newAmendment = {
    id: `enmienda-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    summary,
    targetBranchId,
    targetClauseId,
    originalClauseText,
    proposedClauseText,
    clauseDiff: computeClauseDiff(originalClauseText, proposedClauseText),
    parameterChanges: proposedParameterChanges,
    impactDelta: impactComparison.deltas,
    requiredDomains,
    coveredDomains,
    pendingDomains,
    domainAnalyses,
    maturityLevel,
    status: isComplete ? 'lista_para_fusion' : 'solicita_coautoria',
    coAuthors,
    sourceSeedId,
    mitigatesWeaknessIds,
    reviewComments: [],
    createdAt: new Date().toISOString().slice(0, 10)
  };

  if (sourceSeedId) {
    const seed = state.seeds.find((s) => s.id === sourceSeedId);
    if (seed) {
      seed.promotedAmendmentId = newAmendment.id;
    }
  }

  for (const weaknessId of mitigatesWeaknessIds) {
    const weakness = state.weaknesses.find((w) => w.id === weaknessId);
    if (weakness && weakness.status === 'abierta') {
      weakness.status = 'en_mitigacion';
      weakness.linkedAmendmentId = newAmendment.id;
    }
  }

  state.amendments.unshift(newAmendment);
  return newAmendment;
}

export function elaborateAmendment(state, amendmentId, payload) {
  const amendment = state.amendments.find((a) => a.id === amendmentId);
  if (!amendment) {
    throw new Error(`No se encontro la enmienda con identificador ${amendmentId}`);
  }
  if (amendment.status === 'fusionada') {
    throw new Error('La enmienda ya ha sido fusionada en el expediente');
  }

  const contributorName = requireNonEmptyString(
    payload.contributorName,
    'El nombre del co-autor o especialista es obligatorio'
  );
  const contributorRole = sanitizeText(
    payload.contributorRole || 'Especialista Co-autor'
  );
  const domainKey = requireNonEmptyString(
    payload.domain,
    'Debe indicar el dominio tecnico que esta completando'
  );

  if (!POLICY_DOMAINS[domainKey]) {
    throw new Error(`El dominio ${domainKey} no es valido`);
  }

  const analysisText = requireNonEmptyString(
    payload.analysisText,
    'Debe incluir el analisis o desarrollo tecnico para este dominio'
  );

  amendment.domainAnalyses[domainKey] = sanitizeText(analysisText);
  if (!amendment.requiredDomains.includes(domainKey)) {
    amendment.requiredDomains.push(domainKey);
  }
  if (!amendment.coveredDomains.includes(domainKey)) {
    amendment.coveredDomains.push(domainKey);
  }
  amendment.pendingDomains = amendment.requiredDomains.filter(
    (d) => !amendment.coveredDomains.includes(d)
  );

  if (payload.proposedClauseText && String(payload.proposedClauseText).trim().length > 0) {
    amendment.proposedClauseText = sanitizeText(payload.proposedClauseText);
    amendment.clauseDiff = computeClauseDiff(
      amendment.originalClauseText,
      amendment.proposedClauseText
    );
  }

  if (payload.parameterChanges && typeof payload.parameterChanges === 'object') {
    const extraParams = sanitizeParameterChanges(payload.parameterChanges);
    amendment.parameterChanges = {
      ...amendment.parameterChanges,
      ...extraParams
    };
    const branch = findBranchOrTrunk(state, amendment.targetBranchId);
    const baseParams = branch.parameters || state.branches[0].parameters;
    const candidateParams = { ...baseParams, ...amendment.parameterChanges };
    amendment.impactDelta = computeImpactDelta(baseParams, candidateParams).deltas;
  }

  amendment.coAuthors.push({
    name: contributorName,
    role: contributorRole,
    contributedDomains: [domainKey],
    date: new Date().toISOString().slice(0, 10)
  });

  amendment.reviewComments.push({
    author: contributorName,
    role: contributorRole,
    domain: domainKey,
    text: analysisText,
    date: new Date().toISOString().slice(0, 10)
  });

  if (amendment.pendingDomains.length === 0) {
    amendment.maturityLevel = MATURITY_LEVELS.LEVEL_3_INTEGRATED_PR;
    amendment.status = 'lista_para_fusion';
  }

  return amendment;
}

export function mergeAmendment(state, amendmentId, reviewerNote = '') {
  const amendment = state.amendments.find((a) => a.id === amendmentId);
  if (!amendment) {
    throw new Error(`No se encontro la enmienda con identificador ${amendmentId}`);
  }
  if (amendment.status === 'fusionada') {
    throw new Error('La enmienda ya fue fusionada anteriormente');
  }
  if (amendment.pendingDomains.length > 0) {
    throw new Error(
      `No se puede fusionar la enmienda mientras existan dominios pendientes de co-autoria: ${amendment.pendingDomains.join(', ')}`
    );
  }

  const target = findBranchOrTrunk(state, amendment.targetBranchId);

  // Actualizar o anadir la clausula normativa modificada
  if (amendment.proposedClauseText && amendment.targetClauseId) {
    const existingClause = target.clauses.find((c) => c.id === amendment.targetClauseId);
    if (existingClause) {
      existingClause.text = amendment.proposedClauseText;
      existingClause.lastModifiedByAmendmentId = amendment.id;
    } else {
      target.clauses.push({
        id: amendment.targetClauseId,
        articleNumber: amendment.targetClauseId.toUpperCase(),
        title: amendment.title,
        text: amendment.proposedClauseText,
        lastModifiedByAmendmentId: amendment.id
      });
    }
  }

  // Si el destino es una rama con parametros propios, aplicar cambios parametricos
  if (target.parameters && amendment.parameterChanges) {
    target.parameters = {
      ...target.parameters,
      ...amendment.parameterChanges
    };
  }

  // Actualizar cobertura MAIN de la rama
  if (target.mainCoverage) {
    for (const domainKey of amendment.coveredDomains) {
      target.mainCoverage[domainKey] = true;
    }
  }

  // Marcar debilidades vinculadas como mitigadas
  for (const weaknessId of amendment.mitigatesWeaknessIds || []) {
    const weakness = state.weaknesses.find((w) => w.id === weaknessId);
    if (weakness) {
      weakness.status = 'mitigada';
      weakness.mitigatedByAmendmentId = amendment.id;
      weakness.resolutionNote =
        sanitizeText(reviewerNote) || `Mitigada mediante la fusion de: ${amendment.title}`;
    }
  }

  // Si provenia de una semilla, marcarla como consolidada
  if (amendment.sourceSeedId) {
    const seed = state.seeds.find((s) => s.id === amendment.sourceSeedId);
    if (seed) {
      seed.status = 'consolidada_en_plan';
    }
  }

  amendment.status = 'fusionada';
  amendment.maturityLevel = MATURITY_LEVELS.LEVEL_4_MERGED;
  amendment.mergedAt = new Date().toISOString().slice(0, 10);

  const commitEntry = {
    commitId: `rev-${Date.now().toString(36)}`,
    date: amendment.mergedAt,
    targetBranchId: amendment.targetBranchId,
    amendmentId: amendment.id,
    title: amendment.title,
    coAuthors: amendment.coAuthors.map((c) => c.name),
    mitigatedWeaknesses: amendment.mitigatesWeaknessIds
  };

  state.commitHistory.unshift(commitEntry);
  recomputeAllBranchMetrics(state);

  return {
    amendment,
    commitEntry,
    updatedTarget: target
  };
}

export function createWeaknessAudit(state, payload) {
  const title = requireNonEmptyString(
    payload.title,
    'El titulo de la debilidad o caso limite es obligatorio'
  );
  const description = requireNonEmptyString(
    payload.description,
    'La descripcion tecnica o empirica de la debilidad es obligatoria'
  );
  const severity = ['critica', 'alta', 'moderada'].includes(payload.severity)
    ? payload.severity
    : 'alta';
  const targetBranchId = sanitizeText(payload.targetBranchId || 'rama-media-jornada-bonificada');
  const targetClauseId = sanitizeText(payload.targetClauseId || 'art-37-6-et');
  const domain = POLICY_DOMAINS[payload.domain] ? payload.domain : 'laboral_pyme';
  const affectedGroup = sanitizeText(
    payload.affectedGroup || 'Colectivo o sector especifico'
  );
  const reportedBy = sanitizeText(payload.reportedBy || 'Auditor Ciudadano / Sectorial');

  const newWeakness = {
    id: `debilidad-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    description,
    severity,
    domain,
    targetBranchId,
    targetClauseId,
    affectedGroup,
    reportedBy,
    status: 'abierta',
    linkedAmendmentId: null,
    mitigatedByAmendmentId: null,
    createdAt: new Date().toISOString().slice(0, 10)
  };

  state.weaknesses.unshift(newWeakness);
  recomputeAllBranchMetrics(state);
  return newWeakness;
}

export function recomputeAllBranchMetrics(state) {
  for (const branch of state.branches) {
    branch.impact = simulatePlanImpact(branch.parameters);
    branch.readiness = calculateReadinessScore(branch, state.weaknesses);
  }
  return state;
}

function findBranchOrTrunk(state, targetId) {
  if (targetId === 'tronco-comun' || targetId === state.commonTrunk.id) {
    return state.commonTrunk;
  }
  const branch = state.branches.find((b) => b.id === targetId);
  if (!branch) {
    throw new Error(`No se encontro la rama o tronco con identificador ${targetId}`);
  }
  return branch;
}

function findClauseInTarget(target, clauseId) {
  if (!target || !Array.isArray(target.clauses)) {
    return null;
  }
  return target.clauses.find((c) => c.id === clauseId) || target.clauses[0] || null;
}

function sanitizeParameterChanges(rawChanges) {
  if (!rawChanges || typeof rawChanges !== 'object') {
    return {};
  }
  const allowedKeys = [
    'reductionPercent',
    'durationMonths',
    'salarySubsidyPercent',
    'smeReliefPercent',
    'selfEmployedFlatGrantEur',
    'teleworkSharePercent',
    'coResponsibilityBonusMonths',
    'monoparentalMultiplier',
    'ruralSmeExtraReliefPercent'
  ];
  const clean = {};
  for (const key of allowedKeys) {
    if (rawChanges[key] !== undefined && rawChanges[key] !== null && rawChanges[key] !== '') {
      const num = Number(rawChanges[key]);
      if (!Number.isNaN(num)) {
        clean[key] = num;
      }
    }
  }
  return clean;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .trim();
}

function requireNonEmptyString(value, errorMessage) {
  const clean = sanitizeText(value);
  if (!clean) {
    throw new Error(errorMessage);
  }
  return clean;
}
