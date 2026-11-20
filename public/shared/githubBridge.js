/**
 * Puente sin servidor hacia GitHub (Free Tier) y exportación de expedientes normativos.
 * Genera enlaces de Issues prellenados con carga útil estructurada (`agora-payload`)
 * para moderación e ingestión vía GitHub Actions, así como exportación en Markdown y JSON.
 */

import { POLICY_DOMAINS } from './collaborationEngine.js';

export const DEFAULT_REPO_URL = 'https://github.com/jbernax/democracia-colaborativa';

const KIND_CONFIG = Object.freeze({
  enmienda: {
    template: 'nueva-enmienda.yml',
    label: 'enmienda',
    heading: 'Propuesta de cambio en el texto'
  },
  debilidad: {
    template: 'alerta-debilidad.yml',
    label: 'debilidad',
    heading: 'Aviso de punto débil'
  },
  coautoria: {
    template: 'coautoria-dominio.yml',
    label: 'coautoria',
    heading: 'Análisis de área pendiente'
  },
  idea: {
    template: 'idea-ciudadana.yml',
    label: 'idea',
    heading: 'Nueva idea ciudadana'
  },
  plan: {
    template: 'nuevo-plan.yml',
    label: 'plan',
    heading: 'Propuesta de nuevo plan'
  }
});

function sanitizePayload(kind, data = {}) {
  switch (kind) {
    case 'enmienda':
      return {
        kind: 'enmienda',
        projectId: data.projectId || '',
        sectionId: data.sectionId || '',
        title: data.title || '',
        author: data.author || 'Ciudadano Colaborador',
        authorRole: data.authorRole || 'Participante / Especialista',
        reason: data.reason || '',
        requiredDomains: Array.isArray(data.requiredDomains) ? data.requiredDomains : [],
        primaryDomain: data.primaryDomain || '',
        primaryAnalysis: data.primaryAnalysis || '',
        mitigatesWeaknessIds: Array.isArray(data.mitigatesWeaknessIds)
          ? data.mitigatesWeaknessIds
          : [],
        originalText: data.originalText || '',
        proposedText: data.proposedText || ''
      };
    case 'debilidad':
      return {
        kind: 'debilidad',
        projectId: data.projectId || '',
        sectionId: data.sectionId || '',
        severity: data.severity || 'alta',
        domain: data.domain || 'laboral_pyme',
        affectedGroup: data.affectedGroup || '',
        title: data.title || '',
        description: data.description || '',
        reportedBy: data.reportedBy || 'Auditor Ciudadano / Sectorial'
      };
    case 'coautoria':
      return {
        kind: 'coautoria',
        projectId: data.projectId || '',
        proposalId: data.proposalId || '',
        domain: data.domain || '',
        contributorName: data.contributorName || '',
        contributorRole: data.contributorRole || 'Especialista Co-autor',
        analysisText: data.analysisText || ''
      };
    case 'idea':
      return {
        kind: 'idea',
        title: data.title || '',
        category: data.category || 'Iniciativa Ciudadana',
        author: data.author || 'Ciudadano Proponente',
        description: data.description || ''
      };
    case 'plan':
      return {
        kind: 'plan',
        title: data.title || '',
        category: data.category || 'Política Pública',
        code: data.code || '',
        author: data.author || 'Iniciativa Ciudadana',
        summary: data.summary || '',
        initialContent: data.initialContent || '',
        measuresContent: data.measuresContent || '',
        impactContent: data.impactContent || '',
        sourceSeedId: data.sourceSeedId || null
      };
    default:
      throw new Error(`Tipo de aportación GitHub no soportado: ${kind}`);
  }
}

