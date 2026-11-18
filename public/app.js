/**
 * Cliente interactivo para Democracia Colaborativa (Ágora Normativa).
 * Gestiona el catálogo multiproyecto, creación de planes, lectura monográfica,
 * editor en línea por sección y paneles deslizantes bajo demanda.
 */

import { isStaticHost, requestStaticApi } from './staticStore.js';

const LANDING_ANCHORS = new Set(['catalogo', 'metodo', 'ideas']);
const READING_WORDS_PER_MINUTE = 200;
const TOAST_DURATION_MS = 5000;
const DEFAULT_DOCUMENT_TITLE = document.title;

const state = {
  currentFilter: 'all',
  projects: [],
  catalogTotals: { projects: 0, proposals: 0, opinions: 0 },
  seeds: [],
  activeProject: null,
  activeSideTab: 'proposals',
  activeInlineSectionId: null,
  sectionViewModes: {}
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function computeClientDiff(originalText = '', proposedText = '') {
  const origLines = String(originalText).split('\n').map((l) => l.trim()).filter(Boolean);
  const propLines = String(proposedText).split('\n').map((l) => l.trim()).filter(Boolean);
  const origSet = new Set(origLines);
  const propSet = new Set(propLines);
  const diff = [];

  for (const line of origLines) {
    diff.push({ type: propSet.has(line) ? 'unchanged' : 'removed', text: line });
  }
  for (const line of propLines) {
    if (!origSet.has(line)) {
      diff.push({ type: 'added', text: line });
    }
  }
  return diff;
}

function diffRowsHtml(diff) {
  return diff
    .map((d, idx) => {
      const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '−' : ' ';
      return `
        <div class="diff-row ${d.type}">
          <span class="diff-num">${idx + 1}</span>
          <span class="diff-text">${escapeHtml(`${prefix} ${d.text}`)}</span>
        </div>
      `;
    })
    .join('');
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

async function fetchJson(url, options = {}) {
  const apiUrl = url.startsWith('/') ? url.slice(1) : url;
  if (isStaticHost()) {
    return requestStaticApi(url, options, computeClientDiff);
  }

  try {
    const response = await fetch(apiUrl, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return requestStaticApi(url, options, computeClientDiff);
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error en la solicitud al servidor');
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      return requestStaticApi(url, options, computeClientDiff);
    }
    throw err;
  }
}

/* ==========================================================================
   ENRUTAMIENTO
   ========================================================================== */

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
    const filtered = await fetchJson(`/api/projects?filter=${encodeURIComponent(state.currentFilter)}`);
    const unfiltered =
      state.currentFilter === 'all' ? filtered : await fetchJson('/api/projects?filter=all');

    state.projects = filtered.projects || [];
    state.seeds = filtered.seeds || [];
    state.catalogTotals = summarizeCatalog(unfiltered.projects || []);
    renderLandingView();
  } catch (err) {
    showNotification(err.message, true);
  }
}

function summarizeCatalog(projects) {
  return projects.reduce(
    (totals, p) => ({
      projects: totals.projects + 1,
      proposals: totals.proposals + (p.proposalsCount || 0),
      opinions: totals.opinions + (p.opinionsCount || 0)
    }),
    { projects: 0, proposals: 0, opinions: 0 }
  );
}

async function openProjectView(projectId) {
  setActiveRoute('project');
  window.scrollTo({ top: 0 });
  state.activeInlineSectionId = null;

  try {
    const data = await fetchJson(`/api/projects/${encodeURIComponent(projectId)}`);
    state.activeProject = data.project;
    renderProjectView();
    updateReadingProgress();
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
  renderProjectsGrid();
  renderSeedsList();
}

function renderCatalogLedger() {
  const { projects, proposals, opinions } = state.catalogTotals;
  document.getElementById('ledger-projects').textContent = String(projects);
  document.getElementById('ledger-proposals').textContent = String(proposals);
  document.getElementById('ledger-opinions').textContent = String(opinions);
  document.getElementById('ledger-seeds').textContent = String(state.seeds.length);
}

/**
 * Alterna filas 7:5 y 4:8 para mantener jerarquía asimétrica;
 * una tarjeta sin pareja ocupa la fila completa.
 */
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
  const total = (p.proposalsCount || 0) + (p.opinionsCount || 0);
  return total === 1 ? '1 aportación' : `${total} aportaciones`;
}

