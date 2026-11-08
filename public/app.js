/**
 * Cliente interactivo para Democracia Colaborativa (Ágora Normativa).
 * Gestiona el catálogo multiproyecto, creación de planes, lectura monográfica amplia,
 * editor en línea por sección y panel lateral deslizante bajo demanda.
 */

const state = {
  currentFilter: 'all',
  projects: [],
  seeds: [],
  activeProject: null,
  activeSideTab: 'proposals',
  activeInlineSectionId: null
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
    if (!propSet.has(line)) {
      diff.push({ type: 'removed', text: line });
    } else {
      diff.push({ type: 'unchanged', text: line });
    }
  }
  for (const line of propLines) {
    if (!origSet.has(line)) {
      diff.push({ type: 'added', text: line });
    }
  }
  return diff;
}

function showNotification(message, isError = false) {
  const banner = document.getElementById('notification-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.classList.remove('hidden');
  banner.style.backgroundColor = isError ? '#fef2f2' : '#f0fdf4';
  banner.style.color = isError ? '#991b1b' : '#166534';
  banner.style.borderColor = isError ? '#fecaca' : '#bbf7d0';

  window.clearTimeout(banner._hideTimer);
  banner._hideTimer = window.setTimeout(() => {
    banner.classList.add('hidden');
  }, 5000);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud al servidor');
  }
  return data;
}

/* ==========================================================================
   ENRUTAMIENTO Y VISTAS
   ========================================================================== */

async function handleRouting() {
  const hash = window.location.hash || '#landing';
  closeSidebarDrawer();
  if (hash.startsWith('#plan/')) {
    const projectId = hash.replace('#plan/', '');
    await openProjectView(projectId);
  } else {
    await openLandingView();
  }
}

async function openLandingView() {
  document.getElementById('view-landing').classList.remove('hidden');
  document.getElementById('view-project').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const data = await fetchJson(`/api/projects?filter=${encodeURIComponent(state.currentFilter)}`);
    state.projects = data.projects || [];
    state.seeds = data.seeds || [];
    renderLandingView();
  } catch (err) {
    showNotification(err.message, true);
  }
}

async function openProjectView(projectId) {
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-project').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  state.activeInlineSectionId = null;

  try {
    const data = await fetchJson(`/api/projects/${encodeURIComponent(projectId)}`);
    state.activeProject = data.project;
    renderProjectView();
  } catch (err) {
    showNotification(err.message, true);
    window.location.hash = '#landing';
  }
}

/* ==========================================================================
   RENDERIZADO DE LA PORTADA (LANDING PAGE)
   ========================================================================== */

function renderLandingView() {
  renderProjectsGrid();
  renderSeedsGrid();
}

