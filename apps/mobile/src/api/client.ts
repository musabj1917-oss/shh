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

export async function registerPushToken(token:string, platform:'android'|'ios'|'web'='android'){
  return api<{status:string}>('/account/push-tokens',{
    method:'POST',
    body:JSON.stringify({token,platform})
  });
}

export async function unregisterPushToken(token:string){
  return api<{status:string}>('/account/push-tokens',{
    method:'DELETE',
    body:JSON.stringify({token})
  });
}

export async function updateLiveLocation(params: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  sharingMode?: 'off' | 'friends' | 'live_chat';
  durationMinutes?: number;
  conversationId?: string;
}) {
  return api<{ location: unknown }>('/location/live', {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export async function getFriendsLocations() {
  return api<{ friends: Array<{
    user_id: string;
    latitude: number;
    longitude: number;
    display_name: string;
    username: string;
    avatar_object_key: string | null;
    updated_at: string;
  }> }>('/location/friends');
}

export async function stopLiveLocation() {
  return api<{ status: string }>('/location/live', {
    method: 'DELETE',
  });
}

export async function sendLocationPin(conversationId: string, params: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  title?: string;
}) {
  return api<{ message: unknown }>('/location/pin', {
    method: 'POST',
    body: JSON.stringify({ conversationId, ...params }),
  });
}

import { validateMediaSize } from '../constants/mediaLimits';

export interface UploadMediaOptions {
  uri?: string;
  targetUri?: string;
  purpose?: 'message' | 'story' | 'avatar' | 'group' | 'report';
  conversationId?: string;
  groupId?: string;
  mediaType?: 'image' | 'video' | 'voice';
  mimeType?: string;
  byteSize?: number;
  onProgress?: (progress: number) => void;
}

export async function uploadMedia(options: UploadMediaOptions): Promise<{ attachmentId: string; mediaId: string }> {
  const targetUri = options.targetUri || options.uri || '';
  const { purpose = 'message', conversationId, groupId, onProgress } = options;
  const isVideo =
    options.mediaType === 'video' ||
    options.mimeType?.startsWith('video/') ||
    targetUri.endsWith('.mp4') ||
    targetUri.endsWith('.mov') ||
    targetUri.endsWith('.webm');
  const isVoice =
    options.mediaType === 'voice' ||
    options.mimeType?.startsWith('audio/') ||
    targetUri.endsWith('.m4a') ||
    targetUri.endsWith('.aac') ||
    targetUri.endsWith('.wav');

  const mediaType: 'image' | 'video' | 'voice' = options.mediaType
    ? options.mediaType
    : isVoice
    ? 'voice'
    : isVideo
    ? 'video'
    : 'image';

  let mimeType =
    options.mimeType ||
    (mediaType === 'voice'
      ? 'audio/mp4'
      : mediaType === 'video'
      ? 'video/mp4'
      : 'image/jpeg');

  let byteSize = options.byteSize || 0;
  if (!byteSize && targetUri) {
    try {
      const resp = await fetch(targetUri);
      const blob = await resp.blob();
      byteSize = blob.size;
    } catch {
      byteSize = 1024 * 1024; // Safe fallback
    }
  }

  // Enforce upload limits per MEDIA_LIMITS
  const validation = validateMediaSize(
    purpose === 'avatar' ? 'avatar' : mediaType,
    byteSize
  );
  if (!validation.valid && validation.error) {
    throw new Error(validation.error);
  }

  onProgress?.(0.1);

  // Request upload intent from backend
  const intent = await api<{
    attachmentId: string;
    mediaId?: string;
    uploadUrl?: string;
    upload?: { url: string; method: string; headers: Record<string, string>; mode: 'proxy' | 'signed' };
  }>('/media/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      purpose,
      mediaType,
      mimeType,
      byteSize,
      conversationId,
      groupId,
    }),
  });

  const attachmentId = intent.attachmentId || intent.mediaId!;
  const uploadInfo = intent.upload || {
    url: intent.uploadUrl!,
    method: 'PUT',
    headers: {},
    mode: 'signed' as const,
  };

  onProgress?.(0.3);

  const blob = await (await fetch(targetUri)).blob();
  const result = await fetch(uploadInfo.url, {
    method: uploadInfo.method || 'PUT',
    headers: uploadInfo.headers,
    body: blob,
  });
  if (!result.ok) throw new Error(`Upload failed (${result.status}).`);

  onProgress?.(0.85);

  if (uploadInfo.mode === 'signed') {
    await api(`/media/${attachmentId}/complete`, { method: 'POST' });
  }

  onProgress?.(1.0);
  return { attachmentId, mediaId: attachmentId };
}

