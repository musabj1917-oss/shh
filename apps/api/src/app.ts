import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { friendRoutes } from './routes/friends.js';
import { conversationRoutes } from './routes/conversations.js';
import { mediaRoutes } from './routes/media.js';
import { groupRoutes } from './routes/groups.js';
import { storyRoutes } from './routes/stories.js';
import { reportRoutes } from './routes/reports.js';
import { accountRoutes } from './routes/account.js';
import { adminRoutes } from './routes/admin.js';
import { appPublicRoutes } from './routes/app-releases.js';
import { brandAssets } from './brand-assets.js';
import { internalRoutes } from './routes/internal.js';
import { releaseRoutes } from './routes/releases.js';
import { getDb, dbReady } from './db.js';
import { getWebUiHtml } from './web-ui.js';
import type { ApiEnv } from './types.js';

const app = new Hono<ApiEnv>();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002').split(',').map((item) => item.trim()).filter(Boolean);

app.use('*',secureHeaders({
  strictTransportSecurity: process.env.NODE_ENV==='production' ? 'max-age=31536000; includeSubDomains' : undefined,
  xFrameOptions: false,
  referrerPolicy:'no-referrer',
}));
app.use('/v1/*',cors({
  origin:(origin)=>{
    if(!origin) return '*';
    if(allowedOrigins.includes(origin)) return origin;
    if(origin.endsWith('.vercel.app')) return origin;
    if(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
    return origin;
  },
  allowMethods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowHeaders:['Authorization','Content-Type','X-Request-Id'],
  exposeHeaders:['Retry-After','X-Request-Id'],
  maxAge:600,
}));
app.use('/v1/*',async(c,next)=>{
  const localUpload=process.env.MEDIA_STORAGE==='local' && c.req.method==='PUT' && c.req.path.endsWith('/content');
  return bodyLimit({maxSize:localUpload ? 10*1024*1024 : 256*1024})(c,next);
});

// Serve Web UI for browsers, JSON info for API clients
app.get('/',(c)=>{
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    return c.html(getWebUiHtml());
  }
  return c.json({service:'haiku-api',version:'0.1.0',health:'/v1/health',web:'/app'});
});

app.get('/app',(c)=>c.html(getWebUiHtml()));
app.get('/web',(c)=>c.html(getWebUiHtml()));
for(const [assetPath,asset] of Object.entries(brandAssets)){
  app.get(assetPath,(c)=>c.body(asset.body as never,200,{'Content-Type':asset.type,'Cache-Control':'public, max-age=86400'}));
}
app.get('/v1/health',async(c)=>{
  let databaseConnected = false;
  if(dbReady()){
    try{await getDb()`SELECT 1`;databaseConnected=true;}catch{databaseConnected=false;}
  }
  return c.json({
    status:'ok',
    databaseConfigured:dbReady(),
    databaseConnected,
    realtimeConfigured:Boolean(process.env.ABLY_API_KEY),
    googleSignInConfigured:Boolean(process.env.GOOGLE_CLIENT_ID),
    mediaStorage:process.env.MEDIA_STORAGE||'local'
  });
});
app.get('/v1/health/ready',async(c)=>{
  if(!dbReady())return c.json({status:'not_ready',reason:'database_not_configured'},503);
  try{await getDb()`SELECT 1`;return c.json({status:'ready'});}catch{return c.json({status:'not_ready',reason:'database_unavailable'},503);}
});

app.route('/v1/auth',authRoutes);
app.route('/v1/profile',profileRoutes);
app.route('/v1/friends',friendRoutes);
app.route('/v1/conversations',conversationRoutes);
app.route('/v1/media',mediaRoutes);
app.route('/v1/groups',groupRoutes);
app.route('/v1/stories',storyRoutes);
app.route('/v1/reports',reportRoutes);
app.route('/v1/account',accountRoutes);
app.route('/v1/admin',adminRoutes);
app.route('/v1/internal',internalRoutes);
app.route('/v1/app',appPublicRoutes);
app.route('/v1/releases',releaseRoutes);

app.notFound((c)=>c.json({error:{code:'NOT_FOUND',message:'Endpoint not found.'}},404));
app.onError((error,c)=>{
  // Avoid logging bodies, tokens, emails, or private message content.
  console.error('request failed',{path:c.req.path,method:c.req.method,errorName:error instanceof Error?error.name:'UnknownError'});
  return c.json({error:{code:'INTERNAL_ERROR',message:'The request could not be completed.'}},500);
});

export default app;
