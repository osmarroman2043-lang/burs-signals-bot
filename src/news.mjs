// Calendario económico (ForexFactory) para no señalizar justo en una noticia de alto impacto.
const URL_CALENDARIO = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

const MONEDAS_POR_SIMBOLO = {
  'NQ=F': ['USD'],
  'GC=F': ['USD'],
  'EURUSD=X': ['EUR', 'USD'],
  'GBPUSD=X': ['GBP', 'USD'],
  'USDJPY=X': ['JPY', 'USD'],
  'XAUUSD=X': ['USD'],
};

let cache = { cargado: 0, eventos: [] };

export async function cargarCalendario() {
  if (Date.now() - cache.cargado < 30 * 60 * 1000) return cache.eventos;

  try {
    const res = await fetch(URL_CALENDARIO, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    cache = {
      cargado: Date.now(),
      eventos: (Array.isArray(data) ? data : [])
        .map((e) => ({
          titulo: e.title,
          moneda: e.country,
          fecha: new Date(e.date).getTime(),
          impacto: e.impact,
        }))
        .filter((e) => Number.isFinite(e.fecha)),
    };

    return cache.eventos;
  } catch (err) {
    console.log('No pude leer el calendario: ' + err.message);
    return cache.eventos;
  }
}

export function monedasDe(symbol) {
  return MONEDAS_POR_SIMBOLO[symbol] || ['USD'];
}

// Devuelve la noticia de alto impacto más cercana dentro de la ventana, o null.
export async function noticiaCerca(symbol, cuandoMs, ventanaMin = 30) {
  const eventos = await cargarCalendario();
  const monedas = monedasDe(symbol);
  const ventana = ventanaMin * 60 * 1000;

  const cercanos = eventos
    .filter((e) => e.impacto === 'High' && monedas.includes(e.moneda))
    .filter((e) => Math.abs(e.fecha - cuandoMs) <= ventana)
    .sort((a, b) => Math.abs(a.fecha - cuandoMs) - Math.abs(b.fecha - cuandoMs));

  return cercanos[0] || null;
}

export async function proximosAltoImpacto(symbol, horas = 12) {
  const eventos = await cargarCalendario();
  const monedas = monedasDe(symbol);
  const ahora = Date.now();

  return eventos
    .filter((e) => e.impacto === 'High' && monedas.includes(e.moneda))
    .filter((e) => e.fecha >= ahora && e.fecha <= ahora + horas * 3600 * 1000)
    .sort((a, b) => a.fecha - b.fecha)
    .slice(0, 5);
}
