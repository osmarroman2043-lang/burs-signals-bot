import { preview_open, preview_evaluate, preview_navigate, preview_wait } from '../functions.js';

export async function analizarVideoTikTok(url) {
  // Abrir video en navegador
  const browser = await preview_open({ url, reuse: true });
  
  // Esperar un poco para que cargue
  await new Promise(r => setTimeout(r, 3000));
  
  // Extraer información
  const info = await preview_evaluate({
    expression: `
      (function() {
        const desc = document.querySelector('[data-e2e="video-desc"]')?.innerText || '';
        const author = document.querySelector('[data-e2e="video-author-nickname"]')?.innerText || '';
        const music = document.querySelector('[data-e2e="video-music"]')?.innerText || '';
        return { desc, author, music };
      })()
    `
  });
  
  return info.result;
}
