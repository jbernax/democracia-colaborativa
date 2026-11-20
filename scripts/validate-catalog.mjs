/**
 * Validador de integridad estructural del catálogo modular en data/catalog/.
 * Verifica esquemas, claves ASCII, coherencia de secciones, ausencia de truncamiento
 * en propuestas y validez del modelo paramétrico MAIN.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLICY_DOMAINS } from '../public/shared/collaborationEngine.js';
import { createInitialProjectsCatalog } from '../src/data/projectsData.js';

const VALID_SEVERITIES = new Set(['critica', 'alta', 'moderada']);
const VALID_WEAKNESS_STATUSES = new Set(['abierta', 'en_mitigacion', 'mitigada']);
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object') {
    return { valid: false, errors: ['El catálogo debe ser un objeto válido.'] };
  }

  const projects = Array.isArray(catalog.projects) ? catalog.projects : [];
  const seeds = Array.isArray(catalog.seeds) ? catalog.seeds : [];

  if (projects.length === 0) {
    errors.push('El catálogo debe incluir al menos un plan.');
  }

  const seenPlanIds = new Set();
  const seenPlanCodes = new Set();

  for (const plan of projects) {
    const prefix = `[Plan ${plan.id || plan.title || 'desconocido'}]`;

    if (!plan.id || !SLUG_PATTERN.test(plan.id)) {
      errors.push(`${prefix} El id debe cumplir /^[a-z0-9-]+$/ (recibido: "${plan.id}").`);
    } else if (seenPlanIds.has(plan.id)) {
      errors.push(`${prefix} El id está duplicado.`);
    } else {
      seenPlanIds.add(plan.id);
    }

    if (!plan.code || typeof plan.code !== 'string') {
      errors.push(`${prefix} El código de expediente es obligatorio.`);
    } else if (seenPlanCodes.has(plan.code)) {
      errors.push(`${prefix} El código ${plan.code} está duplicado.`);
    } else {
      seenPlanCodes.add(plan.code);
    }

    for (const field of ['title', 'category', 'stage', 'summary']) {
      if (!plan[field] || !String(plan[field]).trim()) {
        errors.push(`${prefix} El campo obligatorio "${field}" está vacío.`);
      }
    }

    const sections = Array.isArray(plan.monograph) ? plan.monograph : [];
    if (sections.length < 2) {
      errors.push(`${prefix} La monografía debe contener al menos 2 secciones.`);
    }

    const sectionMap = new Map();
    for (const sec of sections) {
      if (!sec.id || !SLUG_PATTERN.test(sec.id)) {
        errors.push(`${prefix} Sección con id inválido: "${sec.id}".`);
      } else if (sectionMap.has(sec.id)) {
        errors.push(`${prefix} Sección duplicada: "${sec.id}".`);
      } else {
        sectionMap.set(sec.id, sec);
      }
      if (!sec.title || !String(sec.content || '').trim()) {
        errors.push(`${prefix} La sección "${sec.id}" debe tener título y contenido.`);
      }
    }

    const seenPropIds = new Set();
    for (const prop of plan.proposals || []) {
      const pPrefix = `${prefix}[Propuesta ${prop.id}]`;
      if (!prop.id || seenPropIds.has(prop.id)) {
        errors.push(`${pPrefix} Identificador ausente o duplicado.`);
      } else {
        seenPropIds.add(prop.id);
      }

      const targetSection = sectionMap.get(prop.sectionId);
      if (!targetSection) {
        errors.push(`${pPrefix} Referencia a sección inexistente "${prop.sectionId}".`);
      } else {
        const origText = String(prop.originalText || '').trim();
        const propText = String(prop.proposedText || '').trim();
        const sectionText = String(targetSection.content || '').trim();
        const isConsolidated =
          prop.status === 'Consolidada' || prop.maturityLevel?.level === 4;

        if (!isConsolidated && origText && origText !== sectionText && !prop.allowPartialSection) {
          errors.push(
            `${pPrefix} originalText no coincide con el texto completo de la sección "${prop.sectionId}" (posible truncamiento).`
          );
        }
        if (origText && propText.length < origText.length * 0.5 && !prop.allowPartialSection) {
          errors.push(
            `${pPrefix} proposedText es inferior al 50% de originalText (posible pérdida de apartados).`
          );
        }
      }

      for (const listName of ['requiredDomains', 'coveredDomains', 'pendingDomains']) {
        for (const domainKey of prop[listName] || []) {
          if (!POLICY_DOMAINS[domainKey]) {
            errors.push(`${pPrefix} Dominio inválido "${domainKey}" en ${listName}.`);
          }
        }
      }
    }

    const seenWeaknessIds = new Set();
    for (const weakness of plan.weaknesses || []) {
      const wPrefix = `${prefix}[Debilidad ${weakness.id}]`;
      if (!weakness.id || seenWeaknessIds.has(weakness.id)) {
        errors.push(`${wPrefix} Identificador ausente o duplicado.`);
      } else {
        seenWeaknessIds.add(weakness.id);
      }
      if (!VALID_SEVERITIES.has(weakness.severity)) {
        errors.push(`${wPrefix} Severidad inválida "${weakness.severity}".`);
      }
      if (!POLICY_DOMAINS[weakness.domain]) {
        errors.push(`${wPrefix} Dominio MAIN inválido "${weakness.domain}".`);
      }
      if (!VALID_WEAKNESS_STATUSES.has(weakness.status)) {
        errors.push(`${wPrefix} Estado de debilidad inválido "${weakness.status}".`);
      }
      if (!sectionMap.has(weakness.sectionId)) {
        errors.push(`${wPrefix} Referencia a sección inexistente "${weakness.sectionId}".`);
      }
    }

    if (plan.pilotModel) {
      const pmPrefix = `${prefix}[pilotModel]`;
      if (plan.pilotModel.commonTrunk?.id !== 'tronco-comun') {
        errors.push(`${pmPrefix} commonTrunk.id debe ser "tronco-comun".`);
      }
      for (const branch of plan.pilotModel.branches || []) {
        if (!branch.id || !SLUG_PATTERN.test(branch.id)) {
          errors.push(`${pmPrefix} Rama con id inválido: "${branch.id}".`);
        }
        if (!branch.parameters || typeof branch.parameters !== 'object') {
          errors.push(`${pmPrefix} Rama "${branch.id}" sin parámetros numéricos.`);
        }
      }
    }
  }

  const seenSeedIds = new Set();
  for (const seed of seeds) {
    const sPrefix = `[Idea ${seed.id}]`;
    if (!seed.id || seenSeedIds.has(seed.id)) {
      errors.push(`${sPrefix} Identificador ausente o duplicado.`);
    } else {
      seenSeedIds.add(seed.id);
    }
    if (!seed.title || !String(seed.title).trim()) {
      errors.push(`${sPrefix} El título es obligatorio.`);
    }
    if (!seed.description || !String(seed.description).trim()) {
      errors.push(`${sPrefix} La descripción es obligatoria.`);
    }
    if (typeof seed.votes !== 'number' || seed.votes < 0) {
      errors.push(`${sPrefix} votes debe ser un número >= 0.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      projectsCount: projects.length,
      seedsCount: seeds.length
    }
  };
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const catalog = createInitialProjectsCatalog();
  const result = validateCatalog(catalog);
  if (!result.valid) {
    console.error('Errores de validación en el catálogo:');
    for (const err of result.errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }
  console.log(
    `Catálogo válido: ${result.stats.projectsCount} planes y ${result.stats.seedsCount} ideas verificadas.`
  );
}
