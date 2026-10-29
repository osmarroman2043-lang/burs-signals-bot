// Escaneo: busca señales nuevas en los símbolos configurados y las envía por Telegram.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fetchCandles } from './data.mjs';
import { getStrategy } from './strategies/index.mjs';
import { calcularLotes, riesgoPctParaCapital } from './analysis.mjs';
import { noticiaCerca, proximosAltoImpacto } from './news.mjs';
import { guardarSeñal } from './performance.mjs';

const raiz = new URL('..', import.meta.url);
const config = JSON.parse(await readFile(new URL('config.json', raiz), 'utf8'));
const estrategia = getStrategy(config.estrategia || 'burs');
const findSignals = estrategia.findSignals;
const estadoPath = path.join(new URL('.state', raiz).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'enviadas.json');

async function leerEstado() {
  try {
    return JSON.parse(await readFile(estadoPath, 'utf8'));
  } catch {
    return {};
  }
}

async function guardarEstado(estado) {
  await mkdir(path.dirname(estadoPath), { recursive: true }).catch(() => {});
  await writeFile(estadoPath, JSON.stringify(estado, null, 2), 'utf8');
}

const capital = Number(process.env.CAPITAL || config.cuenta.capital);
const riesgoPct = riesgoPctParaCapital({ ...config.cuenta, capital });
const ventanaNoticias = config.noticias?.ventanaMin ?? 30;
const bloquearPorNoticias = config.noticias?.bloquear ?? true;

const estado = await leerEstado();
const nuevas = [];

console.log('Escaneo ' + new Date().toISOString() + ' | Modo: Web Panel');

for (const simbolo of config.simbolos) {
  let candles;

  try {
    candles = await fetchCandles(simbolo.id, { intervalo: simbolo.intervalo, rango: simbolo.rango });
  } catch (err) {
    console.log('  ' + simbolo.id + ': error de datos (' + err.message + ')');
    continue;
  }

  // Filtro por volatilidad (evitar baja liquidez)
  if (candles.length > 20) {
    const atrReciente = Math.abs(candles[candles.length-1].h - candles[candles.length-1].l);
    const atrPromedio = candles.slice(-20).reduce((a,c)=>a+(c.h-c.l),0)/20;
    if (atrReciente < atrPromedio * 0.5) {
      console.log('  ' + simbolo.id + ': volatilidad baja - omitido');
      continue;
    }
  }

  // La última vela puede estar en formación: se descarta para no señalizar en vivo sobre datos incompletos.
  candles = candles.slice(0, -1);

  const señales = findSignals(candles, config.metodo, simbolo);
  const recientes = señales.filter((s) => s.idx >= candles.length - 3);

  if (!recientes.length) {
    console.log('  ' + simbolo.id + ': sin señales nuevas (' + señales.length + ' históricas)');
    continue;
  }

  for (const señal of recientes) {
    const clave = simbolo.id + '|' + señal.t;
    if (estado[clave]) continue;

    const noticia = await noticiaCerca(simbolo.id, señal.t, ventanaNoticias);
    if (noticia && bloquearPorNoticias) {
      console.log('  ' + simbolo.id + ': señal bloqueada por noticia (' + noticia.titulo + ')');
      estado[clave] = Date.now();
      continue;
    }

    const lotes = calcularLotes({
      capital,
      riesgoPct,
      distancia: señal.riesgo,
      unidad: simbolo.unidad,
      valorUnidad: simbolo.valorUnidad,
    });

    const proximas = await proximosAltoImpacto(simbolo.id, 12);
    nuevas.push({ clave, señal, lotes });
    console.log('  ' + simbolo.id + ' ' + señal.dir.toUpperCase() + ' ENTRADA: ' + señal.entry.toFixed(2) + ' SL: ' + señal.sl.toFixed(2) + ' TP: ' + señal.tp.toFixed(2) + ' Lotes: ' + lotes.toFixed(2));
    await guardarSeñal({ ...señal, lotes: lotes.toFixed(2) });
    estado[clave] = Date.now();
  }
}

// Guardar señales para el panel web
const señalesPath = path.join(new URL('.state', raiz).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'señales.json');
if (nuevas.length > 0) {
  try {
    const señalesGuardadas = JSON.parse(await readFile(señalesPath, 'utf8'));
    const todas = [...nuevas.map(n => n.señal), ...(señalesGuardadas.señales || [])].slice(0, 50);
    await writeFile(señalesPath, JSON.stringify({ señales: todas, lastScan: Date.now() }, null, 2), 'utf8');
  } catch {
    await mkdir(path.dirname(señalesPath), { recursive: true }).catch(() => {});
    await writeFile(señalesPath, JSON.stringify({ señales: nuevas.map(n => n.señal), lastScan: Date.now() }, null, 2), 'utf8');
  }
} else {
  // Solo actualizar lastScan si no hay nuevas señales
  try {
    const señalesGuardadas = JSON.parse(await readFile(señalesPath, 'utf8'));
    await writeFile(señalesPath, JSON.stringify({ ...señalesGuardadas, lastScan: Date.now() }, null, 2), 'utf8');
  } catch {
    await mkdir(path.dirname(señalesPath), { recursive: true }).catch(() => {});
    await writeFile(señalesPath, JSON.stringify({ señales: [], lastScan: Date.now() }, null, 2), 'utf8');
  }
}

// Limpieza: el estado no crece más de 30 días.
const corte = Date.now() - 30 * 24 * 3600 * 1000;
for (const [k, v] of Object.entries(estado)) if (v < corte) delete estado[k];

await guardarEstado(estado);
console.log('Señales nuevas: ' + nuevas.length);
