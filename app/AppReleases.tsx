'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';

type Release={id:string;platform:string;version:string;file_name:string;byte_size:number;notes:string|null;status:string;is_active:boolean;download_count:number;created_at:string;activated_at:string|null};

async function call<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(`/api/admin/${path.replace(/^\/+/,'')}`,{...options,credentials:'same-origin',cache:'no-store',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
 const payload=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(payload?.error?.message||`Request failed (${response.status}).`);
 return payload as T;
}
const size=(bytes:number)=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;

function putFile(url:string,headers:Record<string,string>,file:File,onProgress:(percent:number)=>void){
 return new Promise<void>((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('PUT',url);
  Object.entries(headers||{}).forEach(([key,value])=>xhr.setRequestHeader(key,value));
  xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round((event.loaded/event.total)*100));};
  xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(`Storage rejected the upload (HTTP ${xhr.status}).`));
  xhr.onerror=()=>reject(new Error('The upload was blocked. The storage bucket must allow PUT requests from this admin site (CORS).'));
  xhr.send(file);
 });
}

export default function AppReleases({onNotice,onError}:{onNotice:(value:string)=>void;onError:(value:string)=>void}){
 const [releases,setReleases]=useState<Release[]>([]);
 const [storageReady,setStorageReady]=useState(true);
 const [maxBytes,setMaxBytes]=useState(300*1024*1024);
 const [version,setVersion]=useState('');
 const [notes,setNotes]=useState('');
 const [publish,setPublish]=useState(true);
 const [file,setFile]=useState<File|null>(null);
 const [stage,setStage]=useState<''|'preparing'|'uploading'|'verifying'>('');
 const [progress,setProgress]=useState(0);
 const [busyId,setBusyId]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);

 const load=useCallback(async()=>{
  try{
   const result=await call<{releases:Release[];storageReady:boolean;maxBytes:number}>('app-releases');
   setReleases(result.releases||[]);setStorageReady(result.storageReady!==false);if(result.maxBytes)setMaxBytes(result.maxBytes);
  }catch(e){onError(e instanceof Error?e.message:'Releases could not be loaded.');}
 },[onError]);
 useEffect(()=>{void load();},[load]);

 const upload=async(event:React.FormEvent)=>{
  event.preventDefault();onError('');onNotice('');
  if(!file){onError('Choose an .apk file first.');return;}
  if(!/\.apk$/i.test(file.name)){onError('The file must end in .apk.');return;}
  if(file.size>maxBytes){onError(`That file is larger than the ${size(maxBytes)} limit.`);return;}
  try{
   setStage('preparing');setProgress(0);
   const plan=await call<{release:{id:string};upload:{url:string;headers:Record<string,string>}}>('app-releases/upload-plan',{method:'POST',body:JSON.stringify({version:version.trim(),fileName:file.name,byteSize:file.size,notes:notes.trim()||undefined})});
   setStage('uploading');
   await putFile(plan.upload.url,plan.upload.headers,file,setProgress);
   setStage('verifying');
   await call(`app-releases/${plan.release.id}/complete`,{method:'POST',body:JSON.stringify({activate:publish})});
   onNotice(`Version ${version.trim()} uploaded${publish?' and published on the website.':'.'}`);
   setVersion('');setNotes('');setFile(null);if(fileInput.current)fileInput.current.value='';
   await load();
  }catch(e){onError(e instanceof Error?e.message:'The upload failed.');}
  finally{setStage('');setProgress(0);}
 };

 const act=async(release:Release,action:'activate'|'deactivate'|'delete')=>{
  if(action==='delete'&&!window.confirm(`Delete version ${release.version}? The file will be removed permanently.`))return;
  onError('');onNotice('');setBusyId(release.id);
  try{
   if(action==='delete')await call(`app-releases/${release.id}`,{method:'DELETE'});
   else await call(`app-releases/${release.id}/${action}`,{method:'POST',body:'{}'});
   onNotice(action==='delete'?'Release deleted.':action==='activate'?`Version ${release.version} is now the website download.`:'Download removed from the website.');
   await load();
  }catch(e){onError(e instanceof Error?e.message:'The action failed.');}
  finally{setBusyId('');}
 };

 const uploading=stage!=='';
 return <section className="fade-in">
  {!storageReady&&<div className="alert alert-error">Object storage is not configured on the API (MEDIA_STORAGE must be neon-s3), so APKs cannot be uploaded yet.</div>}
  <form className="panel" onSubmit={upload} style={{marginBottom:16}}>
   <div className="panel-title"><div><div className="eyebrow">NEW VERSION</div><h2>Upload an Android APK</h2><p>The newest published version becomes the Download button on the website. Maximum size {size(maxBytes)}.</p></div></div>
   <div className="grant-controls" style={{display:'grid',gap:12,marginTop:14}}>
    <label>Version<input value={version} onChange={event=>setVersion(event.target.value)} placeholder="1.0.0" maxLength={32} required disabled={uploading}/></label>
    <label>APK file<input ref={fileInput} type="file" accept=".apk,application/vnd.android.package-archive" onChange={event=>setFile(event.target.files?.[0]||null)} required disabled={uploading}/></label>
    <label>Release notes (optional)<input value={notes} onChange={event=>setNotes(event.target.value)} placeholder="What changed in this version" maxLength={1000} disabled={uploading}/></label>
    <label style={{flexDirection:'row',alignItems:'center',gap:8}}><input type="checkbox" checked={publish} onChange={event=>setPublish(event.target.checked)} disabled={uploading} style={{width:'auto'}}/>Publish on the website right after upload</label>
   </div>
   {uploading&&<div style={{marginTop:14}}><div style={{height:8,borderRadius:99,background:'#e8eeea',overflow:'hidden'}}><div style={{height:'100%',width:`${stage==='uploading'?progress:100}%`,background:'var(--mint)',transition:'width .2s'}}/></div><small className="subline">{stage==='preparing'?'Preparing upload…':stage==='uploading'?`Uploading… ${progress}%`:'Verifying the file…'}</small></div>}
   <div style={{marginTop:14}}><button type="submit" className="btn btn-primary" disabled={uploading||!storageReady||!file||!version.trim()}>{uploading?'Working…':'Upload APK'}</button></div>
  </form>
  {releases.length===0?<div className="empty-panel"><div className="empty-mark">⬇</div><h3>No APK uploaded yet.</h3><p>Upload your first build above to enable the download button on the website.</p></div>:<div className="table-wrap"><table><thead><tr><th>VERSION</th><th>SIZE</th><th>STATUS</th><th>DOWNLOADS</th><th>UPLOADED</th><th>ACTIONS</th></tr></thead><tbody>{releases.map(release=><tr key={release.id}>
   <td><b>v{release.version}</b><small className="subline">{release.file_name}{release.notes?` · ${release.notes}`:''}</small></td>
   <td>{size(Number(release.byte_size))}</td>
   <td><span className={`badge ${release.is_active?'badge-active':'badge-muted'}`}>{release.is_active?'live on website':release.status==='pending'?'incomplete':'not published'}</span></td>
   <td>{release.download_count}</td>
   <td className="nowrap">{new Date(release.created_at).toLocaleString()}</td>
   <td><div className="table-actions">
    {release.status==='ready'&&!release.is_active&&<button className="btn btn-secondary btn-small" disabled={busyId===release.id} onClick={()=>void act(release,'activate')}>Publish</button>}
    {release.is_active&&<button className="btn btn-secondary btn-small" disabled={busyId===release.id} onClick={()=>void act(release,'deactivate')}>Unpublish</button>}
    <button className="btn btn-danger-soft btn-small" disabled={busyId===release.id} onClick={()=>void act(release,'delete')}>Delete</button>
   </div></td></tr>)}</tbody></table></div>}
 </section>;
}
