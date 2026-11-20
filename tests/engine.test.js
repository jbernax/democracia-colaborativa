/**
 * Suite de pruebas unitarias y de integración para Democracia Colaborativa (Ágora Normativa):
 * Simulador MAIN, motor de colaboración 4 niveles, regresión de claves del piloto,
 * índice ICMN, RepositoryStore con escritura atómica y servidor HTTP REST.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { simulatePlanImpact } from '../src/engine/impactSimulator.js';
import {
  POLICY_DOMAINS,
  computeClauseDiff,
  createSeed,
  createAmendment,
  elaborateAmendment,
  mergeAmendment,
  createWeaknessAudit,
  calculateReadinessScore,
  calculatePlanIcmn
} from '../src/engine/collaborationEngine.js';
import { createInitialPilotState } from '../src/data/spainMaternityPilot.js';
import { RepositoryStore } from '../src/store/repositoryStore.js';
import { createAppServer } from '../src/server.js';

test('Simulador MAIN: calcula los 5 ejes de impacto con coherencia direccional para España', () => {
  const baseSim = simulatePlanImpact({
    reductionPercent: 50,
    durationMonths: 8,
    salarySubsidyPercent: 75,
    smeReliefPercent: 60,
    selfEmployedFlatGrantEur: 300,
    teleworkSharePercent: 20,
    coResponsibilityBonusMonths: 1,
    monoparentalMultiplier: 1.3
  });

  const enhancedSim = simulatePlanImpact({
    reductionPercent: 50,
    durationMonths: 8,
    salarySubsidyPercent: 90,
    smeReliefPercent: 90,
    selfEmployedFlatGrantEur: 850,
    teleworkSharePercent: 45,
    coResponsibilityBonusMonths: 3,
    monoparentalMultiplier: 1.8
  });

  assert.ok(baseSim.fiscal.netPublicCostMillionEur > 0);
  assert.ok(
    enhancedSim.laborSme.femaleRetentionGainPercent >
      baseSim.laborSme.femaleRetentionGainPercent,
    'Un mayor subsidio salarial debe incrementar la retención laboral femenina'
  );
  assert.ok(
    enhancedSim.laborSme.smeOrganizationalFrictionIndex <
      baseSim.laborSme.smeOrganizationalFrictionIndex,
    'Una mayor bonificación PYME y teletrabajo debe reducir el índice de fricción organizativa'
  );
});

test('computeClauseDiff: calcula correctamente adiciones y eliminaciones en textos de monografías', () => {
  const original = '1. La reducción será del 50 por ciento durante ocho meses.\n2. La Seguridad Social abonará el subsidio.';
  const proposed = '1. La reducción será del 50 por ciento durante diez meses.\n2. La Seguridad Social abonará el subsidio.\n3. Se priorizará la modalidad de teletrabajo.';

  const diff = computeClauseDiff(original, proposed);
  assert.ok(Array.isArray(diff));

  const removed = diff.filter((d) => d.type === 'removed');
  const added = diff.filter((d) => d.type === 'added');
  const unchanged = diff.filter((d) => d.type === 'unchanged');

  assert.equal(removed.length, 1);
  assert.ok(removed[0].text.includes('ocho meses'));
  assert.equal(added.length, 2);
  assert.ok(added.some((a) => a.text.includes('diez meses')));
  assert.ok(added.some((a) => a.text.includes('teletrabajo')));
  assert.equal(unchanged.length, 1);
});

test('Regresión de claves técnicas en spainMaternityPilot: detecta debilidades críticas y dominios válidos', () => {
  const pilot = createInitialPilotState();
  assert.equal(pilot.commonTrunk.id, 'tronco-comun');

  const openCriticalSum = pilot.branches.reduce(
    (sum, b) => sum + b.readiness.breakdown.openCriticalCount,
    0
  );
  assert.equal(openCriticalSum, 2, 'Rama A y Rama B deben registrar exactamente 2 debilidades críticas abiertas');

  for (const w of pilot.weaknesses) {
    assert.ok(POLICY_DOMAINS[w.domain], `Dominio de debilidad inválido: ${w.domain}`);
    assert.ok(['critica', 'alta', 'moderada'].includes(w.severity), `Severidad inválida: ${w.severity}`);
  }
  for (const a of pilot.amendments) {
    for (const d of [...a.requiredDomains, ...a.coveredDomains, ...a.pendingDomains]) {
      assert.ok(POLICY_DOMAINS[d], `Dominio inválido en enmienda ${a.id}: ${d}`);
    }
  }
});

test('collaborationEngine: ciclo completo de 4 niveles (semilla -> PR parcial -> co-autoría -> fusión y desbloqueo ICMN)', () => {
  const state = createInitialPilotState();
  const branchA = state.branches.find((b) => b.id === 'rama-media-jornada-bonificada');
  assert.equal(branchA.readiness.readyForLegislation, false);

  const seed = createSeed(state, {
    title: 'Garantía de turno continuado en horario escolar infantil',
    description: 'Evitar turnos partidos cuando la escuela infantil cierra a las 16:00.',
    authorName: 'Lucía M.',
    targetBranchId: branchA.id
  });
  assert.equal(seed.maturityLevel.level, 1);

  const amendment = createAmendment(state, {
    title: 'Enmienda de turno continuado escolar',
    summary: 'Garantiza concreción horaria continuada para el cuidado del lactante.',
    targetBranchId: branchA.id,
    targetClauseId: 'art-37-6-et',
    proposedClauseText: `${branchA.clauses[0].text}\n4. La reducción se ejercerá en turno continuado.`,
    requiredDomains: ['juridico', 'economico'],
    primaryDomain: 'juridico',
    primaryAnalysis: 'Conforme con el Art. 34.8 ET.',
    fromSeedId: seed.id,
    mitigatesWeaknessIds: ['deb-01']
  });
  assert.equal(amendment.maturityLevel.level, 2);
  assert.deepEqual(amendment.pendingDomains, ['economico']);

  // Fusión bloqueada mientras falte dominio económico
  assert.throws(() => mergeAmendment(state, amendment.id), /dominios pendientes/);

  elaborateAmendment(state, amendment.id, {
    contributorName: 'Economista Fiscal',
    domain: 'economico',
    analysisText: 'Impacto presupuestario neutro al mantener la misma masa de horas.'
  });
  assert.equal(amendment.maturityLevel.level, 3);

  const mergeRes = mergeAmendment(state, amendment.id, 'Aprobada en ponencia');
  assert.equal(mergeRes.amendment.maturityLevel.level, 4);
  assert.equal(seed.status, 'consolidada_en_plan');

  // Tras mitigar deb-01 (la única crítica de Rama A), Rama A queda desbloqueada
  const branchAAfter = state.branches.find((b) => b.id === 'rama-media-jornada-bonificada');
  assert.equal(branchAAfter.readiness.breakdown.openCriticalCount, 0);

  // Añadir nueva debilidad crítica vuelve a bloquear la rama
  createWeaknessAudit(state, {
    title: 'Fallo sobrevenido en microempresas',
    description: 'Ejemplo de bloqueo por nueva debilidad crítica.',
    severity: 'critica',
    domain: 'laboral_pyme',
    targetBranchId: branchA.id
  });
  const blocked = calculateReadinessScore(branchAAfter, state.weaknesses);
  assert.equal(blocked.readyForLegislation, false);
  assert.equal(blocked.breakdown.openCriticalCount, 1);
});

test('RepositoryStore: catálogo de 5 planes, slugs únicos, co-autoría, consolidación con puerta de calidad e ICMN', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'democracia-store-test-'));
  const tmpStoreFile = path.join(tmpDir, 'test_projects.json');
  const store = new RepositoryStore(tmpStoreFile);

  try {
    const state = store.init();
    assert.equal(state.projects.length, 5, 'Debe cargar los 5 planes modulares de data/catalog/plans');

    const allProjects = store.getProjects('all');
    assert.equal(allProjects.length, 5);
    assert.ok(allProjects.some((p) => p.id === 'reincorporacion-laboral-maternidad'));
    assert.ok(allProjects.some((p) => p.id === 'acceso-vivienda-alquiler-asequible'));
    assert.ok(allProjects.some((p) => p.id === 'transicion-energetica-autoconsumo-comunitario'));

    // Búsqueda sin tildes y filtrado por categoría
    const searchEnergy = store.getProjects({ q: 'autoconsumo energeticas' });
    assert.equal(searchEnergy.length, 1);
    assert.equal(searchEnergy[0].id, 'transicion-energetica-autoconsumo-comunitario');

    // Slugs únicos para títulos repetidos
    const firstPlan = store.addProject({
      title: 'Plan de Climatización Escolar',
      category: 'Vivienda y Urbanismo',
      summary: 'Primera propuesta de climatización pasiva en colegios.',
      initialContent: 'Las aulas sufren temperaturas extremas en mayo y junio.'
    });
    const secondPlan = store.addProject({
      title: 'Plan de Climatización Escolar',
      category: 'Vivienda y Urbanismo',
      summary: 'Segunda propuesta homónima con enfoque distinto.',
      initialContent: 'Prioriza cubiertas vegetales y sombreamiento exterior.'
    });
    assert.equal(firstPlan.id, 'plan-de-climatizacion-escolar');
    assert.equal(secondPlan.id, 'plan-de-climatizacion-escolar-2');
    assert.equal(firstPlan.author, 'Iniciativa Ciudadana');

    // Ciclo de co-autoría y consolidación en RepositoryStore
    const matPlan = store.getProject('reincorporacion-laboral-maternidad');
    assert.equal(matPlan.proposals.length, 3);
    assert.ok(typeof matPlan.icmn.totalScore === 'number');

    // No se puede consolidar prop-1 mientras falte el dominio jurídico
    assert.throws(
      () => store.consolidateProposal('reincorporacion-laboral-maternidad', 'prop-1'),
      /dominios pendientes/
    );

    // Completar co-autoría de prop-1 y consolidar
    const elaborated = store.elaborateProposal('reincorporacion-laboral-maternidad', 'prop-1', {
      domain: 'juridico',
      contributorName: 'Jurista Laboral',
      contributorRole: 'Especialista Estatuto Trabajadores',
      analysisText: 'Compatible con el Art. 37.7 ET mediante acuerdo colectivo.'
    });
    assert.equal(elaborated.status, 'Lista para consolidación');

    const consolidated = store.consolidateProposal(
      'reincorporacion-laboral-maternidad',
      'prop-1',
      'Fusión validada'
    );
    assert.equal(consolidated.proposal.status, 'Consolidada');
    const updatedMat = store.getProject('reincorporacion-laboral-maternidad');
    assert.ok(updatedMat.monograph[1].content.includes('jornadas completas alternas'));
    const deb03 = updatedMat.weaknesses.find((w) => w.id === 'deb-03');
    assert.equal(deb03.status, 'mitigada');

    // Apoyo a idea y escritura atómica
    const seed = store.addSeed({
      title: 'Bancos de tiempo municipales',
      category: 'Servicios Sociales',
      description: 'Instalación de red de apoyo vecinal para cuidados.'
    });
    const endorsed = store.endorseSeed(seed.id);
    assert.equal(endorsed.votes, 2);

    // Calcular ICMN en plan sin pilotModel
    const nonParamIcmn = calculatePlanIcmn(store.getProject('simplificacion-pymes-autonomos'));
    assert.ok(nonParamIcmn.totalScore >= 0 && nonParamIcmn.totalScore <= 100);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Servidor API REST: endpoints completos, seguridad HTTP, límite 413 y protección de /api/reset', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'democracia-server-test-'));
  const tmpStoreFile = path.join(tmpDir, 'test_api.json');
  const store = new RepositoryStore(tmpStoreFile);
  const server = createAppServer(store);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/projects con filtro de búsqueda
    const listRes = await fetch(`${baseUrl}/api/projects?q=vivienda`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.headers.get('x-content-type-options'), 'nosniff');
    const listData = await listRes.json();
    assert.equal(listData.projects.length, 1);
    assert.equal(listData.projects[0].id, 'acceso-vivienda-alquiler-asequible');

    // 2. POST /api/projects
    const createProjectRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Estrategia de Reducción de la Jornada Laboral a 37.5 Horas',
        category: 'Empleo',
        summary: 'Reducción general de la duración máxima legal de la jornada ordinaria de trabajo.',
        initialContent: 'El tope legal de 40 horas semanales data de 1983 sin adaptación a la productividad moderna.'
      })
    });
    assert.equal(createProjectRes.status, 201);
    const createProjectData = await createProjectRes.json();
    const newId = createProjectData.project.id;

    // 3. POST /api/projects/:id/proposals + coauthor + consolidate
    const detailRes = await fetch(`${baseUrl}/api/projects/${newId}`);
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();

    const propRes = await fetch(`${baseUrl}/api/projects/${newId}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: 'diagnostico',
        title: 'Incluir referencia al diálogo social tripartito',
        originalText: detailData.project.monograph[0].content,
        proposedText: `${detailData.project.monograph[0].content}\nTodo cambio debe concertarse con agentes sociales.`,
        requiredDomains: ['juridico', 'laboral_pyme'],
        primaryDomain: 'juridico',
        primaryAnalysis: 'Alinea el procedimiento con el diálogo social.'
      })
    });
    assert.equal(propRes.status, 201);
    const propData = await propRes.json();

    const coauthRes = await fetch(
      `${baseUrl}/api/projects/${newId}/proposals/${propData.proposal.id}/coauthor`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'laboral_pyme',
          contributorName: 'CEPYME Análisis',
          analysisText: 'Periodo transitorio de 12 meses para micropymes.'
        })
      }
    );
    assert.equal(coauthRes.status, 200);

    const consRes = await fetch(
      `${baseUrl}/api/projects/${newId}/proposals/${propData.proposal.id}/consolidate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }
    );
    assert.equal(consRes.status, 200);

    // 4. POST /api/projects/:id/weaknesses y opiniones
    const weakRes = await fetch(`${baseUrl}/api/projects/${newId}/weaknesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: 'diagnostico',
        severity: 'alta',
        domain: 'laboral_pyme',
        title: 'Desajuste en turnos continuos de hostelería',
        description: 'Requiere bolsa flexible anual en campañas estacionales.'
      })
    });
    assert.equal(weakRes.status, 201);

    const opRes = await fetch(`${baseUrl}/api/projects/${newId}/opinions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'Aportación ciudadana',
        sectionId: 'diagnostico',
        text: 'Apoyo la medida si se compensa en pymes con bonificaciones.'
      })
    });
    assert.equal(opRes.status, 201);

    // 5. GET y POST /api/seeds + endorse
    const seedsListRes = await fetch(`${baseUrl}/api/seeds`);
    assert.equal(seedsListRes.status, 200);

    const seedRes = await fetch(`${baseUrl}/api/seeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Plan de choque contra la soledad no deseada en zonas urbanas',
        category: 'Servicios Sociales',
        description: 'Red comunitaria de acompañamiento telefónico y domiciliario.'
      })
    });
    assert.equal(seedRes.status, 201);
    const seedData = await seedRes.json();

    const endorseRes = await fetch(`${baseUrl}/api/seeds/${seedData.seed.id}/endorse`, {
      method: 'POST'
    });
    assert.equal(endorseRes.status, 200);
    const endorseData = await endorseRes.json();
    assert.equal(endorseData.seed.votes, 2);

    // 6. Seguridad: /api/reset bloqueado por defecto, 413 en cargas > 1 MiB, 405 estático y Path Traversal
    const resetRes = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 403);

    const hugePayload = JSON.stringify({ title: 'X'.repeat(1_200_000) });
    const hugeRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hugePayload
    });
    assert.equal(hugeRes.status, 413);

    const badMethodStatic = await fetch(`${baseUrl}/index.html`, { method: 'POST' });
    assert.equal(badMethodStatic.status, 405);

    const htmlStatic = await fetch(`${baseUrl}/index.html`);
    assert.equal(htmlStatic.status, 200);
    assert.equal(htmlStatic.headers.get('cache-control'), 'no-cache');

    const jsStatic = await fetch(`${baseUrl}/app.js`);
    assert.equal(jsStatic.status, 200);
    assert.equal(jsStatic.headers.get('cache-control'), 'no-cache');

    const traversalRes = await fetch(`${baseUrl}/..%2fpackage.json`);
    assert.ok([403, 404].includes(traversalRes.status));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