function renderProjectsGrid() {
  const container = document.getElementById('projects-grid');
  if (!container) return;

  if (state.projects.length === 0) {
    container.innerHTML = `<p class="empty-note">No se encontraron planes para este filtro.</p>`;
    return;
  }

  const spans = bentoSpansFor(state.projects.length);
  container.innerHTML = state.projects
    .map((p, idx) => {
      const span = spans[idx];
      const variant = span === 12 ? 'bento-wide' : span >= 7 ? 'bento-featured' : '';
      return `
        <article class="bento-cell span-${span} ${variant}" style="animation-delay:${idx * 60}ms">
          <p class="kicker">${escapeHtml(p.stage)} · ${participationLabel(p)}</p>
          <h3 class="bento-title">
            <a href="#plan/${escapeHtml(p.id)}">${escapeHtml(p.title)}</a>
          </h3>
          <p class="bento-summary">${escapeHtml(p.summary)}</p>
        </article>
      `;
    })
    .join('');
}

function renderSeedsList() {
  const container = document.getElementById('seeds-cards-container');
  if (!container) return;

  if (state.seeds.length === 0) {
    container.innerHTML = `<li class="empty-note">No hay ideas registradas todavía.</li>`;
    return;
  }

  container.innerHTML = state.seeds
    .map((s) => {
      return `
        <li class="idea-entry">
          <p class="kicker">${escapeHtml(s.category)} · ${escapeHtml(s.author || 'Ciudadano')}</p>
          <h3 class="idea-title">${escapeHtml(s.title)}</h3>
          <p class="idea-desc">${escapeHtml(s.description)}</p>
        </li>
      `;
    })
    .join('');
}

/* ==========================================================================
   LECTURA DEL PLAN
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

  document.title = `${p.title} | Democracia Colaborativa`;
  document.getElementById('topbar-plan-code').textContent = p.code;
  document.getElementById('project-meta-pills').textContent = `${p.category} · ${p.stage}`;
  document.getElementById('plan-title').textContent = p.title;
  document.getElementById('plan-summary').textContent = p.summary;
  document.getElementById('plan-code').textContent = p.code;
  document.getElementById('plan-sections-count').textContent = String((p.monograph || []).length);
  document.getElementById('plan-reading-time').textContent = `${estimateReadingMinutes(p)} min`;

  renderMonographSections(p);
  renderDrawerProposalsList(p);
  renderDrawerOpinionsList(p);
  updateDrawerCounts(p);
}

function getSectionAccumulatedInfo(p, section) {
  const proposals = (p.proposals || []).filter((prop) => prop.sectionId === section.id);
  if (proposals.length === 0) {
    return {
      hasProposals: false,
      proposalsCount: 0,
      addedLines: 0,
      removedLines: 0,
      text: section.content,
      diff: []
    };
  }

  // La propuesta más reciente representa el estado acumulado
  const latestProposal = proposals[0];
  const diff = computeClientDiff(section.content, latestProposal.proposedText);

  return {
    hasProposals: true,
    proposalsCount: proposals.length,
    addedLines: diff.filter((d) => d.type === 'added').length,
    removedLines: diff.filter((d) => d.type === 'removed').length,
    text: latestProposal.proposedText,
    diff
  };
}

function revisionBarHtml(sec, accumulated, currentMode) {
  const modes = [
    ['original', 'Original'],
    ['proposed', 'Con cambios'],
    ['diff', 'Diferencias']
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

  const plural = accumulated.proposalsCount === 1 ? 'propuesta acumulada' : 'propuestas acumuladas';
  return `
    <div class="revision-bar">
      <p class="revision-summary">
        <span class="tabular">${accumulated.proposalsCount} ${plural}</span>
        <span class="revision-delta tabular">
          <span class="delta-add">+${accumulated.addedLines}</span>
          <span class="delta-del">−${accumulated.removedLines}</span>
        </span>
      </p>
      <div class="segmented" role="group" aria-label="Versión del texto">${options}</div>
    </div>
  `;
}

function sectionBodyHtml(sec, accumulated, currentMode) {
  if (currentMode === 'diff' && accumulated.hasProposals) {
    return `<div class="diff-view">${diffRowsHtml(accumulated.diff)}</div>`;
  }
  const text = currentMode === 'proposed' && accumulated.hasProposals ? accumulated.text : sec.content;
  return `<div class="monograph-text" id="text-sec-${escapeHtml(sec.id)}">${escapeHtml(text)}</div>`;
}

function renderMonographSections(p) {
  const container = document.getElementById('monograph-sections-container');
  if (!container) return;

  const sections = p.monograph || [];
  container.innerHTML = sections
    .map((sec) => {
      const accumulated = getSectionAccumulatedInfo(p, sec);
      const currentMode =
        state.sectionViewModes[sec.id] || (accumulated.hasProposals ? 'proposed' : 'original');

      return `
        <section class="monograph-section" id="section-${escapeHtml(sec.id)}" aria-labelledby="title-sec-${escapeHtml(sec.id)}">
          <header class="monograph-section-header">
            <h2 class="monograph-section-title" id="title-sec-${escapeHtml(sec.id)}">${escapeHtml(sec.title)}</h2>
            <button type="button" class="btn btn-ghost btn-propose-inline" data-section-id="${escapeHtml(sec.id)}">
              Editar redacción
            </button>
          </header>
          ${accumulated.hasProposals ? revisionBarHtml(sec, accumulated, currentMode) : ''}
          ${sectionBodyHtml(sec, accumulated, currentMode)}
          <div id="inline-editor-slot-${escapeHtml(sec.id)}"></div>
        </section>
      `;
    })
    .join('');

  renderTableOfContents(p);

  container.querySelectorAll('.diff-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sectionViewModes[btn.dataset.sec] = btn.dataset.mode;
      renderMonographSections(state.activeProject);
    });
  });

  container.querySelectorAll('.btn-propose-inline').forEach((btn) => {
    btn.addEventListener('click', () => toggleSectionEditor(btn.dataset.sectionId));
  });
}

function renderTableOfContents(p) {
  const list = document.getElementById('plan-toc-list');
  if (!list) return;

  list.innerHTML = (p.monograph || [])
    .map((sec) => {
      const count = (p.proposals || []).filter((prop) => prop.sectionId === sec.id).length;
      const countHtml = count > 0 ? `<span class="toc-count tabular" title="Propuestas de cambio">${count}</span>` : '';
      return `
        <li>
          <a href="#plan/${escapeHtml(p.id)}" data-target="section-${escapeHtml(sec.id)}">
            <span>${escapeHtml(sec.title)}</span>${countHtml}
          </a>
        </li>
      `;
    })
    .join('');

  // Los enlaces del índice desplazan sin alterar el hash de la ruta del plan
  list.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(link.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ==========================================================================
   EDITOR EN LÍNEA POR SECCIÓN
   ========================================================================== */

