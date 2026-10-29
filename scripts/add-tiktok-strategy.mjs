import { readFile, writeFile } from 'node:fs/promises';
import { analizarVideoTikTok } from '../src/tiktok-analyzer.mjs';

const url = process.argv[2];

if (!url) {
  console.log('Uso: node scripts/add-tiktok-strategy.mjs <url-tiktok>');
  process.exit(1);
}

console.log('Analizando video:', url);
const info = await analizarVideoTikTok(url);
console.log('Info:', info);

// Aquí podrías procesar la info y crear una estrategia
// Por ahora solo muestra la info
console.log('\nPara implementar la estrategia, necesito:');
console.log('1. Reglas específicas (qué buscar, cuándo entrar)');
console.log('2. Indicadores usados');
console.log('3. Gestión de riesgo');
console.log('4. Horarios/sesiones');
console.log('5. Símbolos');
