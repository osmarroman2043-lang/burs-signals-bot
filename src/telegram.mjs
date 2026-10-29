// Envío de alertas por Telegram.
export function telegramConfig(cfg = {}) {
  return {
    token: process.env.TELEGRAM_TOKEN || cfg.telegram?.token || '',
    chatId: process.env.TELEGRAM_CHAT_ID || cfg.telegram?.chatId || '',
  };
}

export async function enviarTelegram(texto, cfg = {}) {
  const { token, chatId } = telegramConfig(cfg);

  if (!token || !chatId) {
    return { ok: false, motivo: 'Falta TELEGRAM_TOKEN o TELEGRAM_CHAT_ID' };
  }

  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, motivo: data?.description || 'HTTP ' + res.status };
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: err.message };
  }
}

export function formatearSeñal(señal, lotes, extra = '') {
  const flecha = señal.dir === 'buy' ? '🟢 COMPRA' : '🔴 VENTA';
  const precio = (n) => Number(n).toPrecision(6);

  return [
    '<b>' + flecha + ' · ' + señal.nombre + '</b>',
    'Entrada: <code>' + precio(señal.entry) + '</code>',
    'Stop: <code>' + precio(señal.sl) + '</code>',
    'Objetivo: <code>' + precio(señal.tp) + '</code>  (1:' + señal.ratio.toFixed(1) + ')',
    'Lotes sugeridos: <b>' + lotes + '</b>',
    'Confirmaciones: ' + señal.confluencias.join(', '),
    'Zona: ' + precio(señal.zona.bottom) + ' – ' + precio(señal.zona.top),
    extra,
  ]
    .filter(Boolean)
    .join('\n');
}
