import { readFile, writeFile } from 'node:fs/promises';
import { fetchCandles } from './data.mjs';

const perfPath = new URL('../.state/performance.json', import.meta.url);

async function checkResults() {
  try {
    const data = await readFile(perfPath, 'utf8');
    const perf = JSON.parse(data);
    let updated = false;
    
    for (let s of perf.señales) {
      if (s.status === 'abierta') {
        try {
          const candles = await fetchCandles(s.symbol, { intervalo: '15m', rango: '1d' });
          const last = candles[candles.length - 1];
          if (s.dir === 'buy') {
            if (last.h >= s.tp) {
              s.status = 'ganada';
              updated = true;
            } else if (last.l <= s.sl) {
              s.status = 'perdida';
              updated = true;
            }
          } else {
            if (last.l <= s.tp) {
              s.status = 'ganada';
              updated = true;
            } else if (last.h >= s.sl) {
              s.status = 'perdida';
              updated = true;
            }
          }
        } catch(e) {}
      }
    }
    
    if (updated) {
      await writeFile(perfPath, JSON.stringify(perf, null, 2));
      console.log('Resultados actualizados');
    }
  } catch(e) {}
}

checkResults();
setInterval(checkResults, 60000);
