import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedHtml = '';

export function getWebUiHtml(): string {
  if (cachedHtml) return cachedHtml;
  try {
    const paths = [
      path.resolve(process.cwd(), 'public/index.html'),
      path.resolve(process.cwd(), 'apps/web/index.html'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        cachedHtml = fs.readFileSync(p, 'utf8');
        return cachedHtml;
      }
    }
  } catch {}
  return `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/v1/health"></head><body>Redirecting to Haiku API...</body></html>`;
}
