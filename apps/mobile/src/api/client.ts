import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '../config.generated';

const SESSION_SERVICE='com.haikumessenger.session';

export class ApiError extends Error {
  status:number;
  code:string;
  details:unknown;
  constructor(status:number,code:string,message:string,details?:unknown){super(message);this.status=status;this.code=code;this.details=details;}
}

export async function getSessionToken(){
  const credentials=await Keychain.getGenericPassword({service:SESSION_SERVICE});
  return credentials ? credentials.password : null;
}
export async function saveSessionToken(token:string){
  await Keychain.setGenericPassword('haiku-session',token,{service:SESSION_SERVICE,accessible:Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
}
export async function clearSessionToken(){await Keychain.resetGenericPassword({service:SESSION_SERVICE});}

export async function api<T=any>(path:string,options:RequestInit & {anonymous?:boolean}={}):Promise<T>{
  const {anonymous,...requestOptions}=options;
  const headers=new Headers(requestOptions.headers||{});
  if(requestOptions.body&&!headers.has('Content-Type')&&!(requestOptions.body instanceof FormData))headers.set('Content-Type','application/json');
  if(!anonymous){const token=await getSessionToken();if(token)headers.set('Authorization',`Bearer ${token}`);}
  let response:Response;
  try{response=await fetch(`${API_BASE_URL}${path.startsWith('/')?path:`/${path}`}`,{...requestOptions,headers});}
  catch(error){throw new ApiError(0,'NETWORK_UNAVAILABLE','Could not reach Haiku Messenger. Check your connection and API URL.',error);}
  const contentType=response.headers.get('content-type')||'';
  const payload=contentType.includes('application/json')?await response.json().catch(()=>null):null;
  if(!response.ok){const item=payload?.error;throw new ApiError(response.status,item?.code||'REQUEST_FAILED',item?.message||`Request failed (${response.status}).`,item?.details);}
  return payload as T;
}

export function apiUrl(){return API_BASE_URL;}
export function messageForError(error:unknown){
  if(error instanceof ApiError)return error.message;
  if(error instanceof Error)return error.message;
  return 'Something went wrong. Please try again.';
}
