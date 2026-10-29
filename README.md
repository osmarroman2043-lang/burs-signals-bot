# Jarvis — fase 1

Asistente personal por voz que corre en tu máquina. Le hablás, te contesta en voz alta.

Sin dependencias, sin build, sin frameworks: un servidor Node de ~150 líneas y una interfaz web.
Voz de entrada y de salida con las APIs nativas del navegador (gratis, sin servicios extra).

## Qué hace hoy

- **Habla:** tocás el círculo, hablás, Jarvis transcribe, piensa y responde en voz alta.
- **Modo continuo:** queda escuchando y solo actúa cuando decís «Jarvis …».
- **Memoria de la charla:** las últimas 20 vueltas viajan en cada pedido y quedan guardadas en el navegador.
- **Escribir también sirve:** el campo de texto usa el mismo cerebro.
- **Voz elegible:** lista de voces en español que tenga tu sistema.

## Arrancarlo

Requisito: Node 22 o superior (acá ya está el 24).

```bash
cp .env.example .env
# editá .env y poné tu clave en OPENAI_API_KEY
npm start
```

Abrí http://127.0.0.1:4321 y permitile el micrófono al navegador.

Para desarrollo con recarga: `npm run dev`.

### El cerebro

El servidor habla el protocolo estándar de `/chat/completions` de OpenAI, así que sirve cualquier
proveedor compatible cambiando `OPENAI_BASE_URL` y `MODEL`:

| Opción | `OPENAI_BASE_URL` | `MODEL` |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | el que elijas |
| Ollama local | `http://127.0.0.1:11434/v1` | `llama3.1` |

La clave vive solo en `.env`, en el servidor: nunca llega al navegador.

## Cómo está armado

```
server.js          servidor HTTP: sirve public/ y expone /api/chat y /api/status
public/index.html  interfaz
public/app.js      micrófono, wake word, voz de salida, historial
public/style.css   estilos
```

## Límites conocidos de esta fase

- El dictado usa el servicio de voz del navegador: funciona en Chrome, Edge y Safari; en Firefox no hay micrófono (el texto sí).
- No hay herramientas: Jarvis conversa, todavía no abre apps, no lee archivos ni busca en internet.
- No hay memoria entre sesiones más allá del historial del navegador.
- El modo continuo depende de que la pestaña siga abierta y con el micrófono permitido.

## Fase 2, candidatos

1. Herramientas reales: hora, clima, abrir programas, buscar en la web.
2. Memoria persistente en un archivo o base local.
3. Voz de ElevenLabs para una voz más natural.
4. Correrlo como app de escritorio (bandeja del sistema) en vez de pestaña.
