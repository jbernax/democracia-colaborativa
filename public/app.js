/**
 * Cliente interactivo para Democracia Colaborativa (Ágora Normativa).
 * Gestiona el catálogo multiproyecto con búsqueda, creación de planes, lectura monográfica
 * íntegra, editor de prosa con diff LCS intralínea, co-autoría MAIN, auditoría de debilidades,
 * simulador paramétrico RD 931/2017 y puente sin servidor hacia GitHub.
 */

import {
  isStaticHost,
  hasLocalDraftChanges,
  clearLocalDrafts,
  requestStaticApi
} from './staticStore.js';
import { computeClauseDiff, summarizeDiffStats } from './shared/textDiff.js';
import {
  POLICY_DOMAINS,
  evaluateStakeholderSatisfaction,
  inferNeededDomainsFromText
} from './shared/collaborationEngine.js';
import { simulatePlanImpact } from './shared/impactSimulator.js';
import {
  DEFAULT_REPO_URL,
  buildGitHubIssueSubmission,
  exportProjectAsMarkdown,
  exportProjectAsJson
} from './shared/githubBridge.js';

const LANDING_ANCHORS = new Set(['catalogo', 'metodo', 'ideas']);
const READING_WORDS_PER_MINUTE = 200;
const TOAST_DURATION_MS = 5500;
const ENDORSED_STORAGE_KEY = 'democracia_endorsed_ideas_v2';
const DEFAULT_DOCUMENT_TITLE = document.title;

const SEVERITY_LABELS = Object.freeze({
  critica: 'Crítica',
  alta: 'Alta',
  moderada: 'Moderada'
});

const WEAKNESS_STATUS_LABELS = Object.freeze({
  abierta: 'Abierta',
  en_mitigacion: 'En mitigación',
  mitigada: 'Mitigada'
});

const SIMULATOR_SLIDER_SPECS = [
  { key: 'reductionPercent', label: 'Reducción de jornada', unit: '%', min: 10, max: 75, step: 5 },
  { key: 'durationMonths', label: 'Duración de la medida', unit: ' meses', min: 1, max: 24, step: 1 },
  { key: 'salarySubsidyPercent', label: 'Ayuda al salario (Seg. Social)', unit: '%', min: 0, max: 100, step: 5 },
  { key: 'smeReliefPercent', label: 'Bonificación cuotas pymes', unit: '%', min: 0, max: 100, step: 5 },
  { key: 'selfEmployedFlatGrantEur', label: 'Bono mensual autónomas (RETA)', unit: ' EUR', min: 0, max: 1500, step: 50 },
  { key: 'teleworkSharePercent', label: 'Teletrabajo preferente', unit: '%', min: 0, max: 80, step: 5 },
  { key: 'monoparentalMultiplier', label: 'Ampliación monoparentales', unit: 'x', min: 1.0, max: 2.0, step: 0.1 }
];

const state = {
  currentFilter: 'all',
  currentQuery: '',
  currentCategory: 'all',
  projects: [],
  categories: [],
  catalogTotals: { projects: 0, proposals: 0, weaknesses: 0 },
  seeds: [],
  activeProject: null,
  activeSideTab: 'proposals',
  activeInlineSectionId: null,
  editorDirty: false,
  sectionViewModes: {},
  selectedSectionProposal: {},
  sectionProposalPreviewMode: {},
  simulatorParams: null,
  activeSimulatorBranchId: null,
  repoUrl: DEFAULT_REPO_URL,
  lastFocusedElement: null
};

/* ==========================================================================
   UTILIDADES Y SEGURIDAD DE RENDERIZADO
   ========================================================================== */

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEndorsedIds() {
  try {
    const raw = window.localStorage.getItem(ENDORSED_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markIdeaEndorsed(seedId) {
  try {
    const set = getEndorsedIds();
    set.add(seedId);
    window.localStorage.setItem(ENDORSED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Ignorar en entornos sin localStorage
  }
}

function showNotification(message, isError = false) {
  const toast = document.getElementById('notification-banner');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.hidden = false;

  window.clearTimeout(toast._hideTimer);
  toast._hideTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, TOAST_DURATION_MS);
}

function updatePersistenceBanner() {
  const notice = document.getElementById('persistence-notice');
  const resetBtn = document.getElementById('btn-reset-local-drafts');
  const repoLink = document.getElementById('colophon-repo-link');

  if (repoLink && state.repoUrl) {
    repoLink.href = state.repoUrl;
  }

  const staticMode = isStaticHost();
  if (notice) {
    if (staticMode) {
      notice.textContent =
        'Modo estático (GitHub Pages): tus cambios se guardan en este navegador como borrador. Pulsa «Enviar a GitHub» si quieres proponerlos en abierto.';
      notice.hidden = false;
    } else {
      notice.hidden = true;
    }
  }

  if (resetBtn) {
    resetBtn.hidden = !(staticMode && hasLocalDraftChanges());
  }
}

async function fetchJson(url, options = {}) {
  const apiUrl = url.startsWith('/') ? url.slice(1) : url;
  if (isStaticHost()) {
    const res = await requestStaticApi(url, options);
    updatePersistenceBanner();
    return res;
  }

  try {
    const response = await fetch(apiUrl, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return await requestStaticApi(url, options);
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se ha podido completar la petición. Inténtalo de nuevo.');
    }
    updatePersistenceBanner();
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      const res = await requestStaticApi(url, options);
      updatePersistenceBanner();
      return res;
    }
    throw err;
  }
}

function diffTokensHtml(entry) {
  if (!Array.isArray(entry.tokens) || entry.tokens.length === 0) {
    return escapeHtml(entry.text);
  }
  return entry.tokens
    .map((token) => {
      const text = escapeHtml(token.text);
      if (token.type === 'added') return `<mark class="word-add">${text}</mark>`;
      if (token.type === 'removed') return `<mark class="word-del">${text}</mark>`;
      return text;
    })
    .join('');
}

function diffRowsHtml(diff) {
  return (diff || [])
    .map((d, idx) => {
      const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '−' : ' ';
      return `
        <div class="diff-row ${d.type}">
          <span class="diff-num">${idx + 1}</span>
          <span class="diff-text"><span class="diff-sign" aria-hidden="true">${prefix} </span>${diffTokensHtml(d)}</span>
        </div>
      `;
    })
    .join('');
}

function countParagraphsAndWords(text = '') {
  const trimmed = String(text).trim();
  if (!trimmed) return { paragraphs: 0, words: 0 };
  const paragraphs = trimmed
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean).length;
  const words = (trimmed.match(/\S+/g) || []).length;
  return { paragraphs, words };
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function submitToGitHub(kind, data) {
  try {
    const submission = buildGitHubIssueSubmission(kind, data, state.repoUrl);
    if (submission.exceededUrlLimit) {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(submission.body);
          copied = true;
        } catch {
          copied = false;
        }
      }
      window.open(submission.fallbackUrl, '_blank', 'noopener,noreferrer');
      showNotification(
        copied
          ? 'Tu propuesta es muy larga para el enlace directo: ya la hemos copiado al portapapeles para que la pegues en GitHub.'
          : 'Tu propuesta es muy larga para el enlace directo: se ha abierto GitHub. Exporta el plan en Markdown o JSON para adjuntarlo.'
      );
      return;
    }

    window.open(submission.fullUrl, '_blank', 'noopener,noreferrer');
    showNotification('Hemos abierto GitHub con tu propuesta ya rellenada para revisarla en abierto.');
  } catch (err) {
    showNotification(err.message, true);
  }
}

/* ==========================================================================
   ENRUTAMIENTO Y GUARDA DE CAMBIOS
   ========================================================================== */

function confirmDiscardEditorIfDirty() {
  if (!state.activeInlineSectionId || !state.editorDirty) {
    return true;
  }
  return window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?');
}

function setActiveRoute(view) {
  document.body.dataset.view = view;
  document.getElementById('view-landing').hidden = view !== 'landing';
  document.getElementById('view-project').hidden = view !== 'project';
  if (view === 'landing') {
    document.title = DEFAULT_DOCUMENT_TITLE;
  }
}

async function handleRouting() {
  const hash = window.location.hash || '#landing';
  if (!confirmDiscardEditorIfDirty()) {
    return;
  }
  state.editorDirty = false;
  state.activeInlineSectionId = null;
  closeAllDrawers();

  if (hash.startsWith('#plan/')) {
    await openProjectView(hash.replace('#plan/', ''));
    return;
  }

  const anchorId = hash.slice(1);
  const landingWasVisible = document.body.dataset.view === 'landing' && state.projects.length > 0;
  setActiveRoute('landing');
  if (!landingWasVisible) {
    await loadLandingData();
  }

  if (LANDING_ANCHORS.has(anchorId)) {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0 });
  }
}

async function loadLandingData() {
  try {
    const params = new URLSearchParams({ filter: state.currentFilter });
    if (state.currentQuery) params.set('q', state.currentQuery);
    if (state.currentCategory && state.currentCategory !== 'all') {
      params.set('category', state.currentCategory);
    }

    const filtered = await fetchJson(`/api/projects?${params.toString()}`);
    const hasQueryFilters =
      state.currentFilter !== 'all' ||
      Boolean(state.currentQuery) ||
      (state.currentCategory && state.currentCategory !== 'all');

    const unfiltered = hasQueryFilters ? await fetchJson('/api/projects?filter=all') : filtered;

    if (filtered.meta?.repositoryUrl) {
      state.repoUrl = filtered.meta.repositoryUrl;
    }
    state.projects = filtered.projects || [];
    state.categories = unfiltered.categories || filtered.categories || [];
    state.seeds = unfiltered.seeds || filtered.seeds || [];
    state.catalogTotals = summarizeCatalog(unfiltered.projects || []);
    renderLandingView();
    updatePersistenceBanner();
  } catch (err) {
    showNotification(err.message, true);
  }
}

