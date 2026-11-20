/**
 * Motor de Colaboración Normativa Progresiva ("Git para Políticas Públicas")
 * Gestiona Semillas ("Pendientes de Elaborar"), Enmiendas de Dominio (PRs parciales),
 * Co-autoría multidisciplinar, Auditorías de Debilidad (Stress Tests), Diffs normativos
 * e Índice de Calidad y Madurez Normativa (ICMN).
 * Isomórfico: sin dependencias de Node, ejecutable directamente en navegador y servidor.
 */

import { computeClauseDiff } from './textDiff.js';
import { simulatePlanImpact, computeImpactDelta } from './impactSimulator.js';

export { computeClauseDiff };

export const POLICY_DOMAINS = Object.freeze({
  juridico: {
    id: 'juridico',
    label: 'Encaje legal',
    description: 'Redacción de artículos, respeto a la Constitución y leyes europeas'
  },
  economico: {
    id: 'economico',
    label: 'Coste y presupuesto',
    description: 'Gasto público, retorno fiscal y sostenibilidad'
  },
  laboral_pyme: {
    id: 'laboral_pyme',
    label: 'Empleo, pymes y autónomos',
    description: 'Cómo afecta al trabajo diario en pequeñas empresas y autónomos (RETA)'
  },
  social_igualdad: {
    id: 'social_igualdad',
    label: 'Social e igualdad',
    description: 'Impacto en familias, igualdad y personas vulnerables'
  },
  ambiental_territorial: {
    id: 'ambiental_territorial',
    label: 'Clima y medio rural',
    description: 'Ahorro de emisiones, transporte y viabilidad en pueblos pequeños'
  }
});

export const MATURITY_LEVELS = Object.freeze({
  LEVEL_1_SEED: {
    code: 'nivel_1_semilla',
    level: 1,
    label: 'Nivel 1: Idea inicial'
  },
  LEVEL_2_SCOPED_PR: {
    code: 'nivel_2_enmienda_dominio',
    level: 2,
    label: 'Nivel 2: Falta revisar áreas'
  },
  LEVEL_3_INTEGRATED_PR: {
    code: 'nivel_3_enmienda_integrada',
    level: 3,
    label: 'Nivel 3: Lista para incorporar'
  },
  LEVEL_4_MERGED: {
    code: 'nivel_4_consolidada',
    level: 4,
    label: 'Nivel 4: Incorporada al texto'
  }
});