function buildHumanSummary(kind, payload, extra = {}) {
  const lines = [`### ${KIND_CONFIG[kind].heading}`, ''];

  if (extra.projectTitle) {
    lines.push(`- **Plan**: ${extra.projectTitle} (\`${payload.projectId}\`)`);
  }
  if (payload.sectionId) {
    lines.push(`- **Apartado**: ${extra.sectionTitle || payload.sectionId} (\`${payload.sectionId}\`)`);
  }

  if (kind === 'enmienda') {
    lines.push(`- **Título**: ${payload.title}`);
    lines.push(`- **Autoría**: ${payload.author} (${payload.authorRole})`);
    if (payload.primaryDomain) {
      lines.push(
        `- **Área analizada**: ${POLICY_DOMAINS[payload.primaryDomain]?.label || payload.primaryDomain}`
      );
    }
    if (payload.reason) {
      lines.push('', '**Por qué se propone**:', payload.reason);
    }
  } else if (kind === 'debilidad') {
    lines.push(`- **Gravedad**: ${payload.severity}`);
    lines.push(`- **Área afectada**: ${POLICY_DOMAINS[payload.domain]?.label || payload.domain}`);
    lines.push(`- **A quién perjudica**: ${payload.affectedGroup || 'Sin especificar'}`);
    lines.push(`- **Título**: ${payload.title}`);
    lines.push('', '**Qué falla**:', payload.description);
  } else if (kind === 'coautoria') {
    lines.push(`- **Propuesta**: \`${payload.proposalId}\``);
    lines.push(`- **Área completada**: ${POLICY_DOMAINS[payload.domain]?.label || payload.domain}`);
    lines.push(`- **Especialista**: ${payload.contributorName} (${payload.contributorRole})`);
    lines.push('', '**Análisis**:', payload.analysisText);
  } else if (kind === 'idea') {
    lines.push(`- **Título**: ${payload.title}`);
    lines.push(`- **Tema**: ${payload.category}`);
    lines.push(`- **Autoría**: ${payload.author}`);
    lines.push('', '**Descripción**:', payload.description);
  } else if (kind === 'plan') {
    lines.push(`- **Título**: ${payload.title}`);
    lines.push(`- **Tema**: ${payload.category}`);
    lines.push(`- **Autoría**: ${payload.author}`);
    if (payload.sourceSeedId) {
      lines.push(`- **Idea de origen**: \`${payload.sourceSeedId}\``);
    }
    lines.push('', '**Resumen**:', payload.summary);
  }

  lines.push(
    '',
    '---',
    'Datos estructurados para revisión automática en GitHub Actions (`aprobada-publicar`):',
    '',
    '```json agora-payload',
    JSON.stringify(payload, null, 2),
    '```'
  );

  return lines.join('\n');
}

function buildIssueTitle(kind, payload) {
  const prefixMap = {
    enmienda: '[Enmienda]',
    debilidad: '[Debilidad]',
    coautoria: '[Co-autoría]',
    idea: '[Idea]',
    plan: '[Nuevo Plan]'
  };
  const prefix = prefixMap[kind] || '[Aportación]';
  const subject =
    payload.title ||
    (kind === 'coautoria' ? `Dominio ${payload.domain} para ${payload.proposalId}` : 'Aportación ciudadana');
  return `${prefix} ${subject}`.slice(0, 140);
}

/**
 * Construye URLs y cuerpo Markdown listos para abrir un Issue público en GitHub.
 */
export function buildGitHubIssueSubmission(kind, data = {}, repoUrl = DEFAULT_REPO_URL) {
  const cfg = KIND_CONFIG[kind];
  if (!cfg) {
    throw new Error(`Tipo de aportación GitHub no soportado: ${kind}`);
  }

  const cleanRepo = String(repoUrl || DEFAULT_REPO_URL).replace(/\/+$/, '');
  const payload = sanitizePayload(kind, data);
  const title = buildIssueTitle(kind, payload);
  const body = buildHumanSummary(kind, payload, {
    projectTitle: data.projectTitle,
    sectionTitle: data.sectionTitle
  });
  const labels = ['comunidad', cfg.label].join(',');

  const fullParams = new URLSearchParams({ labels, title, body });
  const fullUrl = `${cleanRepo}/issues/new?${fullParams.toString()}`;

  const fallbackParams = new URLSearchParams({
    template: cfg.template,
    labels,
    title
  });
  const fallbackUrl = `${cleanRepo}/issues/new?${fallbackParams.toString()}`;

  return {
    kind,
    title,
    body,
    payload,
    labels: ['comunidad', cfg.label],
    fullUrl,
    fallbackUrl,
    exceededUrlLimit: fullUrl.length > 7000
  };
}

