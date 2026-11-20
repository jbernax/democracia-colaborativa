/**
 * Servidor HTTP local de desarrollo y API REST para Democracia Colaborativa (Ágora Normativa).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RepositoryStore } from './store/repositoryStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const MAX_BODY_BYTES = 1_048_576; // 1 MiB

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
});

const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
});

export function createAppServer(store = new RepositoryStore(), options = {}) {
  store.init();

  const server = http.createServer(async (req, res) => {
    try {
      let parsedUrl;
      let decodedPathname;
      try {
        parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        decodedPathname = decodeURIComponent(parsedUrl.pathname);
      } catch (_err) {
        sendJson(res, 400, { error: 'La dirección web no es válida.' });
        return;
      }

      if (decodedPathname.startsWith('/api/')) {
        await handleApiRequest(req, res, decodedPathname, parsedUrl.searchParams, store, options);
        return;
      }

      serveStaticFile(req, res, decodedPathname);
    } catch (err) {
      const status = err.statusCode || 500;
      sendJson(res, status, {
        error: err.message || 'Ha ocurrido un problema en el servidor.'
      });
    }
  });

  return server;
}

async function handleApiRequest(req, res, pathname, queryParams, store, options) {
  const method = req.method.toUpperCase();

  // GET /api/projects - Lista los planes del catálogo (filtros, búsqueda, categorías) e ideas
  if (method === 'GET' && pathname === '/api/projects') {
    const filter = queryParams.get('filter') || 'all';
    const q = queryParams.get('q') || '';
    const category = queryParams.get('category') || '';
    const projects = store.getProjects({ filter, q, category });
    const categories = store.getCategories();
    const seeds = store.getSeeds();
    const meta = store.getMeta();
    sendJson(res, 200, { projects, categories, ideas: seeds, seeds, meta });
    return;
  }

  // POST /api/projects - Crea un nuevo plan en el almacenamiento local
  if (method === 'POST' && pathname === '/api/projects') {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const project = store.addProject(body);
      sendJson(res, 201, { project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // GET /api/ideas o /api/seeds
  if (method === 'GET' && (pathname === '/api/ideas' || pathname === '/api/seeds')) {
    const ideas = store.getSeeds();
    sendJson(res, 200, { ideas, seeds: ideas });
    return;
  }

  // POST /api/ideas o /api/seeds
  if (method === 'POST' && (pathname === '/api/ideas' || pathname === '/api/seeds')) {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const idea = store.addSeed(body);
      const ideas = store.getSeeds();
      sendJson(res, 201, { idea, seed: idea, ideas, seeds: ideas });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/seeds/:id/endorse o /api/ideas/:id/endorse
  const endorseMatch = pathname.match(/^\/api\/(?:seeds|ideas)\/([a-zA-Z0-9_-]+)\/endorse$/);
  if (method === 'POST' && endorseMatch) {
    try {
      const seed = store.endorseSeed(endorseMatch[1]);
      const seeds = store.getSeeds();
      sendJson(res, 200, { seed, idea: seed, seeds, ideas: seeds });
    } catch (err) {
      sendJson(res, 404, { error: err.message });
    }
    return;
  }

  // GET /api/projects/:id
  const projectMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && projectMatch) {
    const project = store.getProject(projectMatch[1]);
    if (!project) {
      sendJson(res, 404, { error: 'No hemos encontrado ese plan.' });
      return;
    }
    sendJson(res, 200, { project });
    return;
  }

  // POST /api/projects/:id/proposals
  const proposalMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals$/);
  if (method === 'POST' && proposalMatch) {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const projectId = proposalMatch[1];
      const proposal = store.addProposal(projectId, body);
      const project = store.getProject(projectId);
      sendJson(res, 201, { proposal, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/projects/:id/proposals/:proposalId/coauthor
  const coauthorMatch = pathname.match(
    /^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals\/([a-zA-Z0-9_-]+)\/coauthor$/
  );
  if (method === 'POST' && coauthorMatch) {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const [, projectId, proposalId] = coauthorMatch;
      const proposal = store.elaborateProposal(projectId, proposalId, body);
      const project = store.getProject(projectId);
      sendJson(res, 200, { proposal, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/projects/:id/proposals/:proposalId/consolidate
  const consolidateMatch = pathname.match(
    /^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals\/([a-zA-Z0-9_-]+)\/consolidate$/
  );
  if (method === 'POST' && consolidateMatch) {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const [, projectId, proposalId] = consolidateMatch;
      const result = store.consolidateProposal(projectId, proposalId, body.reviewerNote || '');
      const project = store.getProject(projectId);
      sendJson(res, 200, { ...result, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/projects/:id/weaknesses
  const weaknessMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/weaknesses$/);
  if (method === 'POST' && weaknessMatch) {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const projectId = weaknessMatch[1];
      const weakness = store.addWeakness(projectId, body);
      const project = store.getProject(projectId);
      sendJson(res, 201, { weakness, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/projects/:id/opinions
  const opinionMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/opinions$/);
  if (method === 'POST' && opinionMatch) {
    const body = await readJsonBodyOrRespond(req, res);
    if (body === null) return;
    try {
      const projectId = opinionMatch[1];
      const opinion = store.addOpinion(projectId, body);
      const project = store.getProject(projectId);
      sendJson(res, 201, { opinion, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/reset - Protegido por configuración explícita
  if (method === 'POST' && pathname === '/api/reset') {
    const resetAllowed =
      options.allowReset === true || process.env.ENABLE_RESET_ENDPOINT === 'true';
    if (!resetAllowed) {
      sendJson(res, 403, {
        error: 'Para reiniciar los datos locales hay que activar ENABLE_RESET_ENDPOINT=true.'
      });
      return;
    }
    store.reset();
    sendJson(res, 200, {
      message: 'Datos del catálogo restaurados',
      projects: store.getProjects(),
      seeds: store.getSeeds()
    });
    return;
  }

  sendJson(res, 404, { error: 'No hemos encontrado esa ruta.' });
}

async function readJsonBodyOrRespond(req, res) {
  try {
    return await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.statusCode || 400, { error: err.message });
    return null;
  }
}

function serveStaticFile(req, res, pathname) {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, {
      Allow: 'GET, HEAD',
      'Content-Type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS
    });
    res.end(JSON.stringify({ error: 'Método no permitido' }));
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PUBLIC_DIR, relativePath);

  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
    sendJson(res, 403, { error: 'Acceso denegado' });
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    sendJson(res, 404, { error: 'Recurso no encontrado' });
    return;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(resolvedPath);
  res.writeHead(200, {
    'Content-Type': contentType,
    ...SECURITY_HEADERS
  });
  res.end(method === 'HEAD' ? undefined : content);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_BODY_BYTES) {
      req.pause();
      const err = new Error('El envío supera el tamaño máximo permitido.');
      err.statusCode = 413;
      reject(err);
      return;
    }

    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        settled = true;
        req.pause();
        const err = new Error('El envío supera el tamaño máximo permitido.');
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        const err = new Error('Los datos enviados no tienen formato JSON válido.');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS
  };
  if (statusCode === 413) {
    headers.Connection = 'close';
  }
  res.writeHead(statusCode, headers);
  res.end(payload);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`Democracia Colaborativa activa en http://localhost:${port}`);
  });
}
