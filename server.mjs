// Receptor de alertas de TradingView + Panel Web
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { enviarTelegram, telegramConfig } from './src/telegram.mjs';

const config = JSON.parse(await readFile(new URL('config.json', import.meta.url), 'utf8'));
const PUERTO = Number(process.env.PORT) || config.servidor?.puerto || 4322;
const HOST = process.env.HOST || '0.0.0.0';
const SECRETO = process.env.TV_SECRET || config.servidor?.secreto || '';
const raiz = new URL('.', import.meta.url);

async function leerCuerpo(req) {
  let crudo = '';
  for await (const trozo of req) {
    crudo += trozo;
    if (crudo.length > 100_000) throw new Error('payload demasiado grande');
  }
  return crudo;
}

function json(res, status, payload) {
  const cuerpo = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(cuerpo) });
  res.end(cuerpo);
}

function textoDeAlerta(crudo) {
  if (!crudo) return 'Alerta de TradingView sin contenido.';

  try {
    const data = JSON.parse(crudo);
    const partes = [];
    if (data.symbol) partes.push('Activo: ' + data.symbol);
    if (data.price) partes.push('Precio: ' + data.price);
    if (data.interval) partes.push('Temporalidad: ' + data.interval);
    if (data.message) partes.push(String(data.message).slice(0, 1500));
    if (partes.length) return partes.join('\n');
  } catch {
    // La alerta puede venir como texto plano.
  }

  return crudo.slice(0, 1500);
}

function correrEscaneo() {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, ['src/scan.mjs'], { cwd: raiz.pathname.replace(/^\//, '') });
    let salida = '';
    hijo.stdout.on('data', (d) => {
      salida += d;
    });
    hijo.stderr.on('data', (d) => {
      salida += d;
    });
    hijo.on('close', (codigo) => resolve({ codigo, salida }));
  });
}

async function servirArchivo(res, filePath, contentType) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('No encontrado');
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  // Panel web
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/bot')) {
    return servirArchivo(res, path.join(process.cwd(), 'public/bot/index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/api/signals') {
    try {
      const data = await readFile(path.join(process.cwd(), '.state/señales.json'), 'utf8');
      return json(res, 200, JSON.parse(data));
    } catch {
      return json(res, 200, { señales: [], lastScan: null });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/performance') {
    try {
      const data = await readFile(path.join(process.cwd(), '.state/performance.json'), 'utf8');
      const perf = JSON.parse(data);
      const total = perf.señales.length;
      const ganadas = perf.señales.filter(s => s.status === 'ganada').length;
      const perdidas = perf.señales.filter(s => s.status === 'perdida').length;
      const winrate = total > 0 ? ((ganadas / total) * 100).toFixed(1) : '0';
      return json(res, 200, { total, ganadas, perdidas, winrate, señales: perf.señales });
    } catch {
      try {
        const sig = await readFile(path.join(process.cwd(), '.state/señales.json'), 'utf8');
        const sdata = JSON.parse(sig);
        const señales = (sdata.señales || []).map(s => ({...s, status: 'abierta', fecha: s.fecha || new Date().toISOString()}));
        const total = señales.length;
        const ganadas = 0; const perdidas = 0;
        const winrate = '0';
        return json(res, 200, { total, ganadas, perdidas, winrate, señales });
      } catch {
        return json(res, 200, { total: 0, ganadas: 0, perdidas: 0, winrate: '0', señales: [] });
      }
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    const { token, chatId } = telegramConfig(config);
    return json(res, 200, {
      ok: true,
      telegram: Boolean(token && chatId),
      simbolos: config.simbolos.map((s) => s.id),
      secretoRequerido: Boolean(SECRETO),
    });
  }

  if (req.method === 'POST' && url.pathname === '/tv-alert') {
    if (SECRETO) {
      const enviado = url.searchParams.get('token') || req.headers['x-webhook-secret'];
      if (enviado !== SECRETO) return json(res, 401, { error: 'token inválido' });
    }

    let texto;
    try {
      texto = textoDeAlerta(await leerCuerpo(req));
    } catch (err) {
      return json(res, 413, { error: err.message });
    }

    const mensaje = '📣 <b>Alerta de TradingView</b>\n' + texto;
    // Enviar a Telegram solo si está configurado
    try {
      await enviarTelegram(mensaje, config);
    } catch {}
    console.log('[tv-alert] ' + new Date().toISOString());

    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/scan') {
    const resultado = await correrEscaneo();
    return json(res, 200, { codigo: resultado.codigo, salida: resultado.salida });
  }

  json(res, 404, { error: 'No encontrado. Rutas: GET /, GET /bot, GET /health, POST /tv-alert, POST /scan, GET /api/signals' });
});

servidor.listen(PUERTO, HOST, () => {
  console.log('Receptor de TradingView en http://' + HOST + ':' + PUERTO);
  console.log('  GET  /health     estado del bot');
  console.log('  POST /tv-alert   webhook para alertas de TradingView');
  console.log('  POST /scan       fuerza un escaneo');
  console.log(SECRETO ? '  token requerido en ?token=' : '  sin token configurado (solo acepta desde la red local)');
});

servidor.on('error', (err) => {
  console.error('No pude levantar el servidor:', err.message);
  process.exit(1);
});