function renderProjectsGrid() {
  const container = document.getElementById('projects-grid');
  if (!container) return;

  if (state.projects.length === 0) {
    container.innerHTML = `<p class="section-subtitle">No se encontraron planes para este filtro.</p>`;
    return;
  }

  container.innerHTML = state.projects
    .map((p) => {
      return `
        <article class="project-card">
          <div>
            <div class="card-top-meta">
              <span class="pill">${escapeHtml(p.code)}</span>
              <span class="pill pill-stage">${escapeHtml(p.stage)}</span>
            </div>
            <h2 class="card-title">
              <a href="#plan/${escapeHtml(p.id)}">${escapeHtml(p.title)}</a>
            </h2>
            <p class="card-summary">${escapeHtml(p.summary)}</p>
          </div>
          <div class="card-footer">
            <span>${p.proposalsCount} propuestas · ${p.opinionsCount} opiniones</span>
            <a href="#plan/${escapeHtml(p.id)}" class="card-link">Leer monografía y colaborar &rarr;</a>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderSeedsGrid() {
  const container = document.getElementById('seeds-cards-container');
  if (!container) return;

  if (state.seeds.length === 0) {
    container.innerHTML = `<p class="section-subtitle">No hay ideas registradas todavía.</p>`;
    return;
  }

  container.innerHTML = state.seeds
    .map((s) => {
      return `
        <div class="seed-card">
          <div class="seed-card-meta">
            <span class="pill">${escapeHtml(s.category)}</span>
            <span>${escapeHtml(s.createdAt)}</span>
          </div>
          <h3 class="seed-card-title">${escapeHtml(s.title)}</h3>
          <p class="seed-card-desc">${escapeHtml(s.description)}</p>
          <div style="font-size: 0.78rem; color: var(--text-soft);">
            Aportada por: <strong>${escapeHtml(s.author || 'Ciudadano')}</strong>
          </div>
        </div>
      `;
    })
    .join('');
}

/* ==========================================================================
   RENDERIZADO DE LA MONOGRAFIA (LECTURA AMPLIA Y EDITOR INLINE)
   ========================================================================== */

function renderProjectView() {
  const p = state.activeProject;
  if (!p) return;

  document.getElementById('plan-code').textContent = p.code;
  document.getElementById('plan-title').textContent = p.title;
  document.getElementById('plan-summary').textContent = p.summary;

  const pillsContainer = document.getElementById('project-meta-pills');
  pillsContainer.innerHTML = `
    <span class="pill">${escapeHtml(p.category)}</span>
    <span class="pill pill-stage">${escapeHtml(p.stage)}</span>
  `;

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

  // La propuesta mas reciente representa el estado acumulado
  const latestProposal = proposals[0];
  const diff = computeClientDiff(section.content, latestProposal.proposedText);
  const addedLines = diff.filter((d) => d.type === 'added').length;
  const removedLines = diff.filter((d) => d.type === 'removed').length;

  return {
    hasProposals: true,
    proposalsCount: proposals.length,
    addedLines,
    removedLines,
    text: latestProposal.proposedText,
    diff
  };
}

function renderMonographSections(p) {
  const container = document.getElementById('monograph-sections-container');
  if (!container) return;

  state.sectionViewModes = state.sectionViewModes || {};

  container.innerHTML = (p.monograph || [])
    .map((sec) => {
      const accumulated = getSectionAccumulatedInfo(p, sec);
      const currentMode = state.sectionViewModes[sec.id] || (accumulated.hasProposals ? 'proposed' : 'original');

      let accumulatedBarHtml = '';
      if (accumulated.hasProposals) {
        accumulatedBarHtml = `
          <div class="accumulated-diff-bar">
            <div class="accumulated-diff-info">
              <span>${accumulated.proposalsCount} propuesta(s) acumulada(s):</span>
              <span class="badge badge-success">+${accumulated.addedLines}</span>
              <span class="badge badge-danger">-${accumulated.removedLines}</span>
            </div>
            <div class="accumulated-diff-toggles">
              <button
                type="button"
                class="diff-toggle-btn ${currentMode === 'original' ? 'active' : ''}"
                data-sec="${escapeHtml(sec.id)}"
                data-mode="original"
              >
                Texto original
              </button>
              <button
                type="button"
                class="diff-toggle-btn ${currentMode === 'proposed' ? 'active' : ''}"
                data-sec="${escapeHtml(sec.id)}"
                data-mode="proposed"
              >
                Texto con cambios
              </button>
              <button
                type="button"
                class="diff-toggle-btn ${currentMode === 'diff' ? 'active' : ''}"
                data-sec="${escapeHtml(sec.id)}"
                data-mode="diff"
              >
                Ver diff acumulado
              </button>
            </div>
          </div>
        `;
      }

      let contentHtml = '';
      if (currentMode === 'diff' && accumulated.hasProposals) {
        const diffRows = accumulated.diff
          .map((d, idx) => {
            const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' ';
            const cls = d.type === 'added' ? 'added' : d.type === 'removed' ? 'removed' : 'unchanged';
            return `
              <div class="editor-diff-row ${cls}">
                <span class="editor-diff-num">${idx + 1}</span>
                <span class="editor-diff-text">${escapeHtml(prefix + ' ' + d.text)}</span>
              </div>
            `;
          })
          .join('');
        contentHtml = `<div class="editor-diff-preview" style="border:1px solid #d0d7de; border-radius:4px; margin-bottom:1rem;">${diffRows}</div>`;
      } else if (currentMode === 'proposed' && accumulated.hasProposals) {
        contentHtml = `<div class="monograph-text" id="text-sec-${escapeHtml(sec.id)}">${escapeHtml(accumulated.text)}</div>`;
      } else {
        contentHtml = `<div class="monograph-text" id="text-sec-${escapeHtml(sec.id)}">${escapeHtml(sec.content)}</div>`;
      }

      return `
        <section class="monograph-section" id="section-${escapeHtml(sec.id)}">
          <div class="monograph-section-header">
            <h2 class="monograph-section-title">${escapeHtml(sec.title)}</h2>
            <button
              type="button"
              class="btn btn-subtle btn-sm btn-propose-inline"
              data-section-id="${escapeHtml(sec.id)}"
            >
              Editar redacción
            </button>
          </div>
          ${accumulatedBarHtml}
          ${contentHtml}
          <div id="inline-editor-slot-${escapeHtml(sec.id)}"></div>
        </section>
      `;
    })
    .join('');

  // Manejo de botones de modo en la barra de diff acumulado
  container.querySelectorAll('.diff-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const secId = btn.getAttribute('data-sec');
      const mode = btn.getAttribute('data-mode');
      state.sectionViewModes[secId] = mode;
      renderMonographSections(state.activeProject);
    });
  });

  // Manejo de boton de edicion en cada seccion
  container.querySelectorAll('.btn-propose-inline').forEach((btn) => {
    btn.addEventListener('click', () => {
      const secId = btn.getAttribute('data-section-id');
      toggleSectionEditor(secId);
    });
  });
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

  state.activeInlineSectionId = sectionId;
  const sec = (state.activeProject?.monograph || []).find((s) => s.id === sectionId);
  if (!sec) return;

  const accumulated = getSectionAccumulatedInfo(state.activeProject, sec);
  // Se edita directamente sobre el texto acumulado existente en un lienzo amplio y despejado
  const workingText = accumulated.text;
  const lineCount = (workingText.match(/\n/g) || []).length + 1;
  let gutterNumbers = '';
  for (let i = 1; i <= lineCount; i++) {
    gutterNumbers += i + '\n';
  }

  slot.innerHTML = `
    <div class="editor-spacious-frame" id="editor-frame-${escapeHtml(sectionId)}">
      <div class="editor-spacious-toolbar">
        <div class="editor-tab-group">
          <button type="button" class="editor-tab active" id="tab-edit-${escapeHtml(sectionId)}">
            Editar
          </button>
          <button type="button" class="editor-tab" id="tab-preview-${escapeHtml(sectionId)}">
            Previsualizar cambios
          </button>
        </div>
        <div class="editor-toolbar-actions">
          <button type="button" class="btn btn-subtle btn-sm" id="btn-max-${escapeHtml(sectionId)}" style="font-size:0.78rem;">
            Maximizar espacio
          </button>
          <span class="editor-toolbar-meta" id="editor-meta-${escapeHtml(sectionId)}">
            ${lineCount} líneas &middot; Vista amplia
          </span>
        </div>
      </div>

      <!-- VISTA EDITAR: TEXTAREA AMPLIO CON NUMERACION DE LINEAS -->
      <div class="editor-spacious-body" id="edit-view-${escapeHtml(sectionId)}">
        <div class="editor-spacious-gutter" id="gutter-${escapeHtml(sectionId)}">${gutterNumbers}</div>
        <textarea
          class="editor-spacious-textarea"
          id="textarea-${escapeHtml(sectionId)}"
          spellcheck="false"
        >${escapeHtml(workingText)}</textarea>
      </div>

      <!-- VISTA PREVIEW: VISOR DE DIFERENCIAS EN TIEMPO REAL -->
      <div class="editor-diff-preview hidden" id="preview-view-${escapeHtml(sectionId)}"></div>

      <!-- PANEL INFERIOR PARA PROPONER CAMBIOS -->
      <div class="editor-proposal-panel">
        <h4>Proponer cambios para esta sección</h4>
        <div class="field-row">
          <label for="commit-title-${escapeHtml(sectionId)}">Título de la propuesta</label>
          <input
            type="text"
            id="commit-title-${escapeHtml(sectionId)}"
            value="Actualización y mejora en ${escapeHtml(sec.title)}"
            required
          />
        </div>
        <div class="field-row">
          <label for="commit-desc-${escapeHtml(sectionId)}">Motivación o justificación técnica (opcional)</label>
          <textarea
            id="commit-desc-${escapeHtml(sectionId)}"
            rows="2"
            placeholder="Aporte motivos técnicos, evidencias o casos límite que fundamenten este cambio..."
          ></textarea>
        </div>
        <div class="field-row">
          <label for="commit-author-${escapeHtml(sectionId)}">Su nombre o asociación (opcional)</label>
          <input
            type="text"
            id="commit-author-${escapeHtml(sectionId)}"
            placeholder="Ej. Carmen R. / Particular"
          />
        </div>
        <div class="form-actions">
          <button
            type="button"
            class="btn btn-primary btn-sm btn-submit-commit"
            data-sec="${escapeHtml(sectionId)}"
          >
            Proponer cambios
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm btn-cancel-commit"
            data-sec="${escapeHtml(sectionId)}"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;

  slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const frame = document.getElementById(`editor-frame-${sectionId}`);
  const textarea = document.getElementById(`textarea-${sectionId}`);
  const gutter = document.getElementById(`gutter-${sectionId}`);
  const meta = document.getElementById(`editor-meta-${sectionId}`);
  const editView = document.getElementById(`edit-view-${sectionId}`);
  const previewView = document.getElementById(`preview-view-${sectionId}`);
  const tabEdit = document.getElementById(`tab-edit-${sectionId}`);
  const tabPreview = document.getElementById(`tab-preview-${sectionId}`);
  const btnMax = document.getElementById(`btn-max-${sectionId}`);

  // Ajuste de altura automatica amplia para que el texto respire y no quede atrapado
  function autoExpandTextarea() {
    textarea.style.height = 'auto';
    const computedHeight = Math.max(520, textarea.scrollHeight + 30);
    textarea.style.height = `${computedHeight}px`;
    gutter.style.height = `${computedHeight}px`;
  }
  autoExpandTextarea();

  // Actualizar gutter de lineas sincronizadamente
  textarea.addEventListener('input', () => {
    const lines = (textarea.value.match(/\n/g) || []).length + 1;
    let nums = '';
    for (let i = 1; i <= lines; i++) {
      nums += i + '\n';
    }
    gutter.textContent = nums;
    if (meta) {
      meta.textContent = `${lines} líneas \u00b7 Vista amplia`;
    }
    autoExpandTextarea();
  });

  textarea.addEventListener('scroll', () => {
    gutter.scrollTop = textarea.scrollTop;
  });

  // Boton maximizar espacio a pantalla completa
  btnMax?.addEventListener('click', () => {
    const isMax = frame.classList.toggle('maximized');
    btnMax.textContent = isMax ? 'Restaurar tamaño' : 'Maximizar espacio';
    if (isMax) {
      textarea.focus();
    }
  });

  // Conmutar a pestana Editar
  tabEdit.addEventListener('click', () => {
    tabEdit.classList.add('active');
    tabPreview.classList.remove('active');
    editView.classList.remove('hidden');
    previewView.classList.add('hidden');
  });

  // Conmutar a pestana Previsualizar cambios
  tabPreview.addEventListener('click', () => {
    tabPreview.classList.add('active');
    tabEdit.classList.remove('active');
    editView.classList.add('hidden');
    previewView.classList.remove('hidden');

    const proposedText = textarea.value;
    const diff = computeClientDiff(sec.content, proposedText);

    if (diff.length === 0 || !diff.some((d) => d.type !== 'unchanged')) {
      previewView.innerHTML = `
        <div style="padding: 2.5rem; text-align: center; color: #57606a;">
          No hay cambios respecto al texto original de la sección.
        </div>
      `;
      return;
    }

    const diffRows = diff
      .map((d, idx) => {
        const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' ';
        const cls = d.type === 'added' ? 'added' : d.type === 'removed' ? 'removed' : 'unchanged';
        return `
          <div class="editor-diff-row ${cls}">
            <span class="editor-diff-num">${idx + 1}</span>
            <span class="editor-diff-text">${escapeHtml(prefix + ' ' + d.text)}</span>
          </div>
        `;
      })
      .join('');

    previewView.innerHTML = diffRows;
  });

  // Cancelar edicion
  slot.querySelector('.btn-cancel-commit')?.addEventListener('click', () => {
    closeInlineEditor(sectionId);
  });

  // Guardar cambios (acumular propuesta)
  slot.querySelector('.btn-submit-commit')?.addEventListener('click', async () => {
    const title = document.getElementById(`commit-title-${sectionId}`)?.value.trim();
    const proposedText = textarea.value.trim();
    const reason = document.getElementById(`commit-desc-${sectionId}`)?.value.trim();
    const author = document.getElementById(`commit-author-${sectionId}`)?.value.trim();

    if (!title) {
      showNotification('Por favor, indique un titulo breve para la propuesta.', true);
      return;
    }
    if (!proposedText) {
      showNotification('El texto propuesto no puede estar vacio.', true);
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
  });
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
   PANEL LATERAL DESLIZANTE BAJO DEMANDA (DRAWER)
   ========================================================================== */

function openSidebarDrawer() {
  document.getElementById('sidebar-drawer')?.classList.remove('hidden');
  document.getElementById('drawer-backdrop')?.classList.remove('hidden');
}

function closeSidebarDrawer() {
  document.getElementById('sidebar-drawer')?.classList.add('hidden');
  document.getElementById('drawer-backdrop')?.classList.add('hidden');
}

function renderDrawerProposalsList(p) {
  const container = document.getElementById('side-proposals-list');
  if (!container) return;

  const proposals = p.proposals || [];
  if (proposals.length === 0) {
    container.innerHTML = `<p class="editor-help">No hay propuestas de cambio registradas todavía para este plan. Utilice el botón de cada sección para proponer una mejora.</p>`;
    return;
  }

  container.innerHTML = proposals
    .map((prop) => {
      const diffLinesHtml = (prop.diff || [])
        .map((d) => {
          const prefix = d.type === 'added' ? '+ ' : d.type === 'removed' ? '- ' : '  ';
          const cls =
            d.type === 'added' ? 'added' : d.type === 'removed' ? 'removed' : 'unchanged';
          return `<div class="diff-entry ${cls}">${escapeHtml(prefix + d.text)}</div>`;
        })
        .join('');

      return `
        <div class="card-item">
          <div class="card-item-header">
            <h4 class="card-item-title">${escapeHtml(prop.title)}</h4>
            <span class="pill pill-stage">${escapeHtml(prop.status)}</span>
          </div>
          <div class="card-item-author">
            Por <strong>${escapeHtml(prop.author || 'Ciudadano')}</strong> · ${escapeHtml(prop.createdAt)}
          </div>
          <div class="diff-viewer">
            ${diffLinesHtml}
          </div>
          ${
            prop.reason
              ? `<div class="card-item-reason"><strong>Motivación:</strong> ${escapeHtml(
                  prop.reason
                )}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');
}

function renderDrawerOpinionsList(p) {
  const container = document.getElementById('side-opinions-list');
  if (!container) return;

  const opinions = p.opinions || [];
  if (opinions.length === 0) {
    container.innerHTML = `<p class="editor-help">No hay opiniones o alertas registradas todavía.</p>`;
    return;
  }

  container.innerHTML = opinions
    .map((op) => {
      return `
        <div class="card-item">
          <div class="card-item-header">
            <span class="pill">${escapeHtml(op.type)}</span>
            <span style="font-size:0.75rem; color:var(--text-soft);">${escapeHtml(
              op.createdAt
            )}</span>
          </div>
          <p style="font-size:0.88rem; margin: 0.5rem 0; color:var(--text-main);">${escapeHtml(
            op.text
          )}</p>
          <div style="font-size:0.78rem; color:var(--text-soft);">
            Aportado por: <strong>${escapeHtml(op.author || 'Ciudadano')}</strong>
          </div>
        </div>
      `;
    })
    .join('');
}

function updateDrawerCounts(p) {
  const pCount = (p.proposals || []).length;
  const oCount = (p.opinions || []).length;
  const total = pCount + oCount;

  document.getElementById('count-proposals').textContent = String(pCount);
  document.getElementById('count-opinions').textContent = String(oCount);
  document.getElementById('top-count-total').textContent = String(total);
}

/* ==========================================================================
   CONFIGURACION DE EVENTOS GLOBALES
   ========================================================================== */

function setupEventListeners() {
  window.addEventListener('hashchange', () => {
    handleRouting();
  });

  // Filtros de la portada
  const filterGroup = document.getElementById('filter-buttons-group');
  if (filterGroup) {
    filterGroup.querySelectorAll('.filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterGroup.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentFilter = btn.getAttribute('data-filter') || 'all';
        openLandingView();
      });
    });
  }

  // Desplegable formulario de NUEVO PLAN en portada
  const projectForm = document.getElementById('form-new-project');
  document.getElementById('btn-toggle-project-form')?.addEventListener('click', () => {
    projectForm.classList.toggle('hidden');
    if (!projectForm.classList.contains('hidden')) {
      projectForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  document.getElementById('btn-cancel-project')?.addEventListener('click', () => {
    projectForm.classList.add('hidden');
  });

  // Envio de NUEVO PLAN
  projectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const title = document.getElementById('project-title').value;
      const category = document.getElementById('project-category').value;
      const code = document.getElementById('project-code').value;
      const author = document.getElementById('project-author').value;
      const summary = document.getElementById('project-summary').value;
      const initialContent = document.getElementById('project-initial-content').value;
      const measuresContent = document.getElementById('project-measures-content').value;
      const impactContent = document.getElementById('project-impact-content').value;

      const res = await fetchJson('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          code,
          author: author || 'Iniciativa Ciudadana',
          summary,
          initialContent,
          measuresContent,
          impactContent
        })
      });

      projectForm.reset();
      projectForm.classList.add('hidden');
      showNotification('Plan publicado con éxito en el catálogo.');
      window.location.hash = `#plan/${res.project.id}`;
    } catch (err) {
      showNotification(err.message, true);
    }
  });

  // Desplegable formulario de ideas en portada
  const seedForm = document.getElementById('form-new-seed');
  document.getElementById('btn-toggle-seed-form')?.addEventListener('click', () => {
    seedForm.classList.toggle('hidden');
    if (!seedForm.classList.contains('hidden')) {
      seedForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  document.getElementById('btn-cancel-seed')?.addEventListener('click', () => {
    seedForm.classList.add('hidden');
  });

  // Envio de nueva idea
  seedForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const title = document.getElementById('seed-title').value;
      const category = document.getElementById('seed-category').value;
      const author = document.getElementById('seed-author').value;
      const description = document.getElementById('seed-description').value;

      const res = await fetchJson('/api/seeds', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          author: author || 'Ciudadano',
          description
        })
      });

      seedForm.reset();
      seedForm.classList.add('hidden');
      state.seeds = res.seeds || [];
      renderSeedsGrid();
      showNotification('Idea ciudadana publicada con éxito en el catálogo.');
    } catch (err) {
      showNotification(err.message, true);
    }
  });

  // Boton volver de monografia a portada
  document.getElementById('btn-back-to-landing')?.addEventListener('click', () => {
    window.location.hash = '#landing';
  });

  // Controles del Panel Lateral Deslizante (Drawer)
  document.getElementById('btn-open-sidebar-drawer')?.addEventListener('click', () => {
    openSidebarDrawer();
  });
  document.getElementById('btn-close-sidebar-drawer')?.addEventListener('click', () => {
    closeSidebarDrawer();
  });
  document.getElementById('drawer-backdrop')?.addEventListener('click', () => {
    closeSidebarDrawer();
  });

  // Pestanas del drawer (Propuestas vs Opiniones)
  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const side = tab.getAttribute('data-side');
      state.activeSideTab = side;
      if (side === 'proposals') {
        document.getElementById('side-proposals-list').classList.remove('hidden');
        document.getElementById('side-opinions-list').classList.add('hidden');
      } else {
        document.getElementById('side-proposals-list').classList.add('hidden');
        document.getElementById('side-opinions-list').classList.remove('hidden');
      }
    });
  });

  // Formulario de opinion dentro del drawer
  const opinForm = document.getElementById('form-new-opinion');
  document.getElementById('btn-open-opinion-drawer-form')?.addEventListener('click', () => {
    opinForm.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-opinion')?.addEventListener('click', () => {
    opinForm.classList.add('hidden');
  });

  opinForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeProject) return;

    try {
      const type = document.getElementById('opinion-type').value;
      const text = document.getElementById('opinion-text').value;
      const author = document.getElementById('opinion-author').value;

      const res = await fetchJson(`/api/projects/${state.activeProject.id}/opinions`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          text,
          author: author || 'Ciudadano'
        })
      });

      state.activeProject = res.project;
      opinForm.reset();
      opinForm.classList.add('hidden');
      renderDrawerOpinionsList(state.activeProject);
      updateDrawerCounts(state.activeProject);

      document.querySelector('.sidebar-tab[data-side="opinions"]')?.click();
      showNotification('Opinión añadida al debate del plan.');
    } catch (err) {
      showNotification(err.message, true);
    }
  });

  // Boton restaurar datos
  document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
    try {
      await fetchJson('/api/reset', { method: 'POST' });
      showNotification('Catálogo restaurado al estado inicial.');
      await handleRouting();
    } catch (err) {
      showNotification(err.message, true);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  handleRouting();
});