function summarizeCatalog(projects) {
  return projects.reduce(
    (totals, p) => ({
      projects: totals.projects + 1,
      proposals: totals.proposals + (p.proposalsCount || 0),
      weaknesses: totals.weaknesses + (p.weaknessesCount || 0)
    }),
    { projects: 0, proposals: 0, weaknesses: 0 }
  );
}

async function openProjectView(projectId) {
  setActiveRoute('project');
  window.scrollTo({ top: 0 });
  state.activeInlineSectionId = null;
  state.editorDirty = false;
  state.simulatorParams = null;
  state.activeSimulatorBranchId = null;

  try {
    const data = await fetchJson(`/api/projects/${encodeURIComponent(projectId)}`);
    state.activeProject = data.project;
    renderProjectView();
    updateReadingProgress();
    updatePersistenceBanner();
  } catch (err) {
    showNotification(err.message, true);
    window.location.hash = '#landing';
  }
}

/* ==========================================================================
   PORTADA
   ========================================================================== */

function renderLandingView() {
  renderCatalogLedger();
  renderCategorySelect();
  renderProjectsGrid();
  renderSeedsList();
}

function renderCatalogLedger() {
  const { projects, proposals, weaknesses } = state.catalogTotals;
  document.getElementById('ledger-projects').textContent = String(projects);
  document.getElementById('ledger-proposals').textContent = String(proposals);
  document.getElementById('ledger-weaknesses').textContent = String(weaknesses);
  document.getElementById('ledger-seeds').textContent = String(state.seeds.length);
}

function renderCategorySelect() {
  const select = document.getElementById('catalog-category');
  if (!select) return;
  const previous = state.currentCategory || 'all';
  const options = ['<option value="all">Todos los temas</option>'];
  for (const cat of state.categories) {
    const selected = cat === previous ? ' selected' : '';
    options.push(`<option value="${escapeHtml(cat)}"${selected}>${escapeHtml(cat)}</option>`);
  }
  select.innerHTML = options.join('');
}

function bentoSpansFor(count) {
  const rowPatterns = [
    [7, 5],
    [4, 8]
  ];
  const spans = [];
  for (let i = 0; i < count; i += 2) {
    const isLastAlone = i === count - 1;
    if (isLastAlone) {
      spans.push(12);
    } else {
      spans.push(...rowPatterns[(i / 2) % rowPatterns.length]);
    }
  }
  return spans;
}

function participationLabel(p) {
  const total = (p.proposalsCount || 0) + (p.opinionsCount || 0) + (p.weaknessesCount || 0);
  return total === 1 ? '1 aportación' : `${total} aportaciones`;
}

function renderProjectsGrid() {
  const container = document.getElementById('projects-grid');
  const countEl = document.getElementById('catalog-count');
  if (!container) return;

  const totalCatalog = state.catalogTotals.projects || state.projects.length;
  if (countEl) {
    const isFiltered =
      state.currentFilter !== 'all' ||
      Boolean(state.currentQuery) ||
      (state.currentCategory && state.currentCategory !== 'all');
    countEl.textContent = isFiltered
      ? `Mostrando ${state.projects.length} de ${totalCatalog} planes`
      : `${totalCatalog} planes en el catálogo`;
  }

  if (state.projects.length === 0) {
    container.innerHTML = `
      <div class="empty-note">
        <p>No hay planes que coincidan con esa búsqueda.</p>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-catalog-filters">Limpiar filtros</button>
      </div>
    `;
    document.getElementById('btn-clear-catalog-filters')?.addEventListener('click', resetCatalogFilters);
    return;
  }

  const spans = bentoSpansFor(state.projects.length);
  container.innerHTML = state.projects
    .map((p, idx) => {
      const span = spans[idx];
      const variant = span === 12 ? 'bento-wide' : span >= 7 ? 'bento-featured' : '';
      return `
        <article class="bento-cell span-${span} ${variant}" style="animation-delay:${idx * 60}ms">
          <p class="kicker">${escapeHtml(p.stage)} · ICMN ${p.icmnScore ?? 0}/100 · ${participationLabel(p)}</p>
          <h3 class="bento-title">
            <a href="#plan/${escapeHtml(p.id)}">${escapeHtml(p.title)}</a>
          </h3>
          <p class="bento-summary">${escapeHtml(p.summary)}</p>
        </article>
      `;
    })
    .join('');
}

function resetCatalogFilters() {
  state.currentFilter = 'all';
  state.currentQuery = '';
  state.currentCategory = 'all';
  const searchEl = document.getElementById('catalog-search');
  if (searchEl) searchEl.value = '';
  const catEl = document.getElementById('catalog-category');
  if (catEl) catEl.value = 'all';
  document.querySelectorAll('#filter-buttons-group .segmented-option').forEach((b) => {
    const isAll = b.dataset.filter === 'all';
    b.classList.toggle('is-active', isAll);
    b.setAttribute('aria-pressed', String(isAll));
  });
  loadLandingData();
}

