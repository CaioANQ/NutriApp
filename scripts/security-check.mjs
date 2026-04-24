import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, 'public');
const forbidden = [
  'anthropic-dangerous-direct-browser-access',
  'x-api-key',
  'https://api.anthropic.com',
  'sessionStorage.setItem("nutri_api_key"',
];

const files = await readdir(publicDir);
let failed = false;

for (const file of files.filter((name) => name.endsWith('.html'))) {
  const source = await readFile(path.join(publicDir, file), 'utf8');
  for (const pattern of forbidden) {
    if (source.includes(pattern)) {
      failed = true;
      console.error(`[security] ${file}: encontrou padrão proibido: ${pattern}`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('[security] OK: nenhuma chave ou chamada direta de IA no frontend servido.');
}
