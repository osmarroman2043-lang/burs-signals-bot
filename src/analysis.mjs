// Primitivas técnicas usadas por las reglas del método.

export function atrSeries(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  let sum = 0;

  for (let i = 1; i < candles.length; i += 1) {
    const prevClose = candles[i - 1].c;
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - prevClose),
      Math.abs(candles[i].l - prevClose)
    );

    if (i <= period) {
      sum += tr;
      if (i === period) out[i] = sum / period;
      continue;
    }

    out[i] = (out[i - 1] * (period - 1) + tr) / period;
  }

  return out;
}

// Pivotes fractales: un máximo es pivote si es mayor que los `k` vecinos de cada lado.
// Se marca como confirmado recién en el índice idx + k (no se puede usar antes).
export function pivots(candles, k = 2) {
  const highs = [];
  const lows = [];

  for (let i = k; i < candles.length - k; i += 1) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= k; j += 1) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h) isHigh = false;
      if (candles[i].l >= candles[i - j].l || candles[i].l >= candles[i + j].l) isLow = false;
    }

    if (isHigh) highs.push({ idx: i, price: candles[i].h, confirmedAt: i + k });
    if (isLow) lows.push({ idx: i, price: candles[i].l, confirmedAt: i + k });
  }

  return { highs, lows };
}

export function isBullishEngulfing(prev, cur) {
  return cur.c > cur.o && prev.c < prev.o && cur.c >= prev.o && cur.o <= prev.c;
}

export function isBearishEngulfing(prev, cur) {
  return cur.c < cur.o && prev.c > prev.o && cur.c <= prev.o && cur.o >= prev.c;
}

export function isBullishPinbar(candle) {
  const body = Math.abs(candle.c - candle.o);
  const range = candle.h - candle.l;
  if (range === 0) return false;
  const lowerWick = Math.min(candle.o, candle.c) - candle.l;
  return lowerWick >= body * 2 && candle.c >= candle.l + range * 0.66;
}

export function isBearishPinbar(candle) {
  const body = Math.abs(candle.c - candle.o);
  const range = candle.h - candle.l;
  if (range === 0) return false;
  const upperWick = candle.h - Math.max(candle.o, candle.c);
  return upperWick >= body * 2 && candle.c <= candle.h - range * 0.66;
}

// Patrones adicionales
export function isDoji(candle) {
  const body = Math.abs(candle.c - candle.o);
  const range = candle.h - candle.l;
  if (range === 0) return false;
  return body / range < 0.1;
}

export function isHammer(candle) {
  const body = Math.abs(candle.c - candle.o);
  const range = candle.h - candle.l;
  if (range === 0) return false;
  const lowerWick = Math.min(candle.o, candle.c) - candle.l;
  const upperWick = candle.h - Math.max(candle.o, candle.c);
  return lowerWick >= body * 2 && upperWick < body * 0.3 && candle.c > candle.o;
}

export function isShootingStar(candle) {
  const body = Math.abs(candle.c - candle.o);
  const range = candle.h - candle.l;
  if (range === 0) return false;
  const lowerWick = Math.min(candle.o, candle.c) - candle.l;
  const upperWick = candle.h - Math.max(candle.o, candle.c);
  return upperWick >= body * 2 && lowerWick < body * 0.3 && candle.c < candle.o;
}

export function isInsideBar(c1, c2) {
  return c2.h < c1.h && c2.l > c1.l;
}

// Retroceso de Fibonacci del impulso: 0 = fin del impulso, 1 = inicio.
export function retracement(start, end, price) {
  const span = end - start;
  if (span === 0) return null;
  return (end - price) / span;
}