function renderSeedsList() {
  const container = document.getElementById('seeds-cards-container');
  if (!container) return;

  if (state.seeds.length === 0) {
    container.innerHTML = `<li class="empty-note">Todavía no hay ideas. Anímate a proponer la primera.</li>`;
    return;
  }

  const endorsedSet = getEndorsedIds();

  container.innerHTML = state.seeds
    .map((s) => {
      const isEndorsed = endorsedSet.has(s.id);
      const votes = Number(s.votes || 0);
      const promotedHtml = s.promotedProjectId
        ? `<a href="#plan/${escapeHtml(s.promotedProjectId)}" class="btn btn-quiet btn-sm">Ver el plan creado</a>`
        : `<button type="button" class="btn btn-quiet btn-sm btn-promote-seed" data-promote-id="${escapeHtml(s.id)}">Convertir en plan</button>`;

      return `
        <li class="idea-entry">
          <p class="kicker">${escapeHtml(s.category)} · ${escapeHtml(s.author || 'Ciudadano')}</p>
          <h3 class="idea-title">${escapeHtml(s.title)}</h3>
          <p class="idea-desc">${escapeHtml(s.description)}</p>
          <div class="idea-actions">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-endorse-seed ${isEndorsed ? 'is-endorsed' : ''}"
              data-endorse-id="${escapeHtml(s.id)}"
              aria-pressed="${isEndorsed}"
              ${isEndorsed ? 'disabled' : ''}
            >
              ${isEndorsed ? 'Apoyada' : 'Apoyar'} (<span class="tabular">${votes}</span>)
            </button>
            ${promotedHtml}
            <button type="button" class="btn btn-quiet btn-sm btn-github-seed" data-github-seed-id="${escapeHtml(s.id)}">Enviar a GitHub</button>
          </div>
        </li>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-endorse-seed').forEach((btn) => {
    btn.addEventListener('click', () => handleEndorseSeed(btn.dataset.endorseId));
  });

  container.querySelectorAll('.btn-promote-seed').forEach((btn) => {
    btn.addEventListener('click', () => openProjectComposerFromSeed(btn.dataset.promoteId));
  });

  container.querySelectorAll('.btn-github-seed').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seed = state.seeds.find((item) => item.id === btn.dataset.githubSeedId);
      if (seed) submitToGitHub('idea', seed);
    });
  });
}

async function handleEndorseSeed(seedId) {
  const endorsed = getEndorsedIds();
  if (endorsed.has(seedId)) return;
  try {
    const res = await fetchJson(`/api/seeds/${encodeURIComponent(seedId)}/endorse`, {
      method: 'POST'
    });
    markIdeaEndorsed(seedId);
    state.seeds = res.seeds || state.seeds;
    renderSeedsList();
    showNotification('Apoyo sumado a la idea.');
  } catch (err) {
    showNotification(err.message, true);
  }
}

function openProjectComposerFromSeed(seedId) {
  const seed = state.seeds.find((s) => s.id === seedId);
  if (!seed) return;
  document.getElementById('project-source-seed-id').value = seed.id;
  document.getElementById('project-title').value = seed.title;
  document.getElementById('project-category').value = seed.category || '';
  document.getElementById('project-initial-content').value = seed.description || '';
  document.getElementById('project-summary').value = '';
  setDrawerOpen('project-composer', true);
  document.getElementById('project-summary')?.focus({ preventScroll: true });
}

/* ==========================================================================
   LECTURA DEL PLAN, ICMN Y MONOGRAFÍA
   ========================================================================== */

function estimateReadingMinutes(p) {
  const words = (p.monograph || [])
    .map((sec) => sec.content || '')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
}

function renderProjectView() {
  const p = state.activeProject;
  if (!p) return;

  const icmn = p.icmn || { totalScore: 0, statusLabel: 'En elaboración', breakdown: {} };
  const weaknesses = p.weaknesses || [];
  const openCritical = weaknesses.filter(
    (w) => w.status !== 'mitigada' && w.severity === 'critica'
  ).length;

  document.title = `${p.title} | Democracia colaborativa`;
  document.getElementById('topbar-plan-code').textContent = p.code;
  document.getElementById('project-meta-pills').textContent = `${p.category} · ${p.stage}`;
  document.getElementById('plan-title').textContent = p.title;
  document.getElementById('plan-summary').textContent = p.summary;
  document.getElementById('plan-code').textContent = p.code;
  document.getElementById('plan-icmn-score').textContent = `${icmn.totalScore}/100`;
  document.getElementById('plan-weaknesses-count').textContent = `${openCritical} crít. / ${weaknesses.length}`;
  document.getElementById('plan-proposals-count').textContent = String((p.proposals || []).length);
  document.getElementById('plan-reading-time').textContent = `${estimateReadingMinutes(p)} min`;

  const statusEl = document.getElementById('plan-icmn-status');
  if (statusEl) {
    statusEl.textContent = icmn.statusLabel || '';
    statusEl.classList.toggle('is-ready', Boolean(icmn.readyForLegislation));
    statusEl.classList.toggle('is-blocked', openCritical > 0);
  }

  const breakdownEl = document.getElementById('plan-icmn-breakdown');
  if (breakdownEl && icmn.breakdown) {
    const b = icmn.breakdown;
    breakdownEl.innerHTML = `
      <div class="icmn-metric"><span>Áreas de impacto (MAIN, 30%)</span><strong class="tabular">${b.mainCoverageScore ?? 0}/100</strong></div>
      <div class="icmn-metric"><span>Resistencia a fallos (30%)</span><strong class="tabular">${b.weaknessAuditScore ?? 0}/100</strong></div>
      <div class="icmn-metric"><span>Acuerdo entre sectores (20%)</span><strong class="tabular">${b.consensusBridgeScore ?? 0}/100</strong></div>
      <div class="icmn-metric"><span>Claridad del texto (20%)</span><strong class="tabular">${b.legalPrecisionScore ?? 0}/100</strong></div>
    `;
  }

  renderMonographSections(p);
  renderSimulatorSection(p);
  renderCommitHistory(p);
  renderTableOfContents(p);
  populateDrawerSelects(p);
  renderDrawerProposalsList(p);
  renderDrawerWeaknessesList(p);
  renderDrawerOpinionsList(p);
  updateDrawerCounts(p);
}

function getSectionProposalsInfo(p, section) {
  const proposals = (p.proposals || []).filter((prop) => prop.sectionId === section.id);
  const openProposals = proposals.filter(
    (prop) => prop.status !== 'Consolidada' && prop.maturityLevel?.level !== 4
  );
  return {
    all: proposals,
    open: openProposals
  };
}

function revisionBarHtml(sec, secProposals, currentMode) {
  const modes = [
    ['vigente', 'Texto actual'],
    ['proposals', `Propuestas (${secProposals.all.length})`]
  ];
  const options = modes
    .map(
      ([mode, label]) => `
        <button
          type="button"
          class="segmented-option diff-toggle-btn ${currentMode === mode ? 'is-active' : ''}"
          aria-pressed="${currentMode === mode}"
          data-sec="${escapeHtml(sec.id)}"
          data-mode="${mode}"
        >${label}</button>
      `
    )
    .join('');

  const openLabel =
    secProposals.open.length === 1
      ? '1 propuesta abierta'
      : `${secProposals.open.length} propuestas abiertas`;

  return `
    <div class="revision-bar">
      <p class="revision-summary">
        <span class="tabular">${openLabel}</span>
        <span>· Por defecto ves el texto actual</span>
      </p>
      <div class="segmented" role="group" aria-label="Versión del texto">${options}</div>
    </div>
  `;
}

function sectionBodyHtml(sec, secProposals, currentMode) {
  if (currentMode !== 'proposals' || secProposals.all.length === 0) {
    return `<div class="monograph-text" id="text-sec-${escapeHtml(sec.id)}">${escapeHtml(sec.content)}</div>`;
  }

  const selectedId =
    state.selectedSectionProposal[sec.id] ||
    secProposals.open[0]?.id ||
    secProposals.all[0].id;
  const selectedProp =
    secProposals.all.find((prop) => prop.id === selectedId) || secProposals.all[0];

  const selectorHtml =
    secProposals.all.length > 1
      ? `
        <div class="proposal-selector" role="group" aria-label="Seleccionar propuesta de esta sección">
          ${secProposals.all
            .map((prop, idx) => {
              const isSelected = prop.id === selectedProp.id;
              return `
                <button
                  type="button"
                  class="proposal-chip ${isSelected ? 'is-active' : ''}"
                  data-sec="${escapeHtml(sec.id)}"
                  data-prop-id="${escapeHtml(prop.id)}"
                >
                  Propuesta ${idx + 1}: ${escapeHtml(prop.title)}
                </button>
              `;
            })
            .join('')}
        </div>
      `
      : '';

  const previewMode = state.sectionProposalPreviewMode[sec.id] || 'diff';
  const diff = selectedProp.diff || computeClauseDiff(selectedProp.originalText || sec.content, selectedProp.proposedText);
  const stats = summarizeDiffStats(diff);
  const coveredLabels = (selectedProp.coveredDomains || [])
    .map((d) => POLICY_DOMAINS[d]?.label || d)
    .join(', ');
  const pendingLabels = (selectedProp.pendingDomains || [])
    .map((d) => POLICY_DOMAINS[d]?.label || d)
    .join(', ');

  const bodyContent =
    previewMode === 'text'
      ? `<div class="monograph-text">${escapeHtml(selectedProp.proposedText)}</div>`
      : `<div class="diff-view">${diffRowsHtml(diff)}</div>`;

  return `
    ${selectorHtml}
    <div class="section-proposal-panel">
      <div class="section-proposal-meta">
        <div>
          <p class="kicker">${escapeHtml(selectedProp.status)} · ${escapeHtml(selectedProp.maturityLevel?.label || 'Nivel 2')}</p>
          <h3 class="section-proposal-title">${escapeHtml(selectedProp.title)}</h3>
          <p class="section-proposal-domains">
            <span>Áreas analizadas: ${escapeHtml(coveredLabels || 'Solo redacción')}</span>
            ${pendingLabels ? ` · <span>Faltan por analizar: ${escapeHtml(pendingLabels)}</span>` : ''}
          </p>
        </div>
        <div class="segmented" role="group" aria-label="Vista de la propuesta">
          <button type="button" class="segmented-option prop-preview-btn ${previewMode === 'diff' ? 'is-active' : ''}" data-sec="${escapeHtml(sec.id)}" data-preview="diff">Cambios (+${stats.addedWords} / −${stats.removedWords} pal.)</button>
          <button type="button" class="segmented-option prop-preview-btn ${previewMode === 'text' ? 'is-active' : ''}" data-sec="${escapeHtml(sec.id)}" data-preview="text">Texto final</button>
        </div>
      </div>

      ${bodyContent}

      ${selectedProp.reason ? `<p class="entry-reason">Por qué: ${escapeHtml(selectedProp.reason)}</p>` : ''}

      <div class="section-proposal-actions">
        <button type="button" class="btn btn-ghost btn-sm btn-open-prop-drawer" data-prop-id="${escapeHtml(selectedProp.id)}">Ver en debate</button>
        <button type="button" class="btn btn-quiet btn-sm btn-github-sec-prop" data-prop-id="${escapeHtml(selectedProp.id)}">Enviar a GitHub</button>
      </div>
    </div>
  `;
}

function renderMonographSections(p) {
  const container = document.getElementById('monograph-sections-container');
  if (!container) return;

  const sections = p.monograph || [];
  container.innerHTML = sections
    .map((sec) => {
      const secProposals = getSectionProposalsInfo(p, sec);
      const currentMode =
        secProposals.all.length > 0 && state.sectionViewModes[sec.id] === 'proposals'
          ? 'proposals'
          : 'vigente';

      return `
        <section class="monograph-section" id="section-${escapeHtml(sec.id)}" aria-labelledby="title-sec-${escapeHtml(sec.id)}">
          <header class="monograph-section-header">
            <h2 class="monograph-section-title" id="title-sec-${escapeHtml(sec.id)}">${escapeHtml(sec.title)}</h2>
            <div class="section-header-actions">
              <button type="button" class="btn btn-ghost btn-propose-inline" data-section-id="${escapeHtml(sec.id)}">
                Proponer cambios
              </button>
              <button type="button" class="btn btn-quiet btn-section-feedback" data-section-id="${escapeHtml(sec.id)}">
                Opinar o avisar de un fallo
              </button>
            </div>
          </header>
          ${secProposals.all.length > 0 ? revisionBarHtml(sec, secProposals, currentMode) : ''}
          ${sectionBodyHtml(sec, secProposals, currentMode)}
          <div id="inline-editor-slot-${escapeHtml(sec.id)}"></div>
        </section>
      `;
    })
    .join('');

  container.querySelectorAll('.diff-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sectionViewModes[btn.dataset.sec] = btn.dataset.mode;
      renderMonographSections(state.activeProject);
    });
  });

  container.querySelectorAll('.proposal-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedSectionProposal[btn.dataset.sec] = btn.dataset.propId;
      renderMonographSections(state.activeProject);
    });
  });

  container.querySelectorAll('.prop-preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sectionProposalPreviewMode[btn.dataset.sec] = btn.dataset.preview;
      renderMonographSections(state.activeProject);
    });
  });

  container.querySelectorAll('.btn-open-prop-drawer').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectSideTab('proposals');
      openSidebarDrawer();
      const targetEl = document.getElementById(`drawer-prop-${btn.dataset.propId}`);
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  container.querySelectorAll('.btn-github-sec-prop').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prop = (state.activeProject?.proposals || []).find((pr) => pr.id === btn.dataset.propId);
      if (prop) submitProposalToGitHub(prop);
    });
  });

  container.querySelectorAll('.btn-propose-inline').forEach((btn) => {
    btn.addEventListener('click', () => toggleSectionEditor(btn.dataset.sectionId));
  });

  container.querySelectorAll('.btn-section-feedback').forEach((btn) => {
    btn.addEventListener('click', () => {
      const secId = btn.dataset.sectionId;
      selectSideTab('weaknesses');
      const wSection = document.getElementById('weakness-section');
      const oSection = document.getElementById('opinion-section');
      if (wSection) wSection.value = secId;
      if (oSection) oSection.value = secId;
      const wForm = document.getElementById('form-new-weakness');
      if (wForm) wForm.hidden = false;
      openSidebarDrawer();
    });
  });
}

function renderTableOfContents(p) {
  const list = document.getElementById('plan-toc-list');
  if (!list) return;

  const items = (p.monograph || []).map((sec) => {
    const pCount = (p.proposals || []).filter((prop) => prop.sectionId === sec.id).length;
    const wCount = (p.weaknesses || []).filter(
      (w) => w.sectionId === sec.id && w.status !== 'mitigada'
    ).length;
    const total = pCount + wCount;
    const countHtml =
      total > 0
        ? `<span class="toc-count tabular" title="${pCount} propuestas · ${wCount} fallos abiertos">${total}</span>`
        : '';
    return `
      <li>
        <a href="#plan/${escapeHtml(p.id)}" data-target="section-${escapeHtml(sec.id)}">
          <span>${escapeHtml(sec.title)}</span>${countHtml}
        </a>
      </li>
    `;
  });

  if (p.pilotModel?.branches?.length > 0) {
    items.push(`
      <li>
        <a href="#plan/${escapeHtml(p.id)}" data-target="plan-simulator">
          <span>Simulador de impacto</span>
        </a>
      </li>
    `);
  }

  items.push(`
    <li>
      <a href="#plan/${escapeHtml(p.id)}" data-target="plan-history">
        <span>Cambios incorporados</span>
      </a>
    </li>
  `);

  list.innerHTML = items.join('');

  list.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(link.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ==========================================================================
   EDITOR EN LÍNEA POR SECCIÓN (PROSA ESPAÑOLA + MAIN)
   ========================================================================== */

function toggleSectionEditor(sectionId) {
  if (state.activeInlineSectionId && state.activeInlineSectionId !== sectionId) {
    if (!confirmDiscardEditorIfDirty()) return;
    closeInlineEditor(state.activeInlineSectionId);
  }

  const slot = document.getElementById(`inline-editor-slot-${sectionId}`);
  if (!slot) return;

  if (state.activeInlineSectionId === sectionId) {
    if (!confirmDiscardEditorIfDirty()) return;
    closeInlineEditor(sectionId);
    return;
  }

  const sec = (state.activeProject?.monograph || []).find((s) => s.id === sectionId);
  if (!sec) return;

  state.activeInlineSectionId = sectionId;
  state.editorDirty = false;

  const workingText = sec.content || '';
  const { paragraphs, words } = countParagraphsAndWords(workingText);
  const sid = escapeHtml(sectionId);
  const suggestedDomains = new Set(inferNeededDomainsFromText(workingText));

  const domainOptions = [
    '<option value="">Solo cambio de texto (sin análisis técnico todavía)</option>',
    ...Object.values(POLICY_DOMAINS).map(
      (d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.label)}</option>`
    )
  ].join('');

  const domainCheckboxes = Object.values(POLICY_DOMAINS)
    .map(
      (d) => `
        <label class="checkbox-pill">
          <input type="checkbox" name="commit-required-${sid}" value="${escapeHtml(d.id)}" ${suggestedDomains.has(d.id) ? 'checked' : ''} />
          <span>${escapeHtml(d.label)}</span>
        </label>
      `
    )
    .join('');

  const openWeaknesses = (state.activeProject?.weaknesses || []).filter(
    (w) => w.status !== 'mitigada'
  );
  const weaknessOptions = [
    '<option value="">No resuelve ningún fallo concreto</option>',
    ...openWeaknesses.map(
      (w) =>
        `<option value="${escapeHtml(w.id)}">[${escapeHtml(SEVERITY_LABELS[w.severity] || w.severity)}] ${escapeHtml(w.title)}</option>`
    )
  ].join('');

  slot.innerHTML = `
    <div class="section-editor" id="editor-frame-${sid}">
      <div class="editor-toolbar">
        <div class="segmented" role="group" aria-label="Modo del editor">
          <button type="button" class="segmented-option is-active" aria-pressed="true" id="tab-edit-${sid}">Editar</button>
          <button type="button" class="segmented-option" aria-pressed="false" id="tab-preview-${sid}">Ver diferencias</button>
        </div>
        <div class="editor-toolbar-actions">
          <span class="editor-meta tabular" id="editor-meta-${sid}">${paragraphs} párrafos · ${words} palabras</span>
          <button type="button" class="btn btn-quiet" id="btn-max-${sid}">Ampliar</button>
        </div>
      </div>

      <div class="editor-body" id="edit-view-${sid}">
        <textarea class="editor-textarea" id="textarea-${sid}" lang="es" spellcheck="true" aria-label="Texto del apartado ${escapeHtml(sec.title)}">${escapeHtml(workingText)}</textarea>
      </div>

      <div class="editor-preview" id="preview-view-${sid}" hidden></div>

      <div class="editor-submit">
        <h3>Proponer cambios en este apartado</h3>
        <div class="field">
          <label for="commit-title-${sid}">Título de tu propuesta</label>
          <input type="text" id="commit-title-${sid}" value="Mejora en ${escapeHtml(sec.title)}" required />
        </div>

        <div class="field-split">
          <div class="field">
            <label for="commit-domain-${sid}">Área que analizas ahora (opcional)</label>
            <select id="commit-domain-${sid}">${domainOptions}</select>
          </div>
          <div class="field">
            <label for="commit-weakness-${sid}">¿Resuelve algún fallo abierto? (opcional)</label>
            <select id="commit-weakness-${sid}">${weaknessOptions}</select>
          </div>
        </div>

        <div class="field" id="commit-analysis-wrap-${sid}" hidden>
          <label for="commit-analysis-${sid}">Tu análisis en esa área</label>
          <textarea id="commit-analysis-${sid}" rows="2" placeholder="Explica si encaja en la ley, cuánto cuesta o cómo afecta en la práctica..."></textarea>
        </div>

        <fieldset class="field-group-compact">
          <legend>Áreas que conviene revisar antes de incorporar el cambio</legend>
          <div class="checkbox-grid">${domainCheckboxes}</div>
        </fieldset>

        <div class="field-split">
          <div class="field">
            <label for="commit-desc-${sid}">Por qué propones este cambio (opcional)</label>
            <textarea id="commit-desc-${sid}" rows="2" placeholder="Cuenta qué problema corrige o qué datos apoyan tu propuesta..."></textarea>
          </div>
          <div class="field">
            <label for="commit-author-${sid}">Tu nombre o asociación (opcional)</label>
            <input type="text" id="commit-author-${sid}" placeholder="Ej. Carmen R. / Abogada laboralista" />
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-primary btn-submit-commit">Proponer cambios</button>
          <button type="button" class="btn btn-ghost btn-github-commit">Enviar a GitHub</button>
          <button type="button" class="btn btn-quiet btn-cancel-commit">Cancelar</button>
        </div>
      </div>
    </div>
  `;

  slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  bindSectionEditor(slot, sec);
}

