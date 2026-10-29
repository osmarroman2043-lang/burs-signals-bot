// Baja los subtítulos automáticos en español de una lista de videos.
// Uso: node scripts/transcripts.mjs <id> [id...]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'research', 'transcripts');
const ids = process.argv.slice(2);

if (ids.length === 0) {
  console.error('Pasá al menos un ID de video.');
  process.exit(1);
}

const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
};

async function getTracks(id) {
  const res = await fetch('https://www.youtube.com/watch?v=' + id, { headers: HEADERS });
  const html = await res.text();
  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return [];
  try {
    return JSON.parse(match[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
  } catch {
    return [];
  }
}

function pickTrack(tracks) {
  return (
    tracks.find((t) => t.languageCode === 'es' && t.kind === 'asr') ||
    tracks.find((t) => t.languageCode === 'es') ||
    tracks.find((t) => t.kind === 'asr') ||
    tracks[0]
  );
}

async function getTranscript(track) {
  const url = track.baseUrl + '&fmt=json3';
  const res = await fetch(url, { headers: HEADERS });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return '';
  }
  const events = data.events || [];
  const lines = [];
  let lastEnd = 0;
  for (const event of events) {
    const text = (event.segs || []).map((s) => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = Math.round((event.tStartMs || 0) / 1000);
    if (start - lastEnd >= 20) lines.push('');
    lastEnd = start;
    lines.push('[' + formatTime(start) + '] ' + text);
  }
  return lines.join('\n');
}

function formatTime(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

async function getTitle(id) {
  const res = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json', {
    headers: HEADERS,
  });
  if (!res.ok) return id;
  const data = await res.json().catch(() => null);
  return data?.title || id;
}

await mkdir(OUT_DIR, { recursive: true });

for (const id of ids) {
  try {
    const tracks = await getTracks(id);
    const track = pickTrack(tracks);
    if (!track) {
      console.log('SIN SUBTÍTULOS  ' + id);
      continue;
    }
    const text = await getTranscript(track);
    const title = await getTitle(id);
    const file = path.join(OUT_DIR, id + '.txt');
    await writeFile(file, '# ' + title + '\n# ' + id + '\n\n' + text + '\n', 'utf8');
    console.log('OK  ' + id + '  ' + text.length + ' chars  ' + title);
  } catch (err) {
    console.log('FALLO  ' + id + '  ' + err.message);
  }
}
