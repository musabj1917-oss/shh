import { getRequestListener } from '@hono/node-server';

let nodeListener: any = null;
let appInstance: any = null;
let loadError: any = null;

async function loadApp() {
  if (appInstance && nodeListener) {
    return { app: appInstance, listener: nodeListener };
  }
  if (loadError) throw loadError;

  try {
    const mod = await import('./src/app.js');
    appInstance = mod.default;
    nodeListener = getRequestListener(appInstance.fetch);
    return { app: appInstance, listener: nodeListener };
  } catch (err: any) {
    loadError = err;
    console.error('[Haiku API] Failed to load application module:', err);
    throw err;
  }
}

export default async function handler(req: any, res?: any) {
  try {
    const { app, listener } = await loadApp();
    if (res && typeof res.writeHead === 'function') {
      return await listener(req, res);
    }
    return await app.fetch(req);
  } catch (err: any) {
    const errorBody = JSON.stringify({
      status: 'error',
      code: 'FUNCTION_INIT_FAILED',
      message: err?.message || String(err),
      stack: process.env.NODE_ENV === 'production' ? err?.stack : undefined,
    }, null, 2);

    if (res && typeof res.writeHead === 'function') {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(errorBody);
      return;
    }

    return new Response(errorBody, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