function bindSectionEditor(slot, sec) {
  const sectionId = sec.id;
  const frame = document.getElementById(`editor-frame-${sectionId}`);
  const textarea = document.getElementById(`textarea-${sectionId}`);
  const meta = document.getElementById(`editor-meta-${sectionId}`);
  const editView = document.getElementById(`edit-view-${sectionId}`);
  const previewView = document.getElementById(`preview-view-${sectionId}`);
  const tabEdit = document.getElementById(`tab-edit-${sectionId}`);
  const tabPreview = document.getElementById(`tab-preview-${sectionId}`);
  const btnMax = document.getElementById(`btn-max-${sectionId}`);
  const domainSelect = document.getElementById(`commit-domain-${sectionId}`);
  const analysisWrap = document.getElementById(`commit-analysis-wrap-${sectionId}`);

  function autoExpandTextarea() {
    if (frame.classList.contains('maximized')) return;
    textarea.style.height = 'auto';
    const computedHeight = Math.max(360, textarea.scrollHeight + 24);
    textarea.style.height = `${computedHeight}px`;
  }

  function updateEditorTelemetry() {
    const { paragraphs, words } = countParagraphsAndWords(textarea.value);
    const diff = computeClauseDiff(sec.content, textarea.value);
    const stats = summarizeDiffStats(diff);
    const deltaText = stats.hasChanges
      ? ` · +${stats.addedWords} / −${stats.removedWords} pal.`
      : '';
    meta.textContent = `${paragraphs} párrafos · ${words} palabras${deltaText}`;
    state.editorDirty = textarea.value !== (sec.content || '');
  }

  autoExpandTextarea();

  textarea.addEventListener('input', () => {
    updateEditorTelemetry();
    autoExpandTextarea();
  });

  domainSelect?.addEventListener('change', () => {
    const selectedDomain = domainSelect.value;
    if (analysisWrap) analysisWrap.hidden = !selectedDomain;
    if (selectedDomain) {
      const matchingBox = slot.querySelector(
        `input[name="commit-required-${sectionId}"][value="${selectedDomain}"]`
      );
      if (matchingBox) matchingBox.checked = true;
    }
  });

  frame.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitSectionProposal(slot, sec, textarea);
    }
  });

  btnMax.addEventListener('click', () => {
    const isMax = frame.classList.toggle('maximized');
    btnMax.textContent = isMax ? 'Reducir' : 'Ampliar';
    textarea.style.height = isMax ? '' : textarea.style.height;
    if (isMax) textarea.focus();
    else autoExpandTextarea();
  });

  function setEditorMode(isPreview) {
    tabEdit.classList.toggle('is-active', !isPreview);
    tabPreview.classList.toggle('is-active', isPreview);
    tabEdit.setAttribute('aria-pressed', String(!isPreview));
    tabPreview.setAttribute('aria-pressed', String(isPreview));
    editView.hidden = isPreview;
    previewView.hidden = !isPreview;
  }

  tabEdit.addEventListener('click', () => setEditorMode(false));

  tabPreview.addEventListener('click', () => {
    setEditorMode(true);
    const diff = computeClauseDiff(sec.content, textarea.value);
    const hasChanges = diff.some((d) => d.type !== 'unchanged');
    previewView.innerHTML = hasChanges
      ? `<div class="diff-view">${diffRowsHtml(diff)}</div>`
      : `<p class="diff-empty">Todavía no has cambiado nada respecto al texto actual.</p>`;
  });

  slot.querySelector('.btn-cancel-commit').addEventListener('click', () => {
    if (!confirmDiscardEditorIfDirty()) return;
    closeInlineEditor(sectionId);
  });

  slot.querySelector('.btn-submit-commit').addEventListener('click', () => {
    submitSectionProposal(slot, sec, textarea);
  });

  slot.querySelector('.btn-github-commit').addEventListener('click', () => {
    const draftPayload = collectSectionProposalPayload(slot, sec, textarea);
    if (!draftPayload) return;
    submitToGitHub('enmienda', {
      ...draftPayload,
      projectId: state.activeProject.id,
      projectTitle: state.activeProject.title,
      sectionTitle: sec.title
    });
  });
}

