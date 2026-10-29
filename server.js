import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');

const PORT = Number(process.env.PORT) || 4321;
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const OWNER_NAME = (process.env.JARVIS_OWNER || '').trim();

const MAX_TURNS = 24;
const MAX_CHARS = 4000;
const MAX_BODY = 200_000;

const SYSTEM_PROMPT = [
  'Sos Jarvis, el asistente personal de ' + (OWNER_NAME || 'tu usuario') + '.',
  'Hablás en español neutro, de forma directa, cálida y un poco seca; sin adulaciones ni relleno.',
  'Tus respuestas se escuchan en voz alta: usá frases cortas, sin listas, sin markdown, sin emojis y sin escribir código salvo que te lo pidan explícitamente.',
  'Si no sabés algo, decilo en una frase y ofrecé el siguiente paso concreto.',
  'Cuando la pregunta admita una respuesta de una sola línea, respondé en una sola línea.',
].join(' ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw new Error('payload demasiado grande');
  }
  return raw;
}

function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_TURNS);
}

async function handleChat(req, res) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, 400, { error: 'El cuerpo del pedido no es JSON válido.' });
  }

  const messages = sanitizeHistory(payload.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return sendJson(res, 400, { error: 'Falta el mensaje del usuario.' });
  }

  if (!OPENAI_API_KEY) {
    return sendJson(res, 503, {
      error:
        'Todavía no hay cerebro conectado. Poné OPENAI_API_KEY en el archivo .env (copiá .env.example) y reiniciá el servidor.',
    });
  }

  try {
    const upstream = await fetch(OPENAI_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.6,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const detail = data?.error?.message || 'HTTP ' + upstream.status;
      console.error('[chat] proveedor respondió', upstream.status, detail);
      return sendJson(res, 502, { error: 'El modelo falló: ' + detail });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return sendJson(res, 502, { error: 'El modelo devolvió una respuesta vacía.' });

    sendJson(res, 200, { reply, model: MODEL });
  } catch (err) {
    console.error('[chat] error de red', err.message);
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    sendJson(res, 504, {
      error: timedOut ? 'El modelo tardó demasiado en responder.' : 'No pude conectar con el modelo: ' + err.message,
    });
  }
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, relative);

  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== PUBLIC_DIR) {
    return sendJson(res, 403, { error: 'Ruta no permitida.' });
  }

  try {
    const file = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': file.length,
    });
    res.end(file);
  } catch {
    sendJson(res, 404, { error: 'No encontrado.' });
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url || '/', 'http://localhost');

  if (pathname === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      brain: OPENAI_API_KEY ? 'conectado' : 'sin clave',
      model: MODEL,
      baseUrl: OPENAI_BASE_URL,
    });
  }

  if (pathname === '/api/chat') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Usá POST.' });
    return handleChat(req, res);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Jarvis escuchando en http://127.0.0.1:' + PORT);
  console.log('Cerebro: ' + (OPENAI_API_KEY ? MODEL + ' vía ' + OPENAI_BASE_URL : 'SIN CLAVE — falta OPENAI_API_KEY en .env'));
});

server.on('error', (err) => {
  console.error('No pude levantar el servidor:', err.message);
  process.exit(1);
});
