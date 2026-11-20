import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInitialProjectsCatalog } from '../src/data/projectsData.js';
import { buildPagesBundle } from '../scripts/build-pages.mjs';
import {
  requestStaticApi,
  hasLocalDraftChanges,
  clearLocalDrafts,
  isStaticHost
} from '../public/staticStore.js';
import {
  buildGitHubIssueSubmission,
  exportProjectAsMarkdown,
  exportProjectAsJson
} from '../public/shared/githubBridge.js';

function createBrowserMock(catalog, hostname = 'jbernax.github.io') {
  const storageMap = new Map();
  const localStorage = {
    getItem(key) {
      return storageMap.has(key) ? storageMap.get(key) : null;
    },
    setItem(key, value) {
      storageMap.set(key, String(value));
    },
    removeItem(key) {
      storageMap.delete(key);
    },
    clear() {
      storageMap.clear();
    }
  };

  globalThis.window = {
    localStorage,
    location: {
      protocol: 'https:',
      hostname,
      origin: `https://${hostname}`
    }
  };

  globalThis.fetch = async (url) => {
    if (url === 'catalog.json') {
      return {
        ok: true,
        async json() {
          return structuredClone(catalog);
        }
      };
    }
    return { ok: false, status: 404 };
  };
}

test('staticStore: paridad completa de búsqueda, apoyo de ideas, co-autoría, consolidación y borrador local', async () => {
  const catalog = createInitialProjectsCatalog();
  createBrowserMock(catalog);

  try {
    assert.equal(isStaticHost(), true);
    assert.equal(hasLocalDraftChanges(), false);

    // 1. Listado inicial, búsqueda sin tildes y categorías
    const allRes = await requestStaticApi('/api/projects?filter=all');
    assert.equal(allRes.projects.length, 5);
    assert.ok(allRes.categories.includes('Vivienda y Urbanismo'));

    const searchRes = await requestStaticApi('/api/projects?q=transicion+energetica');
    assert.equal(searchRes.projects.length, 1);
    assert.equal(searchRes.projects[0].id, 'transicion-energetica-autoconsumo-comunitario');

    const seedsRes = await requestStaticApi('/api/seeds');
    assert.ok(seedsRes.seeds.length >= 3);

    // 2. Apoyar una idea ciudadana
    const beforeVotes = seedsRes.seeds[0].votes;
    const endorseRes = await requestStaticApi(`/api/seeds/${seedsRes.seeds[0].id}/endorse`, {
      method: 'POST'
    });
    assert.equal(endorseRes.seed.votes, beforeVotes + 1);
    assert.equal(hasLocalDraftChanges(), true);

    // 3. Crear propuesta con co-autoría pendiente, completarla y consolidarla
    const detail = await requestStaticApi('/api/projects/acceso-vivienda-alquiler-asequible');
    const secContent = detail.project.monograph[1].content;

    const createProp = await requestStaticApi(
      '/api/projects/acceso-vivienda-alquiler-asequible/proposals',
      {
        method: 'POST',
        body: JSON.stringify({
          sectionId: 'articulado',
          title: 'Cláusula de mediación previa gratuita',
          originalText: secContent,
          proposedText: `${secContent}\nArtículo 4. Servicio público de mediación entre arrendador e inquilino.`,
          requiredDomains: ['juridico', 'economico'],
          primaryDomain: 'juridico',
          primaryAnalysis: 'Reduce la litigiosidad en juzgados de primera instancia.'
        })
      }
    );
    assert.equal(createProp.proposal.status, 'Solicita co-autoría');
    assert.deepEqual(createProp.proposal.pendingDomains, ['economico']);

    const coauth = await requestStaticApi(
      `/api/projects/acceso-vivienda-alquiler-asequible/proposals/${createProp.proposal.id}/coauthor`,
      {
        method: 'POST',
        body: JSON.stringify({
          domain: 'economico',
          contributorName: 'Sofía M.',
          contributorRole: 'Economista Pública',
          analysisText: 'Coste de 4 M EUR anuales compensado por menor gasto judicial.'
        })
      }
    );
    assert.equal(coauth.proposal.status, 'Lista para consolidación');

    const cons = await requestStaticApi(
      `/api/projects/acceso-vivienda-alquiler-asequible/proposals/${createProp.proposal.id}/consolidate`,
      {
        method: 'POST',
        body: JSON.stringify({ reviewerNote: 'Validado en revisión piloto' })
      }
    );
    assert.equal(cons.proposal.status, 'Consolidada');
    assert.ok(
      cons.project.monograph[1].content.includes('Servicio público de mediación'),
      'El texto vigente debe incorporar la enmienda consolidada'
    );

    // 4. Registrar debilidad estructurada
    const weak = await requestStaticApi(
      '/api/projects/acceso-vivienda-alquiler-asequible/weaknesses',
      {
        method: 'POST',
        body: JSON.stringify({
          sectionId: 'articulado',
          severity: 'critica',
          domain: 'juridico',
          title: 'Ausencia de régimen transitorio para contratos previos',
          description: 'Falta precisar la aplicación a contratos firmados antes de la entrada en vigor.'
        })
      }
    );
    assert.equal(weak.weakness.severity, 'critica');
    assert.equal(weak.project.icmn.readyForLegislation, false);

    // 5. Restablecer borrador local limpia dirty flag y recupera estado inicial
    await clearLocalDrafts();
    assert.equal(hasLocalDraftChanges(), false);
    const resetDetail = await requestStaticApi('/api/projects/acceso-vivienda-alquiler-asequible');
    assert.equal(resetDetail.project.proposals.length, 1);
  } finally {
    delete globalThis.window;
    delete globalThis.fetch;
  }
});