function collectSectionProposalPayload(slot, sec, textarea) {
  const sectionId = sec.id;
  const title = document.getElementById(`commit-title-${sectionId}`)?.value.trim();
  const proposedText = textarea.value.trim();
  const reason = document.getElementById(`commit-desc-${sectionId}`)?.value.trim();
  const author = document.getElementById(`commit-author-${sectionId}`)?.value.trim();
  const primaryDomain = document.getElementById(`commit-domain-${sectionId}`)?.value || '';
  const primaryAnalysis = document.getElementById(`commit-analysis-${sectionId}`)?.value.trim() || '';
  const weaknessId = document.getElementById(`commit-weakness-${sectionId}`)?.value || '';
  const requiredDomains = [
    ...slot.querySelectorAll(`input[name="commit-required-${sectionId}"]:checked`)
  ].map((el) => el.value);

  if (!title) {
    showNotification('Pon un título breve a tu propuesta.', true);
    return null;
  }
  if (!proposedText) {
    showNotification('El texto propuesto no puede quedar vacío.', true);
    return null;
  }

  return {
    sectionId,
    title,
    originalText: sec.content,
    proposedText,
    reason,
    author: author || 'Ciudadano Colaborador',
    primaryDomain,
    primaryAnalysis,
    requiredDomains,
    mitigatesWeaknessIds: weaknessId ? [weaknessId] : []
  };
}

async function submitSectionProposal(slot, sec, textarea) {
  const payload = collectSectionProposalPayload(slot, sec, textarea);
  if (!payload) return;

  try {
    const res = await fetchJson(`/api/projects/${state.activeProject.id}/proposals`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    state.activeProject = res.project;
    state.editorDirty = false;
    state.sectionViewModes[sec.id] = 'proposals';
    state.selectedSectionProposal[sec.id] = res.proposal.id;
    closeInlineEditor(sec.id);
    renderProjectView();
    showNotification('Propuesta guardada con los cambios marcados palabra por palabra.');
  } catch (err) {
    showNotification(err.message, true);
  }
}

function closeInlineEditor(sectionId) {
  const slot = document.getElementById(`inline-editor-slot-${sectionId}`);
  if (slot) {
    slot.innerHTML = '';
  }
  if (state.activeInlineSectionId === sectionId) {
    state.activeInlineSectionId = null;
    state.editorDirty = false;
  }
}

/* ==========================================================================
   SIMULADOR PARAMÉTRICO MAIN Y COMPARADOR DE RAMAS
   ========================================================================== */

function renderSimulatorSection(p) {
  const sectionEl = document.getElementById('plan-simulator');
  if (!sectionEl) return;

  const branches = p.pilotModel?.branches || [];
  if (branches.length === 0) {
    sectionEl.hidden = true;
    return;
  }

  sectionEl.hidden = false;
  if (!state.simulatorParams) {
    state.simulatorParams = { ...branches[0].parameters };
    state.activeSimulatorBranchId = branches[0].id;
  }

  renderSimulatorControls(p);
  updateSimulatorVisuals(p);
}

function renderSimulatorControls(p) {
  const form = document.getElementById('simulator-controls-form');
  if (!form) return;

  form.innerHTML = `
    <h3 class="simulator-panel-title">Ajusta las opciones</h3>
    <p class="simulator-panel-sub">Mueve los controles o elige una opción de la tabla de arriba para ver cómo cambian los datos en directo.</p>
    ${SIMULATOR_SLIDER_SPECS.map((spec) => {
      const val = state.simulatorParams[spec.key];
      return `
        <div class="sim-slider-field">
          <div class="sim-slider-head">
            <label for="sim-${spec.key}">${escapeHtml(spec.label)}</label>
            <span class="tabular sim-slider-value" id="sim-val-${spec.key}">${val}${escapeHtml(spec.unit)}</span>
          </div>
          <input
            type="range"
            id="sim-${spec.key}"
            data-param="${spec.key}"
            min="${spec.min}"
            max="${spec.max}"
            step="${spec.step}"
            value="${val}"
          />
        </div>
      `;
    }).join('')}
  `;

  form.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.param;
      const spec = SIMULATOR_SLIDER_SPECS.find((s) => s.key === key);
      const num = Number(input.value);
      state.simulatorParams[key] = num;
      state.activeSimulatorBranchId = 'custom';
      const valEl = document.getElementById(`sim-val-${key}`);
      if (valEl && spec) valEl.textContent = `${num}${spec.unit}`;
      updateSimulatorVisuals(state.activeProject);
    });
  });
}

function updateSimulatorVisuals(p) {
  const branches = p.pilotModel?.branches || [];
  const tbody = document.getElementById('simulator-branches-tbody');
  const outputsEl = document.getElementById('simulator-outputs-panel');
  if (!tbody || !outputsEl) return;

  const liveImpact = simulatePlanImpact(state.simulatorParams);
  const liveBridging = evaluateStakeholderSatisfaction(liveImpact, p.weaknesses || []);

  const rows = [
    ...branches.map((branch) => {
      const imp = branch.impact || simulatePlanImpact(branch.parameters);
      const icmnScore = branch.readiness?.totalScore ?? 0;
      const isSelected = state.activeSimulatorBranchId === branch.id;
      return `
        <tr class="branch-row ${isSelected ? 'is-selected' : ''}" data-branch-id="${escapeHtml(branch.id)}" tabindex="0">
          <td><strong>${escapeHtml(branch.shortLabel || branch.name)}</strong></td>
          <td class="tabular">${imp.fiscal.netPublicCostMillionEur} M EUR</td>
          <td class="tabular">+${imp.laborSme.femaleRetentionGainPercent} pp</td>
          <td class="tabular">${imp.laborSme.smeOrganizationalFrictionIndex}/100</td>
          <td class="tabular">${imp.laborSme.retaEffectiveCoveragePercent}%</td>
          <td class="tabular">${imp.socialEquality.coResponsibilityIndex}%</td>
          <td class="tabular">${imp.environmentalTerritorial.avoidedCo2KilotonnesPerYear} kt</td>
          <td class="tabular"><strong>${icmnScore}/100</strong></td>
        </tr>
      `;
    }),
    `
      <tr class="branch-row-live ${state.activeSimulatorBranchId === 'custom' ? 'is-selected' : ''}">
        <td><strong>Tu configuración actual</strong></td>
        <td class="tabular">${liveImpact.fiscal.netPublicCostMillionEur} M EUR</td>
        <td class="tabular">+${liveImpact.laborSme.femaleRetentionGainPercent} pp</td>
        <td class="tabular">${liveImpact.laborSme.smeOrganizationalFrictionIndex}/100</td>
        <td class="tabular">${liveImpact.laborSme.retaEffectiveCoveragePercent}%</td>
        <td class="tabular">${liveImpact.socialEquality.coResponsibilityIndex}%</td>
        <td class="tabular">${liveImpact.environmentalTerritorial.avoidedCo2KilotonnesPerYear} kt</td>
        <td class="tabular">Acuerdo ${liveBridging.consensusBridgeScore}/100</td>
      </tr>
    `
  ];

  tbody.innerHTML = rows.join('');

  tbody.querySelectorAll('tr[data-branch-id]').forEach((row) => {
    const loadBranch = () => {
      const branch = branches.find((b) => b.id === row.dataset.branchId);
      if (!branch) return;
      state.simulatorParams = { ...branch.parameters };
      state.activeSimulatorBranchId = branch.id;
      renderSimulatorControls(state.activeProject);
      updateSimulatorVisuals(state.activeProject);
    };
    row.addEventListener('click', loadBranch);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        loadBranch();
      }
    });
  });

  outputsEl.innerHTML = `
    <div class="sim-kpis">
      <div class="sim-kpi"><span>Coste neto al año</span><strong class="tabular">${liveImpact.fiscal.netPublicCostMillionEur} M EUR</strong><small>${liveImpact.fiscal.netCostPerBeneficiaryEur} EUR por persona</small></div>
      <div class="sim-kpi"><span>Retorno para Hacienda</span><strong class="tabular">${liveImpact.fiscal.inducedFiscalReturnMillionEur} M EUR</strong><small>${liveImpact.fiscal.totalBeneficiaries.toLocaleString('es-ES')} beneficiarios</small></div>
      <div class="sim-kpi"><span>Retención femenina</span><strong class="tabular">+${liveImpact.laborSme.femaleRetentionGainPercent} pp</strong><small>${liveImpact.laborSme.replacementJobsCreatedFte.toLocaleString('es-ES')} empleos a tiempo completo</small></div>
      <div class="sim-kpi"><span>Dificultad pymes / RETA</span><strong class="tabular">${liveImpact.laborSme.smeOrganizationalFrictionIndex}/100</strong><small>Ayuda autónomas: ${liveImpact.laborSme.retaEffectiveCoveragePercent}%</small></div>
      <div class="sim-kpi"><span>Igualdad y cuidados</span><strong class="tabular">${liveImpact.socialEquality.coResponsibilityIndex}%</strong><small>+${liveImpact.socialEquality.additionalCareHoursPerInfant} h de cuidado · Monoparentales: ${liveImpact.socialEquality.monoparentalEquityScore}/100</small></div>
      <div class="sim-kpi"><span>Territorio y CO2</span><strong class="tabular">${liveImpact.environmentalTerritorial.avoidedCo2KilotonnesPerYear} kt/año</strong><small>Viabilidad rural: ${liveImpact.environmentalTerritorial.ruralViabilityIndex}/100</small></div>
    </div>

    <p class="sim-constitutional">
      <strong>Encaje legal:</strong> ${escapeHtml(liveImpact.legalOperational.constitutionalSafeguard)} · Puesta en marcha (INSS): ${liveImpact.legalOperational.implementationMonthsInss} meses.
    </p>

    <div class="bridging-matrix">
      <div class="bridging-head">
        <h3>Acuerdo entre sectores (${liveBridging.satisfiedCount}/${liveBridging.totalStakeholders} conforme)</h3>
        <span class="tabular">Índice de acuerdo: ${liveBridging.consensusBridgeScore}/100</span>
      </div>
      ${liveBridging.stakeholderScores
        .map((st) => {
          const met = st.score >= st.minimumThreshold;
          return `
            <div class="bridging-row">
              <div class="bridging-label">
                <span>${escapeHtml(st.label)}</span>
                <span class="tabular">${st.score}/100 (mín. ${st.minimumThreshold}) · ${met ? 'Conforme' : 'Insuficiente'}</span>
              </div>
              <div class="bridging-bar-track" aria-hidden="true">
                <div class="bridging-bar-fill ${met ? 'is-met' : 'is-below'}" style="width:${st.score}%"></div>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderCommitHistory(p) {
  const list = document.getElementById('plan-commits-list');
  if (!list) return;

  const commits = p.commitHistory || [];
  if (commits.length === 0) {
    list.innerHTML = `<li class="entry-empty">Todavía no hay cambios incorporados.</li>`;
    return;
  }

  list.innerHTML = commits
    .map((c) => {
      const authors = (c.coAuthors || []).join(', ') || 'Equipo redactor';
      return `
        <li class="commit-entry">
          <div class="commit-meta tabular">
            <span>${escapeHtml(c.commitId)}</span>
            <span>${escapeHtml(c.date)}</span>
          </div>
          <div class="commit-body">
            <h3>${escapeHtml(c.title)}</h3>
            <p>Participaron: ${escapeHtml(authors)}</p>
          </div>
        </li>
      `;
    })
    .join('');
}