function lineNumbersFor(text) {
  const lines = (text.match(/\n/g) || []).length + 1;
  return { lines, gutter: Array.from({ length: lines }, (_, i) => i + 1).join('\n') };
}

function toggleSectionEditor(sectionId) {
  if (state.activeInlineSectionId && state.activeInlineSectionId !== sectionId) {
    closeInlineEditor(state.activeInlineSectionId);
  }

  const slot = document.getElementById(`inline-editor-slot-${sectionId}`);
  if (!slot) return;

  if (state.activeInlineSectionId === sectionId) {
    closeInlineEditor(sectionId);
    return;
  }

  const sec = (state.activeProject?.monograph || []).find((s) => s.id === sectionId);
  if (!sec) return;
  state.activeInlineSectionId = sectionId;

  // Se edita directamente sobre el texto acumulado existente
  const workingText = getSectionAccumulatedInfo(state.activeProject, sec).text;
  const { lines, gutter } = lineNumbersFor(workingText);
  const sid = escapeHtml(sectionId);

  slot.innerHTML = `
    <div class="section-editor" id="editor-frame-${sid}">
      <div class="editor-toolbar">
        <div class="segmented" role="group" aria-label="Modo del editor">
          <button type="button" class="segmented-option is-active" aria-pressed="true" id="tab-edit-${sid}">Editar</button>
          <button type="button" class="segmented-option" aria-pressed="false" id="tab-preview-${sid}">Previsualizar cambios</button>
        </div>
        <div class="editor-toolbar-actions">
          <span class="editor-meta tabular" id="editor-meta-${sid}">${lines} líneas</span>
          <button type="button" class="btn btn-quiet" id="btn-max-${sid}">Maximizar</button>
        </div>
      </div>

      <div class="editor-body" id="edit-view-${sid}">
        <div class="editor-gutter" id="gutter-${sid}" aria-hidden="true">${gutter}</div>
        <textarea class="editor-textarea" id="textarea-${sid}" spellcheck="false" aria-label="Texto de la sección ${escapeHtml(sec.title)}">${escapeHtml(workingText)}</textarea>
      </div>

      <div class="editor-preview" id="preview-view-${sid}" hidden></div>

      <div class="editor-submit">
        <h3>Proponer cambios para esta sección</h3>
        <div class="field">
          <label for="commit-title-${sid}">Título de la propuesta</label>
          <input type="text" id="commit-title-${sid}" value="Actualización y mejora en ${escapeHtml(sec.title)}" required />
        </div>
        <div class="field-split">
          <div class="field">
            <label for="commit-desc-${sid}">Motivación o justificación (opcional)</label>
            <textarea id="commit-desc-${sid}" rows="2" placeholder="Motivos técnicos, evidencias o casos límite..."></textarea>
          </div>
          <div class="field">
            <label for="commit-author-${sid}">Su nombre o asociación (opcional)</label>
            <input type="text" id="commit-author-${sid}" placeholder="Ej. Carmen R. / Particular" />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary btn-submit-commit">Proponer cambios</button>
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
  const gutter = document.getElementById(`gutter-${sectionId}`);
  const meta = document.getElementById(`editor-meta-${sectionId}`);
  const editView = document.getElementById(`edit-view-${sectionId}`);
  const previewView = document.getElementById(`preview-view-${sectionId}`);
  const tabEdit = document.getElementById(`tab-edit-${sectionId}`);
  const tabPreview = document.getElementById(`tab-preview-${sectionId}`);
  const btnMax = document.getElementById(`btn-max-${sectionId}`);

  function autoExpandTextarea() {
    if (frame.classList.contains('maximized')) return;
    textarea.style.height = 'auto';
    const computedHeight = Math.max(420, textarea.scrollHeight + 24);
    textarea.style.height = `${computedHeight}px`;
  }
  autoExpandTextarea();

  textarea.addEventListener('input', () => {
    const { lines, gutter: numbers } = lineNumbersFor(textarea.value);
    gutter.textContent = numbers;
    meta.textContent = `${lines} líneas`;
    autoExpandTextarea();
  });

  textarea.addEventListener('scroll', () => {
    gutter.scrollTop = textarea.scrollTop;
  });

  btnMax.addEventListener('click', () => {
    const isMax = frame.classList.toggle('maximized');
    btnMax.textContent = isMax ? 'Restaurar' : 'Maximizar';
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
    const diff = computeClientDiff(sec.content, textarea.value);
    const hasChanges = diff.some((d) => d.type !== 'unchanged');
    previewView.innerHTML = hasChanges
      ? `<div class="diff-view">${diffRowsHtml(diff)}</div>`
      : `<p class="diff-empty">No hay cambios respecto al texto original de la sección.</p>`;
  });

  slot.querySelector('.btn-cancel-commit').addEventListener('click', () => closeInlineEditor(sectionId));
  slot.querySelector('.btn-submit-commit').addEventListener('click', () => submitSectionProposal(sec, textarea));
}

async function submitSectionProposal(sec, textarea) {
  const sectionId = sec.id;
  const title = document.getElementById(`commit-title-${sectionId}`)?.value.trim();
  const proposedText = textarea.value.trim();
  const reason = document.getElementById(`commit-desc-${sectionId}`)?.value.trim();
  const author = document.getElementById(`commit-author-${sectionId}`)?.value.trim();

  if (!title) {
    showNotification('Por favor, indique un título breve para la propuesta.', true);
    return;
  }
  if (!proposedText) {
    showNotification('El texto propuesto no puede estar vacío.', true);
    return;
  }

  try {
    const res = await fetchJson(`/api/projects/${state.activeProject.id}/proposals`, {
      method: 'POST',
      body: JSON.stringify({
        sectionId,
        title,
        originalText: sec.content,
        proposedText,
        reason,
        author: author || 'Ciudadano'
      })
    });

    state.activeProject = res.project;
    state.sectionViewModes[sectionId] = 'proposed';
    closeInlineEditor(sectionId);
    renderMonographSections(state.activeProject);
    renderDrawerProposalsList(state.activeProject);
    updateDrawerCounts(state.activeProject);
    showNotification('Propuesta de cambio guardada. El diff se ha acumulado en la sección.');
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
  }
}

/* ==========================================================================
   PANELES DESLIZANTES
   ========================================================================== */

function setDrawerOpen(drawerId, isOpen) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  drawer.classList.toggle('is-open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  drawer.inert = !isOpen;

  const anyOpen = document.querySelector('.drawer.is-open') !== null;
  document.getElementById('drawer-backdrop')?.classList.toggle('is-open', anyOpen);
  if (isOpen) {
    drawer.querySelector('input, textarea, button')?.focus({ preventScroll: true });
  }
}

function openSidebarDrawer() {
  setDrawerOpen('sidebar-drawer', true);
}

function closeAllDrawers() {
  setDrawerOpen('sidebar-drawer', false);
  setDrawerOpen('project-composer', false);
}

function renderDrawerProposalsList(p) {
  const container = document.getElementById('side-proposals-list');
  if (!container) return;

  const proposals = p.proposals || [];
  if (proposals.length === 0) {
    container.innerHTML = `<p class="entry-empty">No hay propuestas de cambio registradas todavía. Use “Editar redacción” en cualquier sección para proponer una mejora.</p>`;
    return;
  }

  container.innerHTML = proposals
    .map((prop) => {
      const diff = (prop.diff || []).filter((d) => d.type !== 'unchanged');
      return `
        <article class="entry">
          <p class="kicker">${escapeHtml(prop.status)} · ${escapeHtml(prop.author || 'Ciudadano')} · ${escapeHtml(prop.createdAt)}</p>
          <h3 class="entry-title">${escapeHtml(prop.title)}</h3>
          ${diff.length > 0 ? `<div class="diff-view">${diffRowsHtml(diff)}</div>` : ''}
          ${prop.reason ? `<p class="entry-reason">${escapeHtml(prop.reason)}</p>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderDrawerOpinionsList(p) {
  const container = document.getElementById('side-opinions-entries');
  if (!container) return;

  const opinions = p.opinions || [];
  if (opinions.length === 0) {
    container.innerHTML = `<p class="entry-empty">No hay opiniones o alertas registradas todavía.</p>`;
    return;
  }

  container.innerHTML = opinions
    .map((op) => {
      return `
        <article class="entry">
          <p class="kicker">${escapeHtml(op.type)} · ${escapeHtml(op.author || 'Ciudadano')} · ${escapeHtml(op.createdAt)}</p>
          <p class="entry-text">${escapeHtml(op.text)}</p>
        </article>
      `;
    })
    .join('');
}

function updateDrawerCounts(p) {
  const pCount = (p.proposals || []).length;
  const oCount = (p.opinions || []).length;

  document.getElementById('count-proposals').textContent = String(pCount);
  document.getElementById('count-opinions').textContent = String(oCount);
  document.getElementById('top-count-total').textContent = String(pCount + oCount);
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
}

function setupProjectComposer() {
  const projectForm = document.getElementById('form-new-project');
  document.getElementById('btn-toggle-project-form')?.addEventListener('click', () => {
    setDrawerOpen('project-composer', true);
  });
  document.getElementById('btn-cancel-project')?.addEventListener('click', () => {
    setDrawerOpen('project-composer', false);
  });

  projectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const value = (id) => document.getElementById(id).value;
      const res = await fetchJson('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: value('project-title'),
          category: value('project-category'),
          code: value('project-code'),
          author: value('project-author') || 'Iniciativa Ciudadana',
          summary: value('project-summary'),
          initialContent: value('project-initial-content'),
          measuresContent: value('project-measures-content'),
          impactContent: value('project-impact-content')
        })
      });

      projectForm.reset();
      setDrawerOpen('project-composer', false);
      showNotification('Plan publicado con éxito en el catálogo.');
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

  seedForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const value = (id) => document.getElementById(id).value;
      const res = await fetchJson('/api/seeds', {
        method: 'POST',
        body: JSON.stringify({
          title: value('seed-title'),
          category: value('seed-category'),
          author: value('seed-author') || 'Ciudadano',
          description: value('seed-description')
        })
      });

      seedForm.reset();
      seedForm.hidden = true;
      state.seeds = res.seeds || [];
      renderSeedsList();
      renderCatalogLedger();
      showNotification('Idea ciudadana publicada con éxito en el catálogo.');
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
    if (e.key === 'Escape') closeAllDrawers();
  });

  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    tab.addEventListener('click', () => selectSideTab(tab.dataset.side));
  });

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
          text: document.getElementById('opinion-text').value,
          author: document.getElementById('opinion-author').value || 'Ciudadano'
        })
      });

      state.activeProject = res.project;
      opinForm.reset();
      opinForm.hidden = true;
      renderDrawerOpinionsList(state.activeProject);
      updateDrawerCounts(state.activeProject);
      selectSideTab('opinions');
      showNotification('Opinión añadida al debate del plan.');
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
  setupMethodScrolly();
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  handleRouting();
});
