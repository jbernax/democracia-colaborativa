/**
 * Suite de pruebas unitarias y de integración para la plataforma simplificada
 * de Democracia Colaborativa (Landing Multiproyecto, Creación de Planes, Monografías y Propuestas).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { simulatePlanImpact } from '../src/engine/impactSimulator.js';
import { computeClauseDiff } from '../src/engine/collaborationEngine.js';
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

test('Catálogo Multiproyecto: creación de planes, autor opcional, monografias y propuestas', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'democracia-store-test-'));
  const tmpStoreFile = path.join(tmpDir, 'test_projects.json');
  const store = new RepositoryStore(tmpStoreFile);

  const state = store.init();
  assert.ok(state.projects.length >= 3, 'Debe incluir al menos 3 planes pre-cargados');

  // Listar planes con filtros
  const allProjects = store.getProjects('all');
  assert.equal(allProjects.length, 3);
  assert.ok(allProjects.some((p) => p.id === 'reincorporacion-laboral-maternidad'));

  // Proponer un nuevo plan completo con autor opcional omitido
  const newProject = store.addProject({
    title: 'Plan Nacional de Climatización Pasiva y Arbolado Urbano',
    category: 'Vivienda y Transición Ecológica',
    summary: 'Plan para reducir la temperatura en entornos escolares y sanitarios.',
    initialContent: 'Las olas de calor intensifican el riesgo para colectivos vulnerables en verano.'
    // author omitido a proposito para verificar que es opcional
  });

  assert.ok(newProject.id.includes('plan-nacional-de-climatizacion'));
  assert.equal(newProject.author, 'Iniciativa Ciudadana');
  assert.ok(newProject.monograph.length >= 2);
  assert.equal(store.getProjects('all').length, 4);

  // Proponer un cambio de texto en una seccion con autor omitido (opcional)
  const newProposal = store.addProposal('reincorporacion-laboral-maternidad', {
    sectionId: 'articulado',
    title: 'Garantizar turno continuado para compatibilizar con escuelas infantiles',
    originalText: state.projects[0].monograph[1].content,
    proposedText: state.projects[0].monograph[1].content + '\n5. La reducción horaria se disfrutará de forma continuada.',
    reason: 'Evita turnos partidos que impiden la conciliación efectiva.'
    // author omitido
  });

  assert.ok(newProposal.id.startsWith('prop-'));
  assert.equal(newProposal.author, 'Ciudadano Colaborador');
  assert.equal(newProposal.diff.filter((d) => d.type === 'added').length, 1);

  // Segunda propuesta consecutiva acumulada sobre la misma seccion
  const secondProposal = store.addProposal('reincorporacion-laboral-maternidad', {
    sectionId: 'articulado',
    title: 'Añadir cláusula de incentivo para micropymes rurales',
    originalText: state.projects[0].monograph[1].content,
    proposedText: newProposal.proposedText + '\n6. En municipios de menos de 5.000 habitantes la bonificación será del 100%.',
    reason: 'Refuerzo de cobertura rural.'
  });

  const updatedPlan = store.getProject('reincorporacion-laboral-maternidad');
  const sectionProposals = updatedPlan.proposals.filter((p) => p.sectionId === 'articulado');
  assert.equal(sectionProposals.length, 4, 'Deben acumularse las 2 propuestas pre-cargadas más las 2 nuevas');
  assert.equal(secondProposal.diff.filter((d) => d.type === 'added').length, 2, 'El diff acumulado incluye ambas líneas añadidas');

  // Aportar una opinion con autor omitido (opcional)
  const newOpinion = store.addOpinion('reincorporacion-laboral-maternidad', {
    type: 'Alerta de debilidad',
    text: 'En hostelería el horario continuado requiere coordinación en convenios.'
    // author omitido
  });
  assert.ok(newOpinion.id.startsWith('op-'));
  assert.equal(newOpinion.author, 'Ciudadano Participante');

  // Registrar una nueva idea para un futuro plan con autor omitido (opcional)
  const newSeed = store.addSeed({
    title: 'Bancos de tiempo municipales',
    category: 'Servicios Sociales',
    description: 'Instalación de red de apoyo vecinal para cuidados.'
    // author omitido
  });
  assert.ok(newSeed.id.startsWith('idea-'));
  assert.equal(newSeed.author, 'Ciudadano Proponente');

  // Limpiar
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Servidor API REST: endpoints de catálogo, creación de plan, detalle, propuestas, opiniones e ideas', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'democracia-server-test-'));
  const tmpStoreFile = path.join(tmpDir, 'test_api.json');
  const store = new RepositoryStore(tmpStoreFile);
  const server = createAppServer(store);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/projects
    const listRes = await fetch(`${baseUrl}/api/projects?filter=all`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(Array.isArray(listData.projects));
    assert.ok(listData.projects.length >= 3);
    assert.ok(Array.isArray(listData.seeds));

    // 2. POST /api/projects - Crear un nuevo plan
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
    assert.ok(createProjectData.project.id);
    assert.equal(createProjectData.project.author, 'Iniciativa Ciudadana');

    // 3. GET /api/projects/:id
    const detailRes = await fetch(`${baseUrl}/api/projects/${createProjectData.project.id}`);
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();
    assert.equal(detailData.project.title, 'Estrategia de Reducción de la Jornada Laboral a 37.5 Horas');

    // 4. POST /api/projects/:id/proposals (sin autor obligatorio)
    const propRes = await fetch(`${baseUrl}/api/projects/${createProjectData.project.id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: 'diagnostico',
        title: 'Incluir referencia al diálogo social tripartito',
        originalText: detailData.project.monograph[0].content,
        proposedText: detailData.project.monograph[0].content + '\nTodo cambio debe concertarse con agentes sociales.',
        reason: 'Mayor consenso en negociación colectiva.'
      })
    });
    assert.equal(propRes.status, 201);
    const propData = await propRes.json();
    assert.ok(propData.proposal.id);
    assert.equal(propData.proposal.author, 'Ciudadano Colaborador');

    // 5. POST /api/projects/:id/opinions (sin autor obligatorio)
    const opRes = await fetch(`${baseUrl}/api/projects/${createProjectData.project.id}/opinions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'Aportación ciudadana',
        text: 'Apoyo la medida si se compensa en pymes con bonificaciones.'
      })
    });
    assert.equal(opRes.status, 201);

    // 6. POST /api/seeds (sin autor obligatorio)
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
    assert.ok(seedData.seed.id);
    assert.equal(seedData.seed.author, 'Ciudadano Proponente');

    // 7. Seguridad contra Path Traversal
    const traversalRes = await fetch(`${baseUrl}/..%2fpackage.json`);
    assert.ok([403, 404].includes(traversalRes.status));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