/* ==========================================================================
   PANELES DESLIZANTES, CO-AUTORÍA, DEBILIDADES Y TRAMPA DE FOCO
   ========================================================================== */

function getFocusableElements(container) {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...container.querySelectorAll(selector)].filter(
    (el) => el.offsetParent !== null && !el.closest('[hidden]')
  );
}

function setDrawerOpen(drawerId, isOpen) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;

  if (isOpen && document.activeElement instanceof HTMLElement && !drawer.contains(document.activeElement)) {
    state.lastFocusedElement = document.activeElement;
  }

  drawer.classList.toggle('is-open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  drawer.inert = !isOpen;

  const anyOpen = document.querySelector('.drawer.is-open') !== null;
  document.getElementById('drawer-backdrop')?.classList.toggle('is-open', anyOpen);

  if (isOpen) {
    const focusables = getFocusableElements(drawer);
    (focusables[0] || drawer).focus({ preventScroll: true });
  } else if (!anyOpen && state.lastFocusedElement instanceof HTMLElement && state.lastFocusedElement.isConnected) {
    state.lastFocusedElement.focus({ preventScroll: true });
    state.lastFocusedElement = null;
  }
}

function openSidebarDrawer() {
  setDrawerOpen('sidebar-drawer', true);
}

function closeAllDrawers() {
  setDrawerOpen('sidebar-drawer', false);
  setDrawerOpen('project-composer', false);
}

function jumpToSectionFromDrawer(sectionId) {
  if (!sectionId) return;
  closeAllDrawers();
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('is-highlighted');
    window.setTimeout(() => target.classList.remove('is-highlighted'), 2000);
  }
}

function populateDrawerSelects(p) {
  const sections = p.monograph || [];
  const sectionOptions = sections
    .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`)
    .join('');

  const wSec = document.getElementById('weakness-section');
  if (wSec) wSec.innerHTML = sectionOptions;

  const oSec = document.getElementById('opinion-section');
  if (oSec) {
    oSec.innerHTML = `<option value="">Todo el plan</option>${sectionOptions}`;
  }

  const wDom = document.getElementById('weakness-domain');
  if (wDom && wDom.options.length === 0) {
    wDom.innerHTML = Object.values(POLICY_DOMAINS)
      .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.label)}</option>`)
      .join('');
  }
}

function sectionTitleById(p, sectionId) {
  const sec = (p.monograph || []).find((s) => s.id === sectionId);
  return sec ? sec.title : sectionId;
}

function submitProposalToGitHub(prop) {
  const p = state.activeProject;
  if (!p || !prop) return;
  const primaryDomain = prop.coveredDomains?.[0] || '';
  submitToGitHub('enmienda', {
    projectId: p.id,
    projectTitle: p.title,
    sectionId: prop.sectionId,
    sectionTitle: sectionTitleById(p, prop.sectionId),
    title: prop.title,
    author: prop.author,
    authorRole: prop.coAuthors?.[0]?.role || 'Proponente',
    reason: prop.reason,
    requiredDomains: prop.requiredDomains || [],
    primaryDomain,
    primaryAnalysis: primaryDomain ? prop.domainAnalyses?.[primaryDomain] || '' : '',
    mitigatesWeaknessIds: prop.mitigatesWeaknessIds || [],
    originalText: prop.originalText,
    proposedText: prop.proposedText
  });
}

