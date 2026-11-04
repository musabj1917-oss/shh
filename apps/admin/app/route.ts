import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const possiblePaths = [
    path.resolve(process.cwd(), '../web/index.html'),
    path.resolve(process.cwd(), '../../apps/web/index.html'),
    path.resolve(process.cwd(), 'public/index.html'),
  ];
  let html = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      html = fs.readFileSync(p, 'utf8');
      break;
    }
  }
  if (!html) {
    return new Response('Web UI loading...', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
