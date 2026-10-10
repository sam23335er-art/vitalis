// Копирует WASM-файлы распознавания позы в public/, чтобы сайт не зависел от CDN.
// Запускается автоматически перед dev и build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = path.join(root, 'public/mediapipe/wasm');
const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'];

if (!fs.existsSync(src)) {
  console.warn('[mediapipe] пакет не установлен — выполните npm install');
  process.exit(0);
}
fs.mkdirSync(dst, { recursive: true });
for (const f of files) {
  const from = path.join(src, f);
  const to = path.join(dst, f);
  if (!fs.existsSync(from)) continue;
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
  fs.copyFileSync(from, to);
}
console.log('[mediapipe] WASM-файлы готовы: public/mediapipe/wasm');
