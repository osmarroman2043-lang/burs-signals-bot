// Backtest de las señales del método sobre datos históricos reales.
import { readFile } from 'node:fs/promises';
import { fetchCandles } from './data.mjs';
import { findSignals } from './method.mjs';
import { calcularLotes, riesgoPctParaCapital } from './analysis.mjs';

const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));

function simular(candles, señal) {
  for (let i = señal.idx + 1; i < candles.length; i += 1) {
    const c = candles[i];

    if (señal.dir === 'buy') {
      // Conservador: si el stop y el objetivo caen en la misma vela, se asume stop.
      if (c.l <= señal.sl) return { resultado: 'stop', R: -1, idx: i };
      if (c.h >= señal.tp) return { resultado: 'objetivo', R: señal.ratio, idx: i };
    } else {
      if (c.h >= señal.sl) return { resultado: 'stop', R: -1, idx: i };
      if (c.l <= señal.tp) return { resultado: 'objetivo', R: señal.ratio, idx: i };
    }
  }

  return { resultado: 'abierta', R: 0, idx: candles.length - 1 };
}

const filas = [];
const todas = [];
let capital = config.cuenta.capital;

for (const simbolo of config.simbolos) {
  let candles;
  try {
    candles = await fetchCandles(simbolo.id, { intervalo: simbolo.intervalo, rango: simbolo.rango });
  } catch (err) {
    console.log('No pude traer ' + simbolo.id + ': ' + err.message);
    continue;
  }

  const señales = findSignals(candles, config.metodo, simbolo);
  const resueltas = [];

  for (const señal of señales) {
    const res = simular(candles, señal);
    const riesgoPct = riesgoPctParaCapital(config.cuenta);
    const lotes = calcularLotes({
      capital,
      riesgoPct,
      distancia: señal.riesgo,
      unidad: simbolo.unidad,
      valorUnidad: simbolo.valorUnidad,
    });

    const fila = {
      symbol: simbolo.id,
      dir: señal.dir,
      fecha: new Date(señal.t).toISOString().slice(0, 16).replace('T', ' '),
      entry: señal.entry,
      sl: señal.sl,
      tp: señal.tp,
      ratio: Number(señal.ratio.toFixed(2)),
      resultado: res.resultado,
      R: res.R,
      lotes: Number(lotes.toFixed(2)),
      confluencias: señal.confluencias.join('+'),
    };

    resueltas.push(fila);
    todas.push(fila);
    if (res.resultado !== 'abierta') capital += (capital * riesgoPct * res.R) / 100 / 100;
  }

  const cerradas = resueltas.filter((f) => f.resultado !== 'abierta');
  const ganadas = cerradas.filter((f) => f.resultado === 'objetivo');
  const totalR = cerradas.reduce((acc, f) => acc + f.R, 0);
  const sumaGanada = ganadas.reduce((acc, f) => acc + f.R, 0);
  const sumaPerdida = Math.abs(cerradas.filter((f) => f.R < 0).reduce((acc, f) => acc + f.R, 0));

  filas.push({
    simbolo: simbolo.id,
    velas: candles.length,
    señales: resueltas.length,
    cerradas: cerradas.length,
    abiertas: resueltas.length - cerradas.length,
    acierto: cerradas.length ? Number(((ganadas.length / cerradas.length) * 100).toFixed(1)) : 0,
    Rtotal: Number(totalR.toFixed(2)),
    factor: sumaPerdida ? Number((sumaGanada / sumaPerdida).toFixed(2)) : null,
  });
}

console.log('\n=== Por símbolo ===');
console.table(filas);

const cerradas = todas.filter((f) => f.resultado !== 'abierta');
const ganadas = cerradas.filter((f) => f.resultado === 'objetivo');
const totalR = cerradas.reduce((acc, f) => acc + f.R, 0);
const sumaGanada = ganadas.reduce((acc, f) => acc + f.R, 0);
const sumaPerdida = Math.abs(cerradas.filter((f) => f.R < 0).reduce((acc, f) => acc + f.R, 0));

let equity = 0;
let pico = 0;
let maxDd = 0;
for (const f of cerradas) {
  equity += f.R;
  pico = Math.max(pico, equity);
  maxDd = Math.max(maxDd, pico - equity);
}

console.log('\n=== Global ===');
console.log('Operaciones cerradas: ' + cerradas.length + '  (abiertas al final: ' + (todas.length - cerradas.length) + ')');
console.log('Acierto: ' + (cerradas.length ? ((ganadas.length / cerradas.length) * 100).toFixed(1) : 0) + '%');
console.log('R total: ' + totalR.toFixed(2) + '  |  Esperanza por operación: ' + (cerradas.length ? (totalR / cerradas.length).toFixed(3) : 0) + 'R');
console.log('Profit factor: ' + (sumaPerdida ? (sumaGanada / sumaPerdida).toFixed(2) : 'n/a') + '  |  Máx. drawdown: ' + maxDd.toFixed(2) + 'R');

console.log('\n=== Confluencias más frecuentes en las que ganaron ===');
const conteo = new Map();
for (const f of ganadas) {
  for (const c of f.confluencias.split('+')) conteo.set(c, (conteo.get(c) || 0) + 1);
}
console.log([...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ': ' + v).join('  | ') || 'sin datos');

console.log('\n=== Últimas 12 señales ===');
console.table(todas.slice(-12));
