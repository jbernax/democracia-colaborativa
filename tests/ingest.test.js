import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ingestIssuePayload } from '../scripts/ingest-issue.mjs';
import { createInitialProjectsCatalog, DEFAULT_CATALOG_DIR } from '../src/data/projectsData.js';
import { validateCatalog } from '../scripts/validate-catalog.mjs';

function makeTempCatalogCopy() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-ingest-test-'));
  const catalogCopy = path.join(tmpDir, 'catalog');
  fs.cpSync(DEFAULT_CATALOG_DIR, catalogCopy, { recursive: true });
  return { tmpDir, catalogCopy };
}

function wrapPayload(payloadObj, header = '### Solicitud comunitaria') {
  return `${header}\n\n\`\`\`json agora-payload\n${JSON.stringify(payloadObj, null, 2)}\n\`\`\`\n`;
}

test('ingest-issue: ingiere los 5 tipos de aportación y mantiene el catálogo válido', () => {
  const { tmpDir, catalogCopy } = makeTempCatalogCopy();

  try {
    const initial = createInitialProjectsCatalog(catalogCopy);
    const vivPlan = initial.projects.find((p) => p.id === 'acceso-vivienda-alquiler-asequible');
    const vivArticulado = vivPlan.monograph.find((s) => s.id === 'articulado').content;

    // 1. Enmienda
    const enmiendaBody = wrapPayload({
      kind: 'enmienda',
      projectId: 'acceso-vivienda-alquiler-asequible',
      sectionId: 'articulado',
      title: 'Cláusula de revisión anual vinculada al IRAV',
      originalText: vivArticulado,
      proposedText: `${vivArticulado}\nArtículo 4. Actualización anual de rentas vinculada al índice oficial.`,
      requiredDomains: ['juridico', 'economico'],
      primaryDomain: 'juridico',
      primaryAnalysis: 'Clarifica la actualización ordinaria durante la vigencia de 5 años.'
    });
    const res1 = ingestIssuePayload(enmiendaBody, {
      catalogDir: catalogCopy,
      issueNumber: 12,
      issueUrl: 'https://github.com/jbernax/democracia-colaborativa/issues/12',
      issueAuthor: 'colaborador-test'
    });
    assert.equal(res1.kind, 'enmienda');

    // 2. Debilidad
    const debilidadBody = wrapPayload({
      kind: 'debilidad',
      projectId: 'acceso-vivienda-alquiler-asequible',
      sectionId: 'articulado',
      severity: 'alta',
      domain: 'social_igualdad',
      affectedGroup: 'Hogares con ingresos variables',
      title: 'Falta criterio de carencia ante caída sobrevenida de ingresos',
      description: 'Se requiere prever un mecanismo de ajuste temporal si el inquilino pierde su empleo.'
    });
    const res2 = ingestIssuePayload(debilidadBody, {
      catalogDir: catalogCopy,
      issueNumber: 13
    });
    assert.equal(res2.kind, 'debilidad');

    // 3. Co-autoría (completa el dominio jurídico pendiente de prop-1)
    const coautoriaBody = wrapPayload({
      kind: 'coautoria',
      projectId: 'reincorporacion-laboral-maternidad',
      proposalId: 'prop-1',
      domain: 'juridico',
      contributorName: 'Dra. Beatriz C.',
      contributorRole: 'Catedrática Derecho del Trabajo',
      analysisText: 'Validada la exigencia de acuerdo expreso conforme al Art. 37.7 ET.'
    });
    const res3 = ingestIssuePayload(coautoriaBody, {
      catalogDir: catalogCopy,
      issueNumber: 14
    });
    assert.equal(res3.kind, 'coautoria');

    // 4. Idea ciudadana
    const ideaBody = wrapPayload({
      kind: 'idea',
      title: 'Portal unificado de seguimiento de ejecución presupuestaria municipal',
      category: 'Transparencia',
      description: 'Publicación trimestral comparable de ejecución real frente a crédito inicial.'
    });
    const res4 = ingestIssuePayload(ideaBody, {
      catalogDir: catalogCopy,
      issueNumber: 15,
      issueAuthor: 'vecino15'
    });
    assert.equal(res4.kind, 'idea');

    // 5. Nuevo plan promocionando idea-01
    const planBody = wrapPayload({
      kind: 'plan',
      title: 'Ley Marco de Bancos de Tiempo Municipales para Cuidados',
      category: 'Servicios Sociales y Cuidados',
      summary: 'Marco estatal habilitante para certificar horas de apoyo vecinal en municipios.',
      initialContent: 'La red vecinal de cuidados carece hoy de respaldo jurídico municipal uniforme.',
      sourceSeedId: 'idea-01'
    });
    const res5 = ingestIssuePayload(planBody, {
      catalogDir: catalogCopy,
      issueNumber: 16
    });
    assert.equal(res5.kind, 'plan');

    // Verificar estado final en disco
    const updatedCatalog = createInitialProjectsCatalog(catalogCopy);
    const validation = validateCatalog(updatedCatalog);
    assert.equal(validation.valid, true, validation.errors.join('; '));
    assert.equal(updatedCatalog.projects.length, 6);
    assert.equal(updatedCatalog.seeds.length, 4);

    const promotedIdea = updatedCatalog.seeds.find((s) => s.id === 'idea-01');
    assert.ok(promotedIdea.promotedProjectId);

    const matPlan = updatedCatalog.projects.find(
      (p) => p.id === 'reincorporacion-laboral-maternidad'
    );
    const prop1 = matPlan.proposals.find((pr) => pr.id === 'prop-1');
    assert.equal(prop1.status, 'Lista para consolidación');
    assert.equal(prop1.pendingDomains.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ingest-issue: rechaza cargas maliciosas, traversal, JSON inválido o bloques ausentes', () => {
  const { tmpDir, catalogCopy } = makeTempCatalogCopy();

  try {
    assert.throws(() => ingestIssuePayload('Sin bloque estructurado', { catalogDir: catalogCopy }), /agora-payload/);
    assert.throws(
      () => ingestIssuePayload('```json agora-payload\n{malformed}\n```', { catalogDir: catalogCopy }),
      /JSON válido/
    );
    assert.throws(
      () => ingestIssuePayload(wrapPayload({ kind: 'desconocido' }), { catalogDir: catalogCopy }),
      /no soportado/
    );
    assert.throws(
      () =>
        ingestIssuePayload('```json agora-payload\n{"kind":"idea","__proto__":{"polluted":true}}\n```', {
          catalogDir: catalogCopy
        }),
      /Clave no permitida/
    );
    assert.throws(
      () =>
        ingestIssuePayload(
          wrapPayload({
            kind: 'enmienda',
            projectId: '../secrets',
            title: 'Traversal',
            proposedText: 'Texto'
          }),
          { catalogDir: catalogCopy }
        ),
      /inválido/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
