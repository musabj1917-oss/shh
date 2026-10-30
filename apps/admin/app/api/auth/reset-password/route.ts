import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:{code:'CSRF_REJECTED',message:'This request could not be verified.'}},{status:403});}catch{return NextResponse.json({error:{code:'CSRF_REJECTED',message:'This request could not be verified.'}},{status:403});}
 const base=(process.env.HAIKU_API_URL||'http://localhost:3001/v1').replace(/\/+$/,'');
 if(!process.env.HAIKU_API_URL&&process.env.NODE_ENV==='production')return NextResponse.json({error:{code:'API_NOT_CONFIGURED',message:'Password recovery is not configured.'}},{status:503});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:{code:'INVALID_JSON',message:'The reset request is invalid.'}},{status:400});}
 try{
  const response=await fetch(`${base}/auth/reset-password`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  return new NextResponse(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return NextResponse.json({error:{code:'API_UNAVAILABLE',message:'The password recovery service could not be reached.'}},{status:503});}
}