function renderDrawerProposalsList(p) {
  const container = document.getElementById('side-proposals-list');
  if (!container) return;

  const proposals = p.proposals || [];
  if (proposals.length === 0) {
    container.innerHTML = `<p class="entry-empty">Todavía no hay propuestas. Pulsa «Proponer cambios» en cualquier apartado para añadir una.</p>`;
    return;
  }

  container.innerHTML = proposals
    .map((prop) => {
      const diff = (prop.diff || []).filter((d) => d.type !== 'unchanged');
      const pending = prop.pendingDomains || [];
      const covered = prop.coveredDomains || [];
      const isConsolidated = prop.status === 'Consolidada' || prop.maturityLevel?.level === 4;
      const coAuthorsText = (prop.coAuthors || [])
        .map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`)
        .join(', ');

      const domainSelectOptions = (pending.length > 0 ? pending : Object.keys(POLICY_DOMAINS))
        .map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(POLICY_DOMAINS[d]?.label || d)}</option>`)
        .join('');

      return `
        <article class="entry" id="drawer-prop-${escapeHtml(prop.id)}">
          <p class="kicker">${escapeHtml(prop.status)} · ${escapeHtml(prop.createdAt)}</p>
          <h3 class="entry-title">${escapeHtml(prop.title)}</h3>
          <p class="entry-meta">
            <button type="button" class="link-inline btn-jump-section" data-section-id="${escapeHtml(prop.sectionId)}">${escapeHtml(sectionTitleById(p, prop.sectionId))}</button>
            · Autores: ${escapeHtml(coAuthorsText || prop.author)}
          </p>
          <p class="entry-domains">
            <span>Analizadas (${covered.length}): ${escapeHtml(covered.map((d) => POLICY_DOMAINS[d]?.label || d).join(', ') || 'Ninguna')}</span>
            ${pending.length > 0 ? `<br /><span>Faltan (${pending.length}): ${escapeHtml(pending.map((d) => POLICY_DOMAINS[d]?.label || d).join(', '))}</span>` : ''}
          </p>

          ${diff.length > 0 ? `<div class="diff-view">${diffRowsHtml(diff)}</div>` : ''}
          ${prop.reason ? `<p class="entry-reason">${escapeHtml(prop.reason)}</p>` : ''}

          <div class="entry-actions">
            ${!isConsolidated && pending.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm btn-toggle-coauthor" data-prop-id="${escapeHtml(prop.id)}">Completar análisis</button>` : ''}
            ${!isConsolidated && pending.length === 0 ? `<button type="button" class="btn btn-primary btn-sm btn-consolidate-prop" data-prop-id="${escapeHtml(prop.id)}">Incorporar al texto actual</button>` : ''}
            <button type="button" class="btn btn-quiet btn-sm btn-github-drawer-prop" data-prop-id="${escapeHtml(prop.id)}">Enviar a GitHub</button>
          </div>

          <form class="inline-form coauthor-form" id="coauthor-form-${escapeHtml(prop.id)}" data-prop-id="${escapeHtml(prop.id)}" hidden>
            <div class="field">
              <label for="co-domain-${escapeHtml(prop.id)}">Área que falta por revisar</label>
              <select id="co-domain-${escapeHtml(prop.id)}">${domainSelectOptions}</select>
            </div>
            <div class="field-split">
              <div class="field">
                <label for="co-name-${escapeHtml(prop.id)}">Tu nombre</label>
                <input type="text" id="co-name-${escapeHtml(prop.id)}" required placeholder="Ej. Javier S." />
              </div>
              <div class="field">
                <label for="co-role-${escapeHtml(prop.id)}">Tu perfil o profesión (opcional)</label>
                <input type="text" id="co-role-${escapeHtml(prop.id)}" placeholder="Ej. Economista" />
              </div>
            </div>
            <div class="field">
              <label for="co-analysis-${escapeHtml(prop.id)}">Tu análisis para esta área</label>
              <textarea id="co-analysis-${escapeHtml(prop.id)}" rows="2" required placeholder="Cuánto cuesta, cómo encaja en la ley o cómo funcionaría en la práctica..."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-sm">Guardar análisis</button>
              <button type="button" class="btn btn-ghost btn-sm btn-github-coauthor" data-prop-id="${escapeHtml(prop.id)}">Enviar a GitHub</button>
              <button type="button" class="btn btn-quiet btn-sm btn-cancel-coauthor" data-prop-id="${escapeHtml(prop.id)}">Cancelar</button>
            </div>
          </form>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-jump-section').forEach((btn) => {
    btn.addEventListener('click', () => jumpToSectionFromDrawer(btn.dataset.sectionId));
  });

  container.querySelectorAll('.btn-toggle-coauthor').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`coauthor-form-${btn.dataset.propId}`);
      if (form) form.hidden = !form.hidden;
    });
  });

  container.querySelectorAll('.btn-cancel-coauthor').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`coauthor-form-${btn.dataset.propId}`);
      if (form) form.hidden = true;
    });
  });

  container.querySelectorAll('.coauthor-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const propId = form.dataset.propId;
      try {
        const res = await fetchJson(
          `/api/projects/${state.activeProject.id}/proposals/${propId}/coauthor`,
          {
            method: 'POST',
            body: JSON.stringify({
              domain: document.getElementById(`co-domain-${propId}`).value,
              contributorName: document.getElementById(`co-name-${propId}`).value,
              contributorRole: document.getElementById(`co-role-${propId}`).value,
              analysisText: document.getElementById(`co-analysis-${propId}`).value
            })
          }
        );
        state.activeProject = res.project;
        renderProjectView();
        showNotification('Análisis añadido a la propuesta.');
      } catch (err) {
        showNotification(err.message, true);
      }
    });
  });

  container.querySelectorAll('.btn-github-coauthor').forEach((btn) => {
    btn.addEventListener('click', () => {
      const propId = btn.dataset.propId;
      const domain = document.getElementById(`co-domain-${propId}`)?.value || '';
      const contributorName = document.getElementById(`co-name-${propId}`)?.value.trim() || '';
      const contributorRole = document.getElementById(`co-role-${propId}`)?.value.trim() || '';
      const analysisText = document.getElementById(`co-analysis-${propId}`)?.value.trim() || '';
      if (!contributorName || !analysisText) {
        showNotification('Escribe tu nombre y tu análisis antes de enviar a GitHub.', true);
        return;
      }
      submitToGitHub('coautoria', {
        projectId: state.activeProject.id,
        projectTitle: state.activeProject.title,
        proposalId: propId,
        domain,
        contributorName,
        contributorRole,
        analysisText
      });
    });
  });

  container.querySelectorAll('.btn-consolidate-prop').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetchJson(
          `/api/projects/${state.activeProject.id}/proposals/${btn.dataset.propId}/consolidate`,
          { method: 'POST', body: JSON.stringify({}) }
        );
        state.activeProject = res.project;
        renderProjectView();
        showNotification('Propuesta incorporada al texto del plan.');
      } catch (err) {
        showNotification(err.message, true);
      }
    });
  });

  container.querySelectorAll('.btn-github-drawer-prop').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prop = (state.activeProject?.proposals || []).find((pr) => pr.id === btn.dataset.propId);
      if (prop) submitProposalToGitHub(prop);
    });
  });
}

function renderDrawerWeaknessesList(p) {
  const container = document.getElementById('side-weaknesses-entries');
  if (!container) return;

  const weaknesses = [...(p.weaknesses || [])].sort((a, b) => {
    const rank = { critica: 0, alta: 1, moderada: 2 };
    const aOpen = a.status === 'mitigada' ? 10 : 0;
    const bOpen = b.status === 'mitigada' ? 10 : 0;
    return aOpen + (rank[a.severity] ?? 3) - (bOpen + (rank[b.severity] ?? 3));
  });

  if (weaknesses.length === 0) {
    container.innerHTML = `<p class="entry-empty">Todavía no hay puntos débiles señalados.</p>`;
    return;
  }

  container.innerHTML = weaknesses
    .map((w) => {
      const sevLabel = SEVERITY_LABELS[w.severity] || w.severity;
      const statusLabel = WEAKNESS_STATUS_LABELS[w.status] || w.status;
      const domLabel = POLICY_DOMAINS[w.domain]?.label || w.domain;
      return `
        <article class="entry">
          <p class="kicker">${escapeHtml(sevLabel)} · ${escapeHtml(statusLabel)} · ${escapeHtml(w.createdAt)}</p>
          <h3 class="entry-title">${escapeHtml(w.title)}</h3>
          <p class="entry-meta">
            <button type="button" class="link-inline btn-jump-section" data-section-id="${escapeHtml(w.sectionId)}">${escapeHtml(sectionTitleById(p, w.sectionId))}</button>
            · ${escapeHtml(domLabel)}
          </p>
          <p class="entry-text">${escapeHtml(w.description)}</p>
          <p class="entry-reason">Perjudica a: ${escapeHtml(w.affectedGroup)} · Aviso de: ${escapeHtml(w.reportedBy)}</p>
          ${w.resolutionNote ? `<p class="entry-reason">Cómo se resolvió: ${escapeHtml(w.resolutionNote)}</p>` : ''}
          <div class="entry-actions">
            <button type="button" class="btn btn-quiet btn-sm btn-github-weakness-item" data-weakness-id="${escapeHtml(w.id)}">Enviar a GitHub</button>
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-jump-section').forEach((btn) => {
    btn.addEventListener('click', () => jumpToSectionFromDrawer(btn.dataset.sectionId));
  });

  container.querySelectorAll('.btn-github-weakness-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = (state.activeProject?.weaknesses || []).find((item) => item.id === btn.dataset.weaknessId);
      if (!w) return;
      submitToGitHub('debilidad', {
        projectId: state.activeProject.id,
        projectTitle: state.activeProject.title,
        sectionId: w.sectionId,
        sectionTitle: sectionTitleById(state.activeProject, w.sectionId),
        severity: w.severity,
        domain: w.domain,
        affectedGroup: w.affectedGroup,
        title: w.title,
        description: w.description,
        reportedBy: w.reportedBy
      });
    });
  });
}

function renderDrawerOpinionsList(p) {
  const container = document.getElementById('side-opinions-entries');
  if (!container) return;

  const opinions = p.opinions || [];
  if (opinions.length === 0) {
    container.innerHTML = `<p class="entry-empty">Todavía no hay opiniones.</p>`;
    return;
  }

  container.innerHTML = opinions
    .map((op) => {
      const secButton = op.sectionId
        ? `<p class="entry-meta"><button type="button" class="link-inline btn-jump-section" data-section-id="${escapeHtml(op.sectionId)}">${escapeHtml(sectionTitleById(p, op.sectionId))}</button></p>`
        : '';
      return `
        <article class="entry">
          <p class="kicker">${escapeHtml(op.type)} · ${escapeHtml(op.author || 'Ciudadano')} · ${escapeHtml(op.createdAt)}</p>
          ${secButton}
          <p class="entry-text">${escapeHtml(op.text)}</p>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-jump-section').forEach((btn) => {
    btn.addEventListener('click', () => jumpToSectionFromDrawer(btn.dataset.sectionId));
  });
}

function updateDrawerCounts(p) {
  const pCount = (p.proposals || []).length;
  const wCount = (p.weaknesses || []).length;
  const oCount = (p.opinions || []).length;

  document.getElementById('count-proposals').textContent = String(pCount);
  document.getElementById('count-weaknesses').textContent = String(wCount);
  document.getElementById('count-opinions').textContent = String(oCount);
  document.getElementById('top-count-total').textContent = String(pCount + wCount + oCount);
  document.getElementById('plan-proposals-count').textContent = String(pCount);
}

function selectSideTab(side) {
  state.activeSideTab = side;
  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    const isActive = tab.dataset.side === side;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });
  document.getElementById('side-proposals-list').hidden = side !== 'proposals';
  document.getElementById('side-weaknesses-list').hidden = side !== 'weaknesses';
  document.getElementById('side-opinions-list').hidden = side !== 'opinions';
}

/* ==========================================================================
   PROGRESO DE LECTURA, ÍNDICE Y MÉTODO
   ========================================================================== */

function updateReadingProgress() {
  if (document.body.dataset.view !== 'project') return;

  const article = document.getElementById('view-project');
  const fill = document.getElementById('reading-progress');
  const scrollable = article.offsetHeight - window.innerHeight;
  const ratio = scrollable > 0 ? Math.min(1, Math.max(0, (window.scrollY - article.offsetTop) / scrollable)) : 1;
  fill.style.transform = `scaleX(${ratio})`;

  highlightCurrentSection();
}

function highlightCurrentSection() {
  const links = [...document.querySelectorAll('#plan-toc-list a')];
  const threshold = window.innerHeight * 0.3;
  let currentId = links[0]?.dataset.target;

  for (const link of links) {
    const section = document.getElementById(link.dataset.target);
    if (section && section.getBoundingClientRect().top <= threshold) {
      currentId = link.dataset.target;
    }
  }
  links.forEach((link) => link.classList.toggle('is-current', link.dataset.target === currentId));
}

