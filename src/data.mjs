// Datos OHLC desde el endpoint público de Yahoo Finance (sin API key).
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};

export async function fetchCandles(symbol, { intervalo = '15m', rango = '60d' } = {}) {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) +
    '?range=' +
    rango +
    '&interval=' +
    intervalo +
    '&includePrePost=false';

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('Yahoo respondió ' + res.status + ' para ' + symbol);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Sin datos para ' + symbol + ': ' + (json?.chart?.error?.description || 'desconocido'));

  const times = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const candles = [];

  for (let i = 0; i < times.length; i += 1) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    if ([o, h, l, c].some((v) => typeof v !== 'number' || !Number.isFinite(v))) continue;
    candles.push({ t: times[i] * 1000, o, h, l, c, v: quote.volume?.[i] ?? 0 });
  }

  return candles;
}
