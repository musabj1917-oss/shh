import {NextRequest,NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const COOKIE='haiku_admin_session';
const MAX_AGE=60*60*12;
const apiBase=()=>((process.env.HAIKU_API_URL||'http://localhost:3001/v1').replace(/\/+$/,''));
type RouteContext={params:Promise<{path:string[]}>};

function safeJson(status:number,code:string,message:string){return NextResponse.json({error:{code,message}},{status,headers:{'Cache-Control':'no-store'}});}
function sameOrigin(request:NextRequest){
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
async function upstream(url:string,init:RequestInit){
 try{return await fetch(url,{...init,cache:'no-store',redirect:'manual'});}
 catch{return null;}
}
function copyResponse(response:Response){
 return new NextResponse(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

async function handler(request:NextRequest,context:RouteContext){
 const {path=[]}=await context.params;
 const route=path.map(part=>encodeURIComponent(part)).join('/');
 const method=request.method.toUpperCase();
 if(['POST','PUT','PATCH','DELETE'].includes(method)&&!sameOrigin(request))return safeJson(403,'CSRF_REJECTED','This request could not be verified. Reload the admin panel and try again.');
 const base=apiBase();
 if(!process.env.HAIKU_API_URL&&process.env.NODE_ENV==='production')return safeJson(503,'ADMIN_API_NOT_CONFIGURED','Set the server-only HAIKU_API_URL environment variable.');

 if(route==='session'){
  if(method!=='POST')return safeJson(405,'METHOD_NOT_ALLOWED','Use POST to start an admin session.');
  let body:{email?:string;password?:string};
  try{body=await request.json();}catch{return safeJson(400,'INVALID_JSON','Enter a valid email and password.');}
  const login=await upstream(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email:body.email,password:body.password})});
  if(!login)return safeJson(503,'API_UNAVAILABLE','The Haiku API could not be reached.');
  if(!login.ok)return copyResponse(login);
  const loginPayload=await login.json().catch(()=>null) as {accessToken?:string}|null;
  if(!loginPayload?.accessToken)return safeJson(502,'AUTH_RESPONSE_INVALID','The API did not return a valid session.');
  const token=loginPayload.accessToken;
  const admin=await upstream(`${base}/admin/me`,{method:'GET',headers:{Authorization:`Bearer ${token}`,'Accept':'application/json'}});
  if(!admin){await upstream(`${base}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});return safeJson(503,'API_UNAVAILABLE','The Haiku admin service could not be reached.');}
  if(!admin.ok){await upstream(`${base}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});return safeJson(admin.status===403?403:admin.status,'ADMIN_ACCESS_REQUIRED','This account does not have active Haiku administrator access.');}
  const payload=await admin.json().catch(()=>null);
  const response=NextResponse.json(payload,{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:MAX_AGE});
  return response;
 }

 const token=request.cookies.get(COOKIE)?.value;
 if(route==='logout'){
  if(method!=='POST')return safeJson(405,'METHOD_NOT_ALLOWED','Use POST to end the admin session.');
  if(token)await upstream(`${base}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Accept':'application/json'}});
  const response=NextResponse.json({status:'signed_out'},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
  return response;
 }
 if(!token)return safeJson(401,'ADMIN_SESSION_REQUIRED','Sign in to continue.');
 if(!route)return safeJson(404,'NOT_FOUND','Admin endpoint not found.');
 const headers=new Headers({'Authorization':`Bearer ${token}`,'Accept':'application/json'});
 const contentType=request.headers.get('content-type');if(contentType)headers.set('Content-Type',contentType);
 let body:string|undefined;
 if(!['GET','HEAD'].includes(method))body=await request.text();
 const response=await upstream(`${base}/admin/${route}`,{method,headers,body});
 if(!response)return safeJson(503,'API_UNAVAILABLE','The Haiku API could not be reached.');
 const result=copyResponse(response);
 if(response.status===401){result.cookies.set(COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});}
 return result;
}
export const GET=handler;
export const POST=handler;
export const PUT=handler;
export const PATCH=handler;
export const DELETE=handler;
