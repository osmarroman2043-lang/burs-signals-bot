const $ = (id) => document.getElementById(id);

const orb = $('orb');
const statusEl = $('status');
const hintEl = $('hint');
const heardEl = $('heard');
const logEl = $('log');
const banner = $('banner');
const composer = $('composer');
const textInput = $('text');
const voiceSelect = $('voice');
const continuousToggle = $('continuous');
const resetBtn = $('reset');

const STORAGE_KEY = 'jarvis.entries.v1';

const HINTS = {
  idle: 'Tocá el círculo y hablá.',
  listening: 'Te escucho…',
  thinking: 'Pensando…',
  speaking: 'Hablando…',
};

const LABELS = {
  idle: 'en espera',
  listening: 'escuchando',
  thinking: 'pensando',
  speaking: 'hablando',
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;

let entries = loadEntries();
let state = 'idle';
let pending = false;
let recognition = null;
let wantListening = false;
let armed = false;
let voices = [];

/* ---------- estado visual ---------- */

function setState(next) {
  state = next;
  statusEl.dataset.state = next;
  statusEl.textContent = LABELS[next] || next;
  orb.dataset.state = next;
  hintEl.textContent = HINTS[next] || '';
}

/* ---------- almacenamiento ---------- */

function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((e) => e && typeof e.content === 'string' && ['user', 'assistant', 'error'].includes(e.role)).slice(-40);
  } catch {
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-40)));
  } catch {
    /* modo privado: seguimos sin persistir */
  }
}

function addEntry(role, content) {
  entries.push({ role, content, at: Date.now() });
  entries = entries.slice(-40);
  saveEntries();
  render();
}

function render() {
  logEl.replaceChildren(
    ...entries.map((entry) => {
      const li = document.createElement('li');
      li.dataset.role = entry.role;
      const tag = document.createElement('span');
      tag.textContent = entry.role === 'user' ? 'vos' : entry.role === 'assistant' ? 'jarvis' : 'aviso';
      const body = document.createElement('div');
      body.textContent = entry.content;
      li.append(tag, body);
      return li;
    })
  );
  logEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

/* ---------- voz de salida ---------- */

function loadVoices() {
  if (!canSpeak) return;
  const all = speechSynthesis.getVoices();
  if (!all.length) return;
  voices = all.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!voices.length) voices = all;

  const previous = voiceSelect.value;
  voiceSelect.replaceChildren(
    ...voices.map((v) => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = v.name + ' · ' + v.lang;
      return opt;
    })
  );
  if (previous && voices.some((v) => v.name === previous)) voiceSelect.value = previous;
}

function speechText(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' bloque de código ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function speak(text) {
  if (!canSpeak) {
    setState('idle');
    resumeListening();
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speechText(text));
  const chosen = voices.find((v) => v.name === voiceSelect.value);
  if (chosen) utterance.voice = chosen;
  utterance.lang = chosen?.lang || 'es-ES';
  utterance.rate = 1.03;
  utterance.pitch = 1;

  const done = () => {
    if (state !== 'speaking') return;
    setState('idle');
    resumeListening();
  };
  utterance.onend = done;
  utterance.onerror = done;

  setState('speaking');
  speechSynthesis.speak(utterance);
}

/* ---------- reconocimiento ---------- */

function buildRecognition() {
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.lang = 'es-ES';
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = (result[0]?.transcript || '').trim();
      if (!text) continue;
      if (result.isFinal) onFinalTranscript(text);
      else interim += text + ' ';
    }
    if (interim.trim()) heardEl.textContent = interim.trim();
  };

  rec.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      wantListening = false;
      setState('idle');
      hintEl.textContent = 'El navegador bloqueó el micrófono. Permitilo en el candado de la barra de direcciones.';
      return;
    }
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    console.warn('[voz] error', event.error);
  };

  rec.onend = () => {
    if (wantListening && !pending && state !== 'speaking') {
      setTimeout(() => startListening({ keepArmed: true }), 250);
    }
  };

  return rec;
}

function onFinalTranscript(text) {
  heardEl.textContent = text;
  if (pending || state === 'speaking' || state === 'thinking') return;

  let command = text;

  if (continuousToggle.checked) {
    const match = command.match(/\bjarvis\b[,:]?\s*/i);
    if (!match) {
      if (!armed) return;
    }
    if (match) {
      command = (command.slice(0, match.index) + ' ' + command.slice(match.index + match[0].length)).trim();
      armed = true;
    }
    if (!command) {
      hintEl.textContent = 'Decime qué necesitás.';
      return;
    }
  }

  ask(command);
}

function startListening(options = {}) {
  if (!SpeechRecognition || pending || state === 'speaking') return;
  if (!options.keepArmed) armed = false;

  if (!recognition) recognition = buildRecognition();
  if (!recognition) {
    hintEl.textContent = 'Este navegador no soporta dictado por voz. Escribí abajo.';
    return;
  }

  recognition.continuous = continuousToggle.checked;
  wantListening = true;

  try {
    recognition.start();
    setState('listening');
    heardEl.textContent = '';
  } catch {
    /* ya estaba escuchando */
  }
}

function stopListening() {
  wantListening = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch {
      /* nada que detener */
    }
  }
}

function resumeListening() {
  if (!continuousToggle.checked) {
    armed = false;
    return;
  }
  if (wantListening) startListening();
}

/* ---------- conversación ---------- */

async function ask(text) {
  const clean = text.trim();
  if (!clean || pending) return;

  pending = true;
  stopListening();
  heardEl.textContent = clean;
  addEntry('user', clean);
  setState('thinking');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: entries
          .filter((e) => e.role === 'user' || e.role === 'assistant')
          .slice(-20)
          .map(({ role, content }) => ({ role, content })),
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      addEntry('error', data?.error || 'El servidor respondió ' + response.status + '.');
      if (response.status === 503) banner.hidden = false;
      setState('idle');
      return;
    }

    banner.hidden = true;
    addEntry('assistant', data.reply);
    pending = false;
    speak(data.reply);
    return;
  } catch (err) {
    addEntry('error', 'No pude hablar con el servidor: ' + err.message);
    setState('idle');
  } finally {
    pending = false;
    if (state === 'thinking') setState('idle');
  }
}

/* ---------- eventos ---------- */

orb.addEventListener('click', () => {
  if (state === 'speaking') {
    speechSynthesis.cancel();
    setState('idle');
    return;
  }
  if (wantListening) {
    stopListening();
    setState('idle');
    return;
  }
  startListening();
});

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = textInput.value;
  textInput.value = '';
  ask(text);
});

voiceSelect.addEventListener('change', () => {
  const chosen = voices.find((v) => v.name === voiceSelect.value);
  if (chosen) speak('Listo, esta es mi voz.');
});

continuousToggle.addEventListener('change', () => {
  if (continuousToggle.checked) {
    startListening();
  } else {
    stopListening();
    setState('idle');
  }
});

resetBtn.addEventListener('click', () => {
  entries = [];
  saveEntries();
  render();
  speechSynthesis?.cancel();
  stopListening();
  setState('idle');
});

if (canSpeak) {
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

if (!SpeechRecognition) {
  hintEl.textContent = 'Este navegador no soporta dictado por voz. Escribí abajo: Jarvis igual funciona.';
}

setState('idle');
render();

fetch('/api/status')
  .then((r) => r.json())
  .then((status) => {
    if (status.brain !== 'conectado') banner.hidden = false;
  })
  .catch(() => {
    banner.hidden = false;
  });
