# Bot de señales — uso

Motor que aplica las reglas objetivas del método documentado en [metodo-burs.md](metodo-burs.md)
sobre datos de mercado reales, y manda las señales por Telegram.

## Arrancar

```bash
cp .env.example .env      # completá TELEGRAM_TOKEN y TELEGRAM_CHAT_ID
npm run scan              # un escaneo: busca señales nuevas y las envía
npm run backtest          # mide el método sobre los últimos ~60 días
npm start                 # servidor: webhook de TradingView + /health + /scan
```

Requisito: Node 22+ (ya está en la máquina). Sin dependencias.

## Qué hace cada comando

| Comando | Qué hace |
| --- | --- |
| `npm run scan` | Descarga velas, busca order blocks válidos con ≥2 confirmaciones, filtra por sesión y por noticias, calcula el lotaje y envía por Telegram. Guarda en `.state/enviadas.json` lo ya enviado para no repetir. |
| `npm run backtest` | Simula las mismas señales sobre el histórico y muestra acierto, R total, profit factor y drawdown máximo. |
| `npm start` | Levanta el servidor en `127.0.0.1:4322` con `GET /health`, `POST /tv-alert` y `POST /scan`. |

Para que corra solo, programá `npm run scan` cada 5–15 minutos con el Programador de tareas de
Windows (o un cron en Linux/Mac).

## Configuración (`config.json`)

- `cuenta`: capital y riesgo. Usa 1% si el capital es ≥ $1,000 y 10% si es menor, como en el video de lotaje.
- `sesiones`: `offsetUtc` (-4, igual que su TradingView) y qué sesiones se permiten.
- `metodo`: ATR, fuerza mínima del impulso, confirmaciones mínimas, buffer del stop, ratio de TP, toques permitidos en la zona.
- `simbolos`: activos, valor por punto/unidad (depende de tu broker) y sesiones.
- `noticias`: ventana en minutos y si bloquea la señal.

Subir `confluenciasMinimas` a 3 deja menos señales y más exigentes; bajarlo a 1 dispara mucho ruido.

## TradingView

TradingView **no tiene API pública** para leer gráficos ni datos de tu cuenta. Lo que sí tiene es
**alertas con webhook**, y así se conecta:

1. `npm start` (y si querés recibir desde internet, expone el puerto con un túnel o un VPS y poné `TV_SECRET`).
2. En TradingView: tu alerta → *Notificaciones* → **Webhook URL**:
   `http://TU-HOST:4322/tv-alert?token=TU_SECRETO`
3. Cuerpo del mensaje, por ejemplo:
   ```json
   {"symbol":"{{ticker}}","price":"{{close}}","interval":"{{interval}}","message":"Ruptura de máximo en {{interval}}"}
   ```
4. Cada vez que se dispare, llega a Telegram con el formato del bot.

Lo que **no** hace: entrar a tu cuenta, leer tus gráficos dibujados ni analizar capturas. El video de
"Claude + TradingView" usa un conector que automatiza un navegador con tu sesión; eso es frágil,
rompe con cada cambio de la web y va contra los términos de TradingView.

## Noticias

El bot lee el calendario económico semanal de ForexFactory (`src/news.mjs`) y:

- **bloquea** señales a ±30 minutos de un evento de alto impacto de las monedas del activo;
- agrega al mensaje las próximas noticias de alto impacto del activo en las próximas 12 h.

Si el calendario no responde, el bot sigue funcionando sin filtro (no bloquea todo).

## Resultado del backtest (28/10/2026, velas de 15m, ~60 días)

| Activo | Señales | Acierto | R total | Profit factor |
| --- | --- | --- | --- | --- |
| Nasdaq (`NQ=F`) | 30 | 36,7% | +2,50 | 1,13 |
| Oro (`GC=F`) | 100 | 38,5% | +22,94 | 1,39 |
| EUR/USD | 123 | 31,1% | +0,12 | 1,00 |

Global: 248 operaciones, 34,7% de acierto, +25,56R, esperanza 0,103R por operación,
**drawdown máximo 18,3R**. Es decir: ligeramente positivo, con rachas largas en contra y sin margen
para errores. No alcanza para operar dinero real tal cual.

## Límites honestos

- El bot aplica reglas objetivas; no tiene el criterio de un mentor leyendo contexto, noticias y estructura fina.
- No incluye spreads, comisiones ni slippage: el resultado real es peor que el del backtest.
- El valor del punto por lote **depende de tu broker**; está configurado con los valores del video ($10/punto en Nasdaq, $10 por pip en EUR/USD).
- Los datos vienen de Yahoo Finance (gratis, sin clave): pueden faltar velas o venir con retraso.
- Nada de esto es recomendación de inversión.