export function evaluateStakeholderSatisfaction(impact, branchWeaknesses = []) {
  const openCriticalCount = branchWeaknesses.filter(
    (w) => w.status !== 'mitigada' && w.severity === 'critica'
  ).length;
  const penalty = openCriticalCount * 8;

  // 1. Sindicatos y Representación Sindical
  const unionsScore = clampScore(
    impact.parameters.salarySubsidyPercent * 0.55 +
      impact.laborSme.femaleRetentionGainPercent * 2.2 +
      impact.socialEquality.coResponsibilityIndex * 0.25 -
      penalty
  );

  // 2. Asociaciones de PYMEs y Autónomos (CEPYME / ATA)
  const smeRetaScore = clampScore(
    (100 - impact.laborSme.smeOrganizationalFrictionIndex) * 0.55 +
      impact.laborSme.retaEffectiveCoveragePercent * 0.45 -
      penalty
  );

  // 3. Evaluación Presupuestaria y Hacienda (Estilo AIReF)
  const netCostRatio = Math.max(0, 100 - (impact.fiscal.netPublicCostMillionEur / 28));
  const fiscalScore = clampScore(
    netCostRatio * 0.65 +
      (impact.fiscal.inducedFiscalReturnMillionEur /
        Math.max(1, impact.fiscal.grossPublicCostMillionEur)) *
        100 *
        0.35 -
      penalty * 0.5
  );

  // 4. Colectivos de Familias, Infancia e Igualdad
  const familiesEqualityScore = clampScore(
    Math.min(100, impact.socialEquality.additionalCareHoursPerInfant / 7.5) * 0.4 +
      impact.socialEquality.monoparentalEquityScore * 0.3 +
      impact.socialEquality.householdIncomePreservationPercent * 0.3 -
      penalty
  );

  // 5. Municipio Rural y Transición Ecológica
  const territorialEcoScore = clampScore(
    impact.environmentalTerritorial.ruralViabilityIndex * 0.65 +
      Math.min(100, impact.environmentalTerritorial.avoidedCo2KilotonnesPerYear * 1.4) * 0.35 -
      penalty
  );

  const scores = [
    {
      stakeholderId: 'sindicatos_trabajadores',
      label: 'Sindicatos y personas trabajadoras',
      score: unionsScore,
      minimumThreshold: 68
    },
    {
      stakeholderId: 'pymes_autonomos',
      label: 'Pymes y autónomos (RETA)',
      score: smeRetaScore,
      minimumThreshold: 65
    },
    {
      stakeholderId: 'evaluacion_fiscal_airef',
      label: 'Sostenibilidad de las cuentas públicas',
      score: fiscalScore,
      minimumThreshold: 62
    },
    {
      stakeholderId: 'familias_igualdad',
      label: 'Familias, infancia e igualdad',
      score: familiesEqualityScore,
      minimumThreshold: 72
    },
    {
      stakeholderId: 'mundo_rural_ecologia',
      label: 'Pueblos y movilidad limpia',
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
    (w) => !w.targetBranchId || w.targetBranchId === branch.id || w.targetBranchId === 'all'
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

  // 2. Solidez frente a Auditoría de Debilidades (30%)
  const rawAuditScore =
    100 - openCriticalCount * 25 - openHighCount * 12 - openModerateCount * 5;
  const weaknessAuditScore = clampScore(rawAuditScore);

  // 3. Puente de Consenso Transversal (20%)
  const impact = branch.impact || simulatePlanImpact(branch.parameters);
  const bridging = evaluateStakeholderSatisfaction(impact, branchWeaknesses);
  const consensusBridgeScore = bridging.consensusBridgeScore;

  // 4. Precisión Jurídica y Operativa (20%)
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
  let statusLabel = 'En borrador y revisión abierta';
  if (readyForLegislation) {
    statusLabel = 'Listo para tramitar (ICMN >= 80 y 0 fallos críticos)';
  } else if (openCriticalCount > 0) {
    statusLabel = `Bloqueado por ${openCriticalCount} ${
      openCriticalCount === 1 ? 'fallo crítico sin resolver' : 'fallos críticos sin resolver'
    }`;
  } else if (totalScore >= 70) {
    statusLabel = 'Avanzado (faltan acuerdos o análisis pendientes)';
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

/**
 * Calcula el Índice de Calidad y Madurez Normativa (ICMN 0-100) auditable para
 * cualquier plan del catálogo, combinando cobertura MAIN, auditoría de debilidades,
 * consenso transversal y precisión del texto articulado.
 */
export function calculatePlanIcmn(project = {}) {
  const domainKeys = Object.keys(POLICY_DOMAINS);
  const effectiveCoverage = { ...(project.mainCoverage || {}) };

  const proposals = Array.isArray(project.proposals) ? project.proposals : [];
  for (const prop of proposals) {
    const isConsolidated =
      prop.status === 'Consolidada' || prop.maturityLevel?.level === 4;
    if (isConsolidated && Array.isArray(prop.coveredDomains)) {
      for (const domainKey of prop.coveredDomains) {
        if (POLICY_DOMAINS[domainKey]) {
          effectiveCoverage[domainKey] = true;
        }
      }
    }
  }

  // 1. Completitud MAIN (30%)
  const coveredAxesCount = domainKeys.filter((key) => Boolean(effectiveCoverage[key])).length;
  const mainCoverageScore = Math.round((coveredAxesCount / domainKeys.length) * 100);

  // 2. Auditoría de Debilidades (30%)
  const weaknesses = Array.isArray(project.weaknesses) ? project.weaknesses : [];
  const openWeaknesses = weaknesses.filter((w) => w.status !== 'mitigada');
  const openCriticalCount = openWeaknesses.filter((w) => w.severity === 'critica').length;
  const openHighCount = openWeaknesses.filter((w) => w.severity === 'alta').length;
  const openModerateCount = openWeaknesses.filter((w) => w.severity === 'moderada').length;
  const mitigatedCount = weaknesses.length - openWeaknesses.length;

  const weaknessAuditScore = clampScore(
    100 - openCriticalCount * 25 - openHighCount * 12 - openModerateCount * 5
  );

  // 3. Puente de Consenso Transversal (20%)
  let consensusBridgeScore = 50;
  const branches = project.pilotModel?.branches;
  if (Array.isArray(branches) && branches.length > 0) {
    const branchScores = branches.map((branch) => {
      const readiness = calculateReadinessScore(
        {
          ...branch,
          impact: branch.impact || simulatePlanImpact(branch.parameters)
        },
        weaknesses
      );
      return readiness.stakeholderBridging.consensusBridgeScore;
    });
    consensusBridgeScore = Math.max(...branchScores);
  } else {
    const contributors = new Set();
    if (project.author) contributors.add(project.author);
    for (const prop of proposals) {
      if (prop.author) contributors.add(prop.author);
      if (Array.isArray(prop.coAuthors)) {
        for (const co of prop.coAuthors) {
          if (co?.name) contributors.add(co.name);
        }
      }
    }
    for (const op of project.opinions || []) {
      if (op.author) contributors.add(op.author);
    }
    for (const w of weaknesses) {
      if (w.reportedBy) contributors.add(w.reportedBy);
    }
    for (const c of project.commitHistory || []) {
      for (const name of c.coAuthors || []) {
        if (name) contributors.add(name);
      }
    }

    const totalWeaknesses = weaknesses.length;
    const mitigationPoints =
      totalWeaknesses > 0 ? Math.round((mitigatedCount / totalWeaknesses) * 20) : 10;
    const rawConsensus =
      40 +
      Math.min(35, contributors.size * 7) +
      mitigationPoints -
      openCriticalCount * 8;
    consensusBridgeScore = Math.max(40, Math.min(95, Math.round(rawConsensus)));
  }

  // 4. Precisión Jurídica y Operativa (20%)
  const monograph = Array.isArray(project.monograph) ? project.monograph : [];
  const substantiveSections = monograph.filter(
    (sec) => String(sec.content || '').trim().length >= 120
  ).length;
  const hasArticuladoSection = monograph.some((sec) => {
    const idAndTitle = `${sec.id || ''} ${sec.title || ''}`.toLowerCase();
    return idAndTitle.includes('articulado') || idAndTitle.includes('medidas');
  });
  const consolidatedCount = proposals.filter(
    (p) => p.status === 'Consolidada' || p.maturityLevel?.level === 4
  ).length;
  const commitsCount = Array.isArray(project.commitHistory) ? project.commitHistory.length : 0;

  const legalPrecisionScore = clampScore(
    Math.min(60, substantiveSections * 15) +
      (hasArticuladoSection ? 20 : 0) +
      Math.min(20, consolidatedCount * 10 + Math.max(0, commitsCount - 1) * 5)
  );

  const totalScore = Math.round(
    0.3 * mainCoverageScore +
      0.3 * weaknessAuditScore +
      0.2 * consensusBridgeScore +
      0.2 * legalPrecisionScore
  );

  const readyForLegislation = totalScore >= 80 && openCriticalCount === 0;
  let statusLabel = 'En borrador y revisión abierta';
  if (readyForLegislation) {
    statusLabel = 'Listo para tramitar';
  } else if (openCriticalCount > 0) {
    statusLabel = `Bloqueado por ${openCriticalCount} ${
      openCriticalCount === 1 ? 'fallo crítico' : 'fallos críticos'
    }`;
  } else if (totalScore >= 70) {
    statusLabel = 'Avanzado';
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
      openModerateCount,
      mitigatedCount
    }
  };
}

export function inferNeededDomainsFromText(text = '', preferredDomains = []) {
  if (Array.isArray(preferredDomains) && preferredDomains.length > 0) {
    return preferredDomains.filter((d) => Boolean(POLICY_DOMAINS[d]));
  }

  const lower = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const inferred = new Set();

  if (
    lower.includes('estatuto') ||
    lower.includes('art.') ||
    lower.includes('articulo') ||
    lower.includes('ley') ||
    lower.includes('despido') ||
    lower.includes('monoparental') ||
    lower.includes('decreto') ||
    lower.includes('juridic')
  ) {
    inferred.add('juridico');
  }
  if (
    lower.includes('coste') ||
    lower.includes('presupuesto') ||
    lower.includes('cotizacion') ||
    lower.includes('seguridad social') ||
    lower.includes('bonificacion') ||
    lower.includes('irpf') ||
    lower.includes('fiscal') ||
    lower.includes('deduccion')
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
    lower.includes('brecha') ||
    lower.includes('vivienda') ||
    lower.includes('alquiler')
  ) {
    inferred.add('social_igualdad');
  }
  if (
    lower.includes('rural') ||
    lower.includes('pueblo') ||
    lower.includes('desplazamiento') ||
    lower.includes('transporte') ||
    lower.includes('teletrabajo') ||
    lower.includes('emisiones') ||
    lower.includes('energia') ||
    lower.includes('autoconsumo') ||
    lower.includes('solar')
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
  const title = requireNonEmptyString(payload.title, 'El título de la idea es obligatorio');
  const description = requireNonEmptyString(
    payload.description,
    'La descripción de la idea es obligatoria'
  );
  const authorName = sanitizeText(payload.authorName || 'Ciudadano Participante');
  const authorProfile = sanitizeText(payload.authorProfile || 'Ciudadanía / Experiencia Directa');
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
  const title = requireNonEmptyString(payload.title, 'El título de la enmienda es obligatorio');
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

  const requiredDomains =
    Array.isArray(payload.requiredDomains) && payload.requiredDomains.length > 0
      ? payload.requiredDomains.filter((d) => Boolean(POLICY_DOMAINS[d]))
      : ['juridico', 'economico', 'laboral_pyme'];

  const rawDomainAnalyses = payload.domainAnalyses || {};
  const domainAnalyses = {};
  for (const [key, val] of Object.entries(rawDomainAnalyses)) {
    if (POLICY_DOMAINS[key] && val && String(val).trim().length > 0) {
      domainAnalyses[key] = sanitizeText(val);
    }
  }

  if (payload.primaryDomain && POLICY_DOMAINS[payload.primaryDomain] && payload.primaryAnalysis) {
    domainAnalyses[payload.primaryDomain] = sanitizeText(payload.primaryAnalysis);
  }

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
    throw new Error(`No se encontró la enmienda con identificador ${amendmentId}`);
  }
  if (amendment.status === 'fusionada') {
    throw new Error('La enmienda ya ha sido fusionada en el expediente');
  }

  const contributorName = requireNonEmptyString(
    payload.contributorName,
    'Escribe tu nombre o el de tu equipo'
  );
  const contributorRole = sanitizeText(
    payload.contributorRole || 'Especialista colaborador'
  );
  const domainKey = requireNonEmptyString(
    payload.domain,
    'Elige el área que estás completando'
  );

  if (!POLICY_DOMAINS[domainKey]) {
    throw new Error(`El área ${domainKey} no es válida`);
  }

  const analysisText = requireNonEmptyString(
    payload.analysisText,
    'Añade el análisis para esta área'
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
    throw new Error(`No se encontró la enmienda con identificador ${amendmentId}`);
  }
  if (amendment.status === 'fusionada') {
    throw new Error('La enmienda ya fue fusionada anteriormente');
  }
  if (amendment.pendingDomains.length > 0) {
    throw new Error(
      `No se puede fusionar la enmienda mientras existan dominios pendientes de co-autoría: ${amendment.pendingDomains.join(', ')}`
    );
  }

  const target = findBranchOrTrunk(state, amendment.targetBranchId);

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

  if (target.parameters && amendment.parameterChanges) {
    target.parameters = {
      ...target.parameters,
      ...amendment.parameterChanges
    };
  }

  if (target.mainCoverage) {
    for (const domainKey of amendment.coveredDomains) {
      target.mainCoverage[domainKey] = true;
    }
  }

  for (const weaknessId of amendment.mitigatesWeaknessIds || []) {
    const weakness = state.weaknesses.find((w) => w.id === weaknessId);
    if (weakness) {
      weakness.status = 'mitigada';
      weakness.mitigatedByAmendmentId = amendment.id;
      weakness.resolutionNote =
        sanitizeText(reviewerNote) || `Mitigada mediante la fusión de: ${amendment.title}`;
    }
  }

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
    'El título de la debilidad o caso límite es obligatorio'
  );
  const description = requireNonEmptyString(
    payload.description,
    'La descripción técnica o empírica de la debilidad es obligatoria'
  );
  const severity = ['critica', 'alta', 'moderada'].includes(payload.severity)
    ? payload.severity
    : 'alta';
  const targetBranchId = sanitizeText(payload.targetBranchId || 'rama-media-jornada-bonificada');
  const targetClauseId = sanitizeText(payload.targetClauseId || 'art-37-6-et');
  const domain = POLICY_DOMAINS[payload.domain] ? payload.domain : 'laboral_pyme';
  const affectedGroup = sanitizeText(
    payload.affectedGroup || 'Colectivo o sector específico'
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
    throw new Error(`No se encontró la rama o tronco con identificador ${targetId}`);
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
