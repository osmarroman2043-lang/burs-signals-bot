# Método BURS — lo que se puede extraer de sus videos públicos

Extraído de los guiones (subtítulos automáticos) de los videos del canal. Cada regla apunta al
video y minuto donde se dice, para que puedas verificarla. Los guiones crudos quedaron en
`research/transcripts/`.

> Esto es una reconstrucción de material educativo público. No es el curso pago, no es
> recomendación de inversión y no garantiza resultados. El método completo (plantillas, gestión de
> drawdown, psicología) vive en su formación.

---

## 1. Order blocks — 4 criterios
Video: *Cómo encontrar un order block válido: 4 reglas indispensables* (`rNpN2d912JE`)

| # | Regla | Minuto |
| --- | --- | --- |
| 1 | El precio debe **romper un mínimo o máximo anterior** para que se forme el OB | 0:50 |
| 2 | Marcar **la última vela contraria** antes del impulso: en compras la última bajista, en ventas la última alcista; se marca **toda la vela** | 1:39 |
| 3 | Al salir de la zona, el movimiento debe tener **fuerza** (velas de poder) | 2:27 |
| 4 | El OB **no debe estar mitigado**: si ya fue tocado varias veces (acumulación), no sirve | 4:02 |

Entrada y salida (minuto 6:24): orden en la zona del OB, **stop siempre al otro lado de la zona**
(por encima en ventas, por debajo en compras), **TP en el último máximo/mínimo anterior**.

## 2. Confirmaciones — mínimo 2 o 3 antes de entrar
Video: *Las 5 mejores confirmaciones de trading* (`miUFDjgCmsE`)

| # | Confirmación | Minuto |
| --- | --- | --- |
| 1 | **Cierre de vela a favor** (doji o envolvente) | 0:47 |
| 2 | **Quiebre interno / cambio de estructura** | 1:32 |
| 3 | **Vela de reversión potente** (pinbar; más fuerte en 1H, cuanto más mechón mejor) | 2:21 |
| 4 | **Confluencia** con Fibonacci 61–78% del impulso y soporte/resistencia u OB histórico | 3:09 |
| 5 | **Barrido de liquidez + reversión** (barre máximos/mínimos y luego vela envolvente) | 4:46 |

Regla práctica textual: *"esperar mínimo dos o tres confirmaciones antes de ejecutar tu entrada"*.

## 3. Zonas de oferta y demanda
Video: *Cómo identificar zonas de oferta y demanda* (`DHxfKGiR7GQ`)

- La zona se dibuja con la **vela contraria** y se opera como rectángulo, no como línea (0:55).
- Nace en **acumulaciones** o tras un **quiebre estructural** (1:43 – 2:30).
- **Dos toques** ya habilitan la operación; **más de tres toques la debilitan** y puede sacarte en stop (3:17).
- Se confirma bajando a temporalidad menor buscando quiebres de estructura, y se suma liquidez sobre la zona (4:05).

## 4. Temporalidades
Videos: *Cuántas temporalidades usar* (`PRvV5wGFS78`), *Mejor temporalidad* (`vzOk_gBDBoU`),
*Intertemporalidades macro y micro* (`NQrZgp0ZprQ`)

Bloque de trabajo de referencia (minuto 1:32):

- **Dirección:** 30 min – 1 h
- **Niveles y confirmaciones:** 10 min – 5 min (a veces 15)
- **Ejecución:** 1 – 3 min
- **Macro:** 4 h / diario, revisado por temporada, no todos los días (5:34)

Uso del macro (3:09 y 4:00): si el macro **acompaña** al micro, se pueden buscar recorridos largos;
si va **en contra**, se opera igual pero con **parciales y objetivos cortos**.

## 5. Sesiones de mercado (UTC −4, como en su TradingView)
Video: *Guía de sesiones de mercado* (`zQmsTz1yTIA`)

| Sesión | Horario | Activos que mencionan |
| --- | --- | --- |
| Asia | 17:00 – 03:00 (prudente 19:00 – 01/02) | JPY, AUD, NZD |
| Londres | 03:00 – 11/12:00 | EUR, GBP, CHF |
| Nueva York | 08:00 – 17:00 | EUR, GBP (solape) + USD, CAD |
| Solape Londres/NY | 08:00 – 12:00 | mayor volatilidad |

Forex opera 24/5: abre domingo por la tarde, cierra viernes por la tarde (0:54).

## 6. Riesgo y lotaje
Video: *Cómo calcular el lotaje en el Nasdaq* (`wq2YXTtWTKw`)

- Cuenta **> $1,000**: arriesgar **1%** por operación (0:50).
- Cuenta **< $1,000**: hasta **10%** para poder escalarla (0:50).
- Fórmula (4:53): **lotes = riesgo en $ ÷ (distancia del stop en puntos × valor por punto)**.
- Nasdaq: 1 lote ≈ $10 por punto (contrato 10), 0.1 lote ≈ $1 por punto, 0.01 ≈ $0.10 (2:27).
- El valor del punto **varía por broker**: se verifica en las propiedades del símbolo (3:17).
- Errores: usar siempre el mismo lotaje, no verificar el valor del punto, confundir pips con puntos (9:03).

---

## Qué de esto quedó automatizado (y qué no)

| Regla | Automatizada | Cómo |
| --- | --- | --- |
| Ruptura de estructura | Sí | cierre más allá del último swing |
| Última vela contraria = OB | Sí | se marca toda la vela |
| Fuerza del impulso | Aproximada | impulso ≥ 1.5 × ATR(14) |
| OB no mitigado | Sí | cero toques previos a la entrada |
| Confirmaciones (≥2) | Parcial | envolvente, pinbar, quiebre interno, Fib 61–78%, barrido de liquidez |
| Sesiones | Sí | filtro horario configurable |
| SL fuera de zona / TP en liquidez | Sí | buffer de 0.25 × ATR, objetivo en el swing previo |
| Lotaje por riesgo | Sí | fórmula del video, con valor del punto configurable |
| **Lectura discrecional del gráfico** | **No** | elegir "la mejor zona", contexto, noticias |

Esa última fila es la diferencia entre esto y su curso: el bot aplica las reglas objetivas, no el
criterio de un mentor mirando el gráfico.
