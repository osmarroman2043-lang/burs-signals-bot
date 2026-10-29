// Reglas del método reconstruidas en docs/metodo-burs.md
import {
  atrSeries,
  pivots,
  inSession,
  isBullishEngulfing,
  isBearishEngulfing,
  isBullishPinbar,
  isBearishPinbar,
  retracement,
  sessionOf,
  detectarQuiebreEstructura,
  detectarSoportesResistencias,
  detectarFVG,
  isHammer,
  isShootingStar,
  isDoji,
} from './analysis.mjs';

function velaContraria(candles, breakIdx, dir, lookback) {
  for (let j = breakIdx - 1; j >= Math.max(0, breakIdx - lookback); j -= 1) {
    const c = candles[j];
    if (dir === 'buy' && c.c < c.o) return j;
    if (dir === 'sell' && c.c > c.o) return j;
  }
  return -1;
}

// Order blocks según los 4 criterios del video.
export function buildOrderBlocks(candles, cfg) {
  const atr = atrSeries(candles, cfg.atrPeriodo);
  const { highs, lows } = pivots(candles, cfg.pivote);
  const obs = [];

  let highPtr = -1;
  let lowPtr = -1;
  let ultimoAlcista = -99;
  let ultimoBajista = -99;

  for (let i = 1; i < candles.length; i += 1) {
    while (highPtr + 1 < highs.length && highs[highPtr + 1].confirmedAt <= i) highPtr += 1;
    while (lowPtr + 1 < lows.length && lows[lowPtr + 1].confirmedAt <= i) lowPtr += 1;

    const swingHigh = highPtr >= 0 ? highs[highPtr] : null;
    const swingLow = lowPtr >= 0 ? lows[lowPtr] : null;
    const volatilidad = atr[i];
    if (!volatilidad) continue;

    // Criterio 1: ruptura de un máximo anterior -> order block de compra.
    if (swingHigh && candles[i].c > swingHigh.price && i - ultimoAlcista >= 5) {
      const j = velaContraria(candles, i, 'buy', cfg.lookbackVelaContraria);
      if (j >= 0) {
        const fuerza = (candles[i].c - candles[j].l) / volatilidad;
        if (fuerza >= cfg.fuerzaImpulsoAtr) {
          ultimoAlcista = i;
          obs.push({
            dir: 'buy',
            top: candles[j].h,
            bottom: candles[j].l,
            velaIdx: j,
            breakIdx: i,
            breakPrice: candles[i].c,
            fuerza,
            atr: volatilidad,
          });
        }
      }
    }

    // Criterio 1 simétrico: ruptura de un mínimo anterior -> order block de venta.
    if (swingLow && candles[i].c < swingLow.price && i - ultimoBajista >= 5) {
      const j = velaContraria(candles, i, 'sell', cfg.lookbackVelaContraria);
      if (j >= 0) {
        const fuerza = (candles[j].h - candles[i].c) / volatilidad;
        if (fuerza >= cfg.fuerzaImpulsoAtr) {
          ultimoBajista = i;
          obs.push({
            dir: 'sell',
            top: candles[j].h,
            bottom: candles[j].l,
            velaIdx: j,
            breakIdx: i,
            breakPrice: candles[i].c,
            fuerza,
            atr: volatilidad,
          });
        }
      }
    }
  }

  return obs;
}

function tocaZona(candle, ob) {
  return ob.dir === 'buy' ? candle.l <= ob.top : candle.h >= ob.bottom;
}

function zonaRota(candle, ob) {
  return ob.dir === 'buy' ? candle.c < ob.bottom : candle.c > ob.top;
}

