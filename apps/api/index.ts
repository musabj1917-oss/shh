import { getRequestListener } from '@hono/node-server';
import app from './src/app.js';

const nodeListener = getRequestListener(app.fetch);

export default function handler(req: any, res?: any) {
  if (res && typeof res.writeHead === 'function') {
    return nodeListener(req, res);
  }
  return app.fetch(req);
}

export { app };
