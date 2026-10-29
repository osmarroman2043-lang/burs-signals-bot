import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const raiz = new URL('..', import.meta.url);
const perfPath = path.join(new URL('.state', raiz).pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'performance.json');

export async function guardarSeñal(señal) {
  try {
    const data = await readFile(perfPath, 'utf8');
    const perf = JSON.parse(data);
    perf.señales.push({ ...señal, status: 'abierta', timestamp: Date.now() });
    await writeFile(perfPath, JSON.stringify(perf, null, 2));
  } catch {
    await mkdir(path.dirname(perfPath), { recursive: true });
    await writeFile(perfPath, JSON.stringify({ señales: [{ ...señal, status: 'abierta', timestamp: Date.now() }], stats: { ganadas: 0, perdidas: 0, total: 0 } }, null, 2));
  }
}

export async function obtenerEstadisticas() {
  try {
    const data = await readFile(perfPath, 'utf8');
    const perf = JSON.parse(data);
    const total = perf.señales.length;
    const ganadas = perf.señales.filter(s => s.status === 'ganada').length;
    const perdidas = perf.señales.filter(s => s.status === 'perdida').length;
    const winrate = total > 0 ? ((ganadas / total) * 100).toFixed(1) : 0;
    return { total, ganadas, perdidas, winrate };
  } catch {
    return { total: 0, ganadas: 0, perdidas: 0, winrate: 0 };
  }
}
