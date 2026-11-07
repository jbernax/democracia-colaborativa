/**
 * Servidor HTTP y API REST simplificada para Democracia Colaborativa (Agora Normativa).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RepositoryStore } from './store/repositoryStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
});

export function createAppServer(store = new RepositoryStore()) {
  store.init();

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, pathname, parsedUrl.searchParams, store);
        return;
      }

      serveStaticFile(req, res, pathname);
    } catch (err) {
      sendJson(res, 500, {
        error: err.message || 'Error interno del servidor'
      });
    }
  });

  return server;
}

async function handleApiRequest(req, res, pathname, queryParams, store) {
  const method = req.method.toUpperCase();

  // GET /api/projects - Lista los planes del catalogo e ideas para la landing
  if (method === 'GET' && pathname === '/api/projects') {
    const filter = queryParams.get('filter') || 'all';
    const projects = store.getProjects(filter);
    const seeds = store.getSeeds();
    sendJson(res, 200, { projects, ideas: seeds, seeds });
    return;
  }

  // POST /api/projects - Crea un nuevo plan en el catalogo
  if (method === 'POST' && pathname === '/api/projects') {
    try {
      const body = await readJsonBody(req);
      const project = store.addProject(body);
      sendJson(res, 201, { project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // GET /api/ideas o /api/seeds - Lista las ideas ciudadanas para nuevos planes
  if (method === 'GET' && (pathname === '/api/ideas' || pathname === '/api/seeds')) {
    const ideas = store.getSeeds();
    sendJson(res, 200, { ideas, seeds: ideas });
    return;
  }

  // POST /api/ideas o /api/seeds - Crea una nueva idea de plan desde la landing
  if (method === 'POST' && (pathname === '/api/ideas' || pathname === '/api/seeds')) {
    try {
      const body = await readJsonBody(req);
      const idea = store.addSeed(body);
      const ideas = store.getSeeds();
      sendJson(res, 201, { idea, seed: idea, ideas, seeds: ideas });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // GET /api/projects/:id - Devuelve el detalle completo de un plan (monografia, propuestas y opiniones)
  const projectMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && projectMatch) {
    const projectId = projectMatch[1];
    const project = store.getProject(projectId);
    if (!project) {
      sendJson(res, 404, { error: 'Plan no encontrado' });
      return;
    }
    sendJson(res, 200, { project });
    return;
  }

  // POST /api/projects/:id/proposals - Propone un cambio (enmienda) sobre una seccion de la monografia
  const proposalMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/proposals$/);
  if (method === 'POST' && proposalMatch) {
    try {
      const projectId = proposalMatch[1];
      const body = await readJsonBody(req);
      const proposal = store.addProposal(projectId, body);
      const project = store.getProject(projectId);
      sendJson(res, 201, { proposal, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/projects/:id/opinions - Deja una opinion, caso vivido o debilidad señalada
  const opinionMatch = pathname.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)\/opinions$/);
  if (method === 'POST' && opinionMatch) {
    try {
      const projectId = opinionMatch[1];
      const body = await readJsonBody(req);
      const opinion = store.addOpinion(projectId, body);
      const project = store.getProject(projectId);
      sendJson(res, 201, { opinion, project });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  // POST /api/reset - Restaura los datos iniciales
  if (method === 'POST' && pathname === '/api/reset') {
    store.reset();
    sendJson(res, 200, {
      message: 'Datos del catalogo restaurados',
      projects: store.getProjects(),
      seeds: store.getSeeds()
    });
    return;
  }

  sendJson(res, 404, { error: 'Ruta no encontrada' });
}

function serveStaticFile(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PUBLIC_DIR, relativePath);

  // Proteccion contra Path Traversal
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
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Carga util demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        reject(new Error('Formato JSON invalido en la peticion'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

// Ejecucion directa
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`Democracia Colaborativa activa en http://localhost:${port}`);
  });
}