/**
 * Exporta un plan completo y toda su deliberación como documento Markdown legible.
 */
export function exportProjectAsMarkdown(project) {
  if (!project) return '';
  const icmn = project.icmn || { totalScore: 0, statusLabel: '', breakdown: {} };
  const lines = [
    `# ${project.title}`,
    '',
    `- **Expediente**: ${project.code}`,
    `- **Tema**: ${project.category}`,
    `- **Estado**: ${project.stage}`,
    `- **Nota de calidad (ICMN)**: ${icmn.totalScore}/100 (${icmn.statusLabel || 'Evaluado'})`,
    `- **Última actualización**: ${project.updatedAt || project.createdAt}`,
    '',
    '## Resumen',
    '',
    project.summary || '',
    '',
    '## Desglose ICMN',
    '',
    '| Apartado | Nota | Peso |',
    '| :--- | :---: | :---: |',
    `| Áreas de impacto (MAIN) | ${icmn.breakdown?.mainCoverageScore ?? 0}/100 | 30% |`,
    `| Resistencia a fallos | ${icmn.breakdown?.weaknessAuditScore ?? 0}/100 | 30% |`,
    `| Acuerdo entre sectores | ${icmn.breakdown?.consensusBridgeScore ?? 0}/100 | 20% |`,
    `| Claridad del texto | ${icmn.breakdown?.legalPrecisionScore ?? 0}/100 | 20% |`,
    '',
    '## Texto actual del plan',
    ''
  ];

  for (const sec of project.monograph || []) {
    lines.push(`### ${sec.title}`, '', sec.content || '', '');
  }

  const proposals = project.proposals || [];
  if (proposals.length > 0) {
    lines.push('## Propuestas de cambio', '');
    for (const prop of proposals) {
      lines.push(
        `### ${prop.title}`,
        `- **Estado**: ${prop.status} (${prop.maturityLevel?.label || 'Nivel 2'})`,
        `- **Apartado**: ${prop.sectionId}`,
        `- **Autores**: ${(prop.coAuthors || []).map((c) => `${c.name} (${c.role})`).join('; ') || prop.author}`,
        ''
      );
      if (prop.reason) {
        lines.push(`**Por qué**: ${prop.reason}`, '');
      }
      if (Array.isArray(prop.diff) && prop.diff.length > 0) {
        lines.push('```diff');
        for (const d of prop.diff) {
          const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' ';
          lines.push(`${prefix} ${d.text}`);
        }
        lines.push('```', '');
      }
    }
  }

  const weaknesses = project.weaknesses || [];
  if (weaknesses.length > 0) {
    lines.push('## Puntos débiles detectados', '');
    for (const w of weaknesses) {
      lines.push(
        `- **[${w.severity.toUpperCase()} · ${w.status}] ${w.title}** (${w.sectionId}) — ${w.description} *(Afecta a: ${w.affectedGroup}; aviso de ${w.reportedBy})*`
      );
    }
    lines.push('');
  }

  const opinions = project.opinions || [];
  if (opinions.length > 0) {
    lines.push('## Opiniones y casos reales', '');
    for (const op of opinions) {
      const secTag = op.sectionId ? ` [${op.sectionId}]` : '';
      lines.push(`- **${op.type}** (${op.author}, ${op.createdAt})${secTag}: ${op.text}`);
    }
    lines.push('');
  }

  const commits = project.commitHistory || [];
  if (commits.length > 0) {
    lines.push('## Cambios incorporados', '');
    for (const c of commits) {
      lines.push(`- \`${c.commitId}\` (${c.date}): ${c.title} — Participaron: ${(c.coAuthors || []).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Exporta un plan completo en formato JSON indentado.
 */
export function exportProjectAsJson(project) {
  return JSON.stringify(project, null, 2);
}
