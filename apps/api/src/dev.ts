import { serve } from '@hono/node-server';
import app from './app.js';

const port=Number.parseInt(process.env.PORT||'3001',10)||3001;
serve({fetch:app.fetch,port,hostname:'0.0.0.0'},(info)=>{
  console.info(`Haiku API listening on http://0.0.0.0:${info.port}`);
});