// Quiebre de estructura (BOS/CHoCH)
export function detectarQuiebreEstructura(candles, lookback = 20) {
  if (candles.length < lookback) return null;
  const recientes = candles.slice(-lookback);
  const highs = [];
  const lows = [];
  for (let i = 0; i < recientes.length; i++) {
    highs.push({ idx: i, price: recientes[i].h });
    lows.push({ idx: i, price: recientes[i].l });
  }
  const maxHigh = Math.max(...highs.map(h => h.price));
  const minLow = Math.min(...lows.map(l => l.price));
  const lastCandle = recientes[recientes.length - 1];
  if (lastCandle.c > maxHigh * 0.9995) return { tipo: 'BOS', direccion: 'alcista', nivel: maxHigh };
  if (lastCandle.c < minLow * 1.0005) return { tipo: 'BOS', direccion: 'bajista', nivel: minLow };
  return null;
}

// Soportes y resistencias
export function detectarSoportesResistencias(candles, lookback = 50) {
  if (candles.length < lookback) return { soportes: [], resistencias: [] };
  const recientes = candles.slice(-lookback);
  const niveles = [];
  for (let i = 2; i < recientes.length - 2; i++) {
    if (recientes[i].h > recientes[i-1].h && recientes[i].h > recientes[i-2].h && 
        recientes[i].h > recientes[i+1].h && recientes[i].h > recientes[i+2].h) {
      niveles.push({ tipo: 'resistencia', precio: recientes[i].h, fuerza: 3 });
    }
    if (recientes[i].l < recientes[i-1].l && recientes[i].l < recientes[i-2].l && 
        recientes[i].l < recientes[i+1].l && recientes[i].l < recientes[i+2].l) {
      niveles.push({ tipo: 'soporte', precio: recientes[i].l, fuerza: 3 });
    }
  }
  const resistencias = niveles.filter(n => n.tipo === 'resistencia').sort((a,b) => b.precio - a.precio).slice(0, 3);
  const soportes = niveles.filter(n => n.tipo === 'soporte').sort((a,b) => a.precio - b.precio).slice(0, 3);
  return { soportes, resistencias };
}

// Fair Value Gap (FVG)
export function detectarFVG(candles) {
  const fvgs = [];
  for (let i = 2; i < candles.length; i++) {
    // Bullish FVG: vela 1 alta < vela 3 baja
    if (candles[i-2].h < candles[i].l && candles[i-1].c > candles[i-1].o) {
      fvgs.push({ tipo: 'bullish', top: candles[i].l, bottom: candles[i-2].h, idx: i });
    }
    // Bearish FVG
    if (candles[i-2].l > candles[i].h && candles[i-1].c < candles[i-1].o) {
      fvgs.push({ tipo: 'bearish', top: candles[i-2].l, bottom: candles[i].h, idx: i });
    }
  }
  return fvgs;
}

// Sesiones en la hora local configurada (UTC-4 por defecto, como en su TradingView).
export const SESIONES = {
  sidney: [21, 6],
  asia: [17, 3],
  tokio: [18, 4],
  londres: [3, 12],
  ny: [8, 17],
};

export function sessionOf(ms, offsetUtc = -4) {
  const hour = new Date(ms + offsetUtc * 3600 * 1000).getUTCHours();

  for (const [nombre, [desde, hasta]] of Object.entries(SESIONES)) {
    const cruzaMedianoche = desde > hasta;
    const dentro = cruzaMedianoche ? hour >= desde || hour < hasta : hour >= desde && hour < hasta;
    if (dentro) return nombre;
  }

  return 'fuera';
}

export function inSession(ms, cfg) {
  const nombre = sessionOf(ms, cfg.offsetUtc);
  return cfg.permitidas.includes(nombre);
}

// Fórmula del video de lotaje: riesgo$ / (distancia del stop en unidades × valor por unidad).
export function calcularLotes({ capital, riesgoPct, distancia, unidad, valorUnidad }) {
  const riesgoUsd = (capital * riesgoPct) / 100;
  const puntos = distancia / unidad;
  const valorPunto = puntos * valorUnidad;
  if (!(valorPunto > 0)) return 0;
  return riesgoUsd / valorPunto;
}

export function riesgoPctParaCapital(cuenta) {
  return cuenta.capital < cuenta.umbralCuentaPequena ? cuenta.riesgoPctCuentaPequena : cuenta.riesgoPct;
}
