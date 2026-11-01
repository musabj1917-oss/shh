import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedHtml = '';

export function getWebUiHtml(): string {
  if (cachedHtml) return cachedHtml;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const htmlPath = path.resolve(__dirname, '../../web/index.html');
    if (fs.existsSync(htmlPath)) {
      cachedHtml = fs.readFileSync(htmlPath, 'utf8');
      return cachedHtml;
    }
  } catch {}
  return `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/v1/health"></head><body>Redirecting to Haiku API...</body></html>`;
}
