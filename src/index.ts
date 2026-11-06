import { getRequestListener } from '@hono/node-server';
import app from './app.js';

const nodeListener = getRequestListener(app.fetch);

function handler(req: any, res?: any) {
  if (res && typeof res.writeHead === 'function') {
    return nodeListener(req, res);
  }
  return app.fetch(req);
}

// Copy Hono instance methods so it satisfies framework inspectors and adapters
Object.assign(handler, app);
(handler as any).fetch = app.fetch.bind(app);
(handler as any).request = app.request.bind(app);

export default handler;
export { app };