// Confirmaciones del video (se piden al menos `confluenciasMinimas`).
function confluenciasEn(candles, i, ob) {
  const c = candles[i];
  const prev = candles[i - 1];
  const dir = ob.dir;
  const confs = [];

  if (dir === 'buy' ? c.c > ob.top : c.c < ob.bottom) confs.push('cierre');

  if (dir === 'buy' ? isBullishEngulfing(prev, c) : isBearishEngulfing(prev, c)) confs.push('envolvente');

  if (dir === 'buy' ? isBullishPinbar(c) : isBearishPinbar(c)) confs.push('pinbar');
  if (dir === 'buy' && isHammer(c)) confs.push('martillo');
  if (dir === 'sell' && isShootingStar(c)) confs.push('estrella_fugaz');
  if (isDoji(c)) confs.push('doji');

  const inicio = dir === 'buy' ? ob.bottom : ob.top;
  const retr = retracement(inicio, ob.breakPrice, c.c);
  if (retr !== null && retr >= 0.55 && retr <= 0.85) confs.push('fib61-78');

  const desde = Math.max(1, i - 2);
  const recientes = candles.slice(desde, i + 1);
  const previas = candles.slice(Math.max(0, i - 12), desde);

  if (previas.length) {
    if (dir === 'buy') {
      const minimo = Math.min(...previas.map((x) => x.l));
      if (recientes.some((x) => x.l < minimo) && c.c > minimo) confs.push('barrido');
    } else {
      const maximo = Math.max(...previas.map((x) => x.h));
      if (recientes.some((x) => x.h > maximo) && c.c < maximo) confs.push('barrido');
    }
  }

  // Fair Value Gap
  const fvgs = detectarFVG(candles.slice(Math.max(0, i-10), i+1));
  const fvgCoincide = fvgs.some(fvg => dir === 'buy' ? fvg.tipo === 'bullish' && c.l <= fvg.top && c.l >= fvg.bottom : fvg.tipo === 'bearish' && c.h >= fvg.bottom && c.h <= fvg.top);
  if (fvgCoincide) confs.push('fvg');

  return confs;
}

export function findSignals(candles, cfg, symbol) {
  // Aplicar parámetros por sesión
  const now = Date.now();
  const sesionActual = sessionOf(now, cfg.sesiones?.offsetUtc || -4);
  const cfgSesion = cfg.porSesion?.[sesionActual] || {};
  const cfgAplicado = { ...cfg, ...cfgSesion };

  const { highs, lows } = pivots(candles, cfgAplicado.pivote);
  const obs = buildOrderBlocks(candles, cfgAplicado);
  const sesiones = symbol.sesiones || cfg.sesiones.permitidas;
  const cfgSesiones = { ...cfg.sesiones, permitidas: sesiones };
  const señales = [];

  console.log('  [Sesión: ' + sesionActual + '] Confluencias min: ' + cfgAplicado.confluenciasMinimas + ', Fuerza: ' + cfgAplicado.fuerzaImpulsoAtr);

  for (const ob of obs) {
    const buffer = cfgAplicado.bufferSlAtr * ob.atr;
    const sl = ob.dir === 'buy' ? ob.bottom - buffer : ob.top + buffer;

    let llegada = -1;

    // Criterio 4: si la zona recibió toques antes de la entrada, está mitigada.
    for (let i = ob.breakIdx + 2; i < candles.length; i += 1) {
      if (tocaZona(candles[i], ob)) {
        llegada = i;
        break;
      }
      if (zonaRota(candles[i], ob)) break;
    }

    if (llegada < 0 || llegada >= candles.length - 1) continue;

    for (let i = llegada; i < Math.min(llegada + cfgAplicado.ventanaConfirmacion, candles.length - 1); i += 1) {
      if (zonaRota(candles[i], ob)) break;
      if (!inSession(candles[i].t, cfgSesiones)) continue;

      const confs = confluenciasEn(candles, i, ob);
      if (confs.length < cfgAplicado.confluenciasMinimas) continue;

      const entry = candles[i].c;
      const riesgo = ob.dir === 'buy' ? entry - sl : sl - entry;
      if (!(riesgo > 0)) break;

      // Objetivo: ratio fijo 1:2 como solicitado
      let tp = ob.dir === 'buy' ? entry + riesgo * 2 : entry - riesgo * 2;

      // Calcular calidad de señal
      let calidad = confs.length;
      if (ob.fuerza >= 2) calidad += 1;
      if (confs.includes('barrido')) calidad += 1;
      if (confs.includes('envolvente')) calidad += 1;
      let grado = 'B';
      if (calidad >= 5) grado = 'A+';
      else if (calidad >= 4) grado = 'A';
      else if (calidad >= 3) grado = 'B+';

      señales.push({
        symbol: symbol.id,
        nombre: symbol.nombre,
        dir: ob.dir,
        entry,
        sl,
        tp,
        riesgo,
        ratio: 2,
        t: candles[i].t,
        idx: i,
        confluencias: confs,
        zona: { top: ob.top, bottom: ob.bottom },
        calidad: grado,
        score: calidad
      });
      break;
    }
  }

  return señales;
}
