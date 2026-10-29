// Convierte los .vtt de subtítulos automáticos a texto plano legible.
// Uso: node scripts/vtt2txt.mjs
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'research', 'transcripts');

function stripTags(line) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTime(stamp) {
  const m = stamp.match(/(\d+):(\d+):(\d+)\.(\d+)/) || stamp.match(/(\d+):(\d+)\.(\d+)/);
  if (!m) return 0;
  if (m.length === 5) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + String(s).padStart(2, '0');
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.vtt'));

for (const name of files) {
  const raw = await readFile(path.join(DIR, name), 'utf8');
  const lines = raw.split(/\r?\n/);

  const cues = [];
  let currentTime = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('-->')) {
      currentTime = parseTime(line);
      continue;
    }
    if (!line || /^WEBVTT/.test(line) || /^(Kind|Language):/.test(line)) continue;
    const text = stripTags(line);
    if (!text) continue;
    cues.push({ t: currentTime, text });
  }

  // Los subtítulos automáticos repiten la línea anterior: descartamos duplicados seguidos.
  const unique = [];
  for (const cue of cues) {
    const last = unique[unique.length - 1];
    if (last && (last.text === cue.text || last.text.endsWith(cue.text))) continue;
    if (last && cue.text.endsWith(last.text)) {
      unique[unique.length - 1] = cue;
      continue;
    }
    unique.push(cue);
  }

  const paragraphs = [];
  let buffer = [];
  let bufferStart = 0;
  for (const cue of unique) {
    if (buffer.length === 0) bufferStart = cue.t;
    buffer.push(cue.text);
    if (cue.t - bufferStart >= 45) {
      paragraphs.push('[' + fmt(bufferStart) + '] ' + buffer.join(' ').replace(/\s+/g, ' ').trim());
      buffer = [];
    }
  }
  if (buffer.length) {
    paragraphs.push('[' + fmt(bufferStart) + '] ' + buffer.join(' ').replace(/\s+/g, ' ').trim());
  }

  const out = path.join(DIR, name.replace(/\.(es|es-orig)\.vtt$/, '') + '.txt');
  const body = paragraphs.join('\n\n') + '\n';
  await writeFile(out, body, 'utf8');
  await unlink(path.join(DIR, name)).catch(() => {});
  console.log('OK  ' + path.basename(out) + '  ' + body.length + ' chars');
}