test('githubBridge: genera enlaces de Issue válidos para los 5 tipos, gestiona límite URL y exporta expedientes', () => {
  const catalog = createInitialProjectsCatalog();
  const samplePlan = catalog.projects[0];

  const kinds = [
    ['enmienda', { projectId: samplePlan.id, sectionId: 'articulado', title: 'Enmienda prueba', proposedText: 'Texto' }],
    ['debilidad', { projectId: samplePlan.id, sectionId: 'articulado', title: 'Debilidad prueba', description: 'Detalle', severity: 'alta', domain: 'economico' }],
    ['coautoria', { projectId: samplePlan.id, proposalId: 'prop-1', domain: 'juridico', contributorName: 'Ana', analysisText: 'Análisis' }],
    ['idea', { title: 'Idea nueva', category: 'Vivienda', description: 'Descripción ciudadana' }],
    ['plan', { title: 'Plan nuevo', category: 'Energía', summary: 'Resumen ejecutivo', initialContent: 'Diagnóstico' }]
  ];

  for (const [kind, data] of kinds) {
    const sub = buildGitHubIssueSubmission(kind, data);
    assert.ok(sub.fullUrl.startsWith('https://github.com/jbernax/democracia-colaborativa/issues/new?'));
    assert.ok(sub.fallbackUrl.includes('template='));
    assert.ok(sub.body.includes('```json agora-payload'));
    assert.equal(sub.exceededUrlLimit, false);
  }

  // Simular carga útil muy larga para activar fallback de portapapeles
  const oversized = buildGitHubIssueSubmission('enmienda', {
    projectId: samplePlan.id,
    sectionId: 'articulado',
    title: 'Enmienda extensa',
    proposedText: 'A'.repeat(8500)
  });
  assert.equal(oversized.exceededUrlLimit, true);

  const md = exportProjectAsMarkdown(samplePlan);
  assert.ok(md.includes(`# ${samplePlan.title}`));
  assert.ok(md.includes('Desglose ICMN'));

  const json = exportProjectAsJson(samplePlan);
  assert.equal(JSON.parse(json).id, samplePlan.id);
});

test('Regresión de caché y DOM: app.js evita accesos sin guarda y build-pages versiona recursos con ?v=<hash>', () => {
  const appSource = fs.readFileSync(path.resolve('public/app.js'), 'utf-8');
  assert.equal(
    /document\.getElementById\([^)]+\)\.(textContent|hidden|value)\b/.test(appSource),
    false,
    'Todos los accesos getElementById().textContent/hidden/value deben usar los helpers con guarda'
  );

  const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-pages-build-test-'));
  try {
    const result = buildPagesBundle({ outDir: tmpOutDir });
    const v = result.buildHash;
    assert.match(v, /^[a-f0-9]{8}$/);

    const indexHtml = fs.readFileSync(path.join(tmpOutDir, 'index.html'), 'utf-8');
    assert.ok(indexHtml.includes(`href="styles.css?v=${v}"`));
    assert.ok(indexHtml.includes(`src="app.js?v=${v}"`));

    const staticStoreJs = fs.readFileSync(path.join(tmpOutDir, 'staticStore.js'), 'utf-8');
    assert.ok(staticStoreJs.includes(`fetch('catalog.json?v=${v}')`));

    const jsFiles = [
      path.join(tmpOutDir, 'app.js'),
      path.join(tmpOutDir, 'staticStore.js'),
      ...fs
        .readdirSync(path.join(tmpOutDir, 'shared'))
        .map((f) => path.join(tmpOutDir, 'shared', f))
    ];

    for (const file of jsFiles) {
      const code = fs.readFileSync(file, 'utf-8');
      for (const m of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        assert.ok(spec.endsWith(`?v=${v}`), `Import sin versión ?v=${v} en ${file}: ${spec}`);
        const cleanRel = spec.split('?')[0];
        const target = path.resolve(path.dirname(file), cleanRel);
        assert.equal(fs.existsSync(target), true, `Falta destino de import: ${target}`);
      }
    }
  } finally {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }
});