function setupMethodScrolly() {
  const steps = document.querySelectorAll('#method-scrolly .scrolly-step');
  const panels = document.querySelectorAll('#method-scrolly .visual-panel');
  if (steps.length === 0 || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry) => {
          const step = entry.target.dataset.step;
          steps.forEach((s) => s.classList.toggle('is-active', s.dataset.step === step));
          panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === step));
        });
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  steps.forEach((step) => observer.observe(step));
}

/* ==========================================================================
   EVENTOS GLOBALES
   ========================================================================== */

function setupCatalogFilters() {
  const filterGroup = document.getElementById('filter-buttons-group');
  filterGroup?.querySelectorAll('.segmented-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterGroup.querySelectorAll('.segmented-option').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      state.currentFilter = btn.dataset.filter || 'all';
      loadLandingData();
    });
  });

  const searchInput = document.getElementById('catalog-search');
  let searchTimer = 0;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.currentQuery = searchInput.value.trim();
      loadLandingData();
    }, 150);
  });

  document.getElementById('catalog-category')?.addEventListener('change', (e) => {
    state.currentCategory = e.target.value || 'all';
    loadLandingData();
  });
}

function setupProjectComposer() {
  const projectForm = document.getElementById('form-new-project');
  document.getElementById('btn-toggle-project-form')?.addEventListener('click', () => {
    document.getElementById('project-source-seed-id').value = '';
    setDrawerOpen('project-composer', true);
  });
  document.getElementById('btn-cancel-project')?.addEventListener('click', () => {
    setDrawerOpen('project-composer', false);
  });

  const readComposerPayload = () => {
    const value = (id) => document.getElementById(id).value;
    return {
      title: value('project-title'),
      category: value('project-category'),
      code: value('project-code'),
      author: value('project-author') || 'Iniciativa Ciudadana',
      summary: value('project-summary'),
      initialContent: value('project-initial-content'),
      measuresContent: value('project-measures-content'),
      impactContent: value('project-impact-content'),
      sourceSeedId: value('project-source-seed-id') || null
    };
  };

  document.getElementById('btn-submit-project-github')?.addEventListener('click', () => {
    const payload = readComposerPayload();
    if (!payload.title.trim() || !payload.summary.trim()) {
      showNotification('Pon al menos un título y un resumen antes de enviarlo a GitHub.', true);
      return;
    }
    submitToGitHub('plan', payload);
  });

  projectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/projects', {
        method: 'POST',
        body: JSON.stringify(readComposerPayload())
      });

      projectForm.reset();
      document.getElementById('project-source-seed-id').value = '';
      setDrawerOpen('project-composer', false);
      showNotification('Plan guardado en tu borrador.');
      window.location.hash = `#plan/${res.project.id}`;
    } catch (err) {
      showNotification(err.message, true);
    }
  });
}

function setupSeedForm() {
  const seedForm = document.getElementById('form-new-seed');
  document.getElementById('btn-toggle-seed-form')?.addEventListener('click', () => {
    seedForm.hidden = !seedForm.hidden;
    if (!seedForm.hidden) {
      seedForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('seed-title')?.focus({ preventScroll: true });
    }
  });
  document.getElementById('btn-cancel-seed')?.addEventListener('click', () => {
    seedForm.hidden = true;
  });

  const readSeedPayload = () => ({
    title: document.getElementById('seed-title').value,
    category: document.getElementById('seed-category').value,
    author: document.getElementById('seed-author').value || 'Ciudadano Proponente',
    description: document.getElementById('seed-description').value
  });

  document.getElementById('btn-submit-seed-github')?.addEventListener('click', () => {
    const payload = readSeedPayload();
    if (!payload.title.trim() || !payload.description.trim()) {
      showNotification('Pon un título y explica tu idea antes de enviarla a GitHub.', true);
      return;
    }
    submitToGitHub('idea', payload);
  });

  seedForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await fetchJson('/api/seeds', {
        method: 'POST',
        body: JSON.stringify(readSeedPayload())
      });

      seedForm.reset();
      seedForm.hidden = true;
      state.seeds = res.seeds || [];
      renderSeedsList();
      renderCatalogLedger();
      showNotification('Idea guardada en tu borrador.');
    } catch (err) {
      showNotification(err.message, true);
    }
  });
}

function setupDebateDrawer() {
  document.getElementById('btn-open-sidebar-drawer')?.addEventListener('click', openSidebarDrawer);
  document.getElementById('btn-close-sidebar-drawer')?.addEventListener('click', () => {
    setDrawerOpen('sidebar-drawer', false);
  });
  document.getElementById('drawer-backdrop')?.addEventListener('click', closeAllDrawers);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDrawers();
      return;
    }
    if (e.key === 'Tab') {
      const openDrawer = document.querySelector('.drawer.is-open');
      if (!openDrawer) return;
      const focusables = getFocusableElements(openDrawer);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    tab.addEventListener('click', () => selectSideTab(tab.dataset.side));
  });

  // Formulario de debilidad estructurada
  const weakForm = document.getElementById('form-new-weakness');
  document.getElementById('btn-open-weakness-drawer-form')?.addEventListener('click', () => {
    weakForm.hidden = !weakForm.hidden;
    if (!weakForm.hidden) document.getElementById('weakness-title')?.focus();
  });
  document.getElementById('btn-cancel-weakness')?.addEventListener('click', () => {
    weakForm.hidden = true;
  });

  const readWeaknessPayload = () => ({
    title: document.getElementById('weakness-title').value,
    severity: document.getElementById('weakness-severity').value,
    domain: document.getElementById('weakness-domain').value,
    sectionId: document.getElementById('weakness-section').value,
    affectedGroup: document.getElementById('weakness-group').value,
    description: document.getElementById('weakness-description').value,
    reportedBy: document.getElementById('weakness-author').value || 'Auditor Ciudadano'
  });

  document.getElementById('btn-submit-weakness-github')?.addEventListener('click', () => {
    if (!state.activeProject) return;
    const payload = readWeaknessPayload();
    if (!payload.title.trim() || !payload.description.trim()) {
      showNotification('Pon un título y explica el fallo antes de enviarlo a GitHub.', true);
      return;
    }
    submitToGitHub('debilidad', {
      ...payload,
      projectId: state.activeProject.id,
      projectTitle: state.activeProject.title,
      sectionTitle: sectionTitleById(state.activeProject, payload.sectionId)
    });
  });

  weakForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeProject) return;
    try {
      const res = await fetchJson(`/api/projects/${state.activeProject.id}/weaknesses`, {
        method: 'POST',
        body: JSON.stringify(readWeaknessPayload())
      });
      state.activeProject = res.project;
      weakForm.reset();
      weakForm.hidden = true;
      renderProjectView();
      selectSideTab('weaknesses');
      showNotification('Fallo guardado y nota de calidad (ICMN) actualizada.');
    } catch (err) {
      showNotification(err.message, true);
    }
  });

  // Formulario de opinión
  const opinForm = document.getElementById('form-new-opinion');
  document.getElementById('btn-open-opinion-drawer-form')?.addEventListener('click', () => {
    opinForm.hidden = !opinForm.hidden;
    if (!opinForm.hidden) document.getElementById('opinion-text')?.focus();
  });
  document.getElementById('btn-cancel-opinion')?.addEventListener('click', () => {
    opinForm.hidden = true;
  });

  opinForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeProject) return;
    try {
      const res = await fetchJson(`/api/projects/${state.activeProject.id}/opinions`, {
        method: 'POST',
        body: JSON.stringify({
          type: document.getElementById('opinion-type').value,
          sectionId: document.getElementById('opinion-section').value || undefined,
          text: document.getElementById('opinion-text').value,
          author: document.getElementById('opinion-author').value || 'Ciudadano Participante'
        })
      });

      state.activeProject = res.project;
      opinForm.reset();
      opinForm.hidden = true;
      renderProjectView();
      selectSideTab('opinions');
      showNotification('Opinión publicada en el debate.');
    } catch (err) {
      showNotification(err.message, true);
    }
  });
}

function setupPlanExportAndReset() {
  document.getElementById('btn-export-md')?.addEventListener('click', () => {
    if (!state.activeProject) return;
    downloadTextFile(
      `${state.activeProject.id}.md`,
      exportProjectAsMarkdown(state.activeProject),
      'text/markdown; charset=utf-8'
    );
  });

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    if (!state.activeProject) return;
    downloadTextFile(
      `${state.activeProject.id}.json`,
      exportProjectAsJson(state.activeProject),
      'application/json; charset=utf-8'
    );
  });

  document.getElementById('btn-reset-local-drafts')?.addEventListener('click', async () => {
    if (!window.confirm('¿Quieres descartar tu borrador local y volver al catálogo original?')) {
      return;
    }
    try {
      await clearLocalDrafts();
      updatePersistenceBanner();
      showNotification('Borrador local descartado. Hemos vuelto al catálogo original.');
      if (document.body.dataset.view === 'project' && state.activeProject) {
        await openProjectView(state.activeProject.id);
      } else {
        await loadLandingData();
      }
    } catch (err) {
      showNotification(err.message, true);
    }
  });
}

function setupEventListeners() {
  window.addEventListener('hashchange', handleRouting);

  let progressFrame = 0;
  window.addEventListener(
    'scroll',
    () => {
      if (progressFrame) return;
      progressFrame = window.requestAnimationFrame(() => {
        progressFrame = 0;
        updateReadingProgress();
      });
    },
    { passive: true }
  );

  setupCatalogFilters();
  setupProjectComposer();
  setupSeedForm();
  setupDebateDrawer();
  setupPlanExportAndReset();
  setupMethodScrolly();
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updatePersistenceBanner();
  handleRouting();
});
