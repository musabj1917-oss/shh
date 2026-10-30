import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {api,clearSessionToken,getSessionToken,saveSessionToken} from '../api/client';

export type HaikuUser={id:string;email:string;username:string;displayName:string;emailVerified?:boolean};
type AuthState={user:HaikuUser|null;loading:boolean;signIn:(email:string,password:string)=>Promise<void>;register:(input:{email:string;password:string;username:string;displayName:string;dateOfBirth:string})=>Promise<{message:string;verification?:unknown}>;signOut:()=>Promise<void>;refresh:()=>Promise<void>};
const AuthContext=createContext<AuthState|null>(null);

export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<HaikuUser|null>(null);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    const token=await getSessionToken();
    if(!token){setUser(null);return;}
    try{const result=await api<{user:HaikuUser}>('/auth/me');setUser(result.user);}
    catch{await clearSessionToken();setUser(null);}
  },[]);
  useEffect(()=>{refresh().finally(()=>setLoading(false));},[refresh]);
  const signIn=useCallback(async(email:string,password:string)=>{
    const result=await api<{accessToken:string;user:HaikuUser}>('/auth/login',{method:'POST',body:JSON.stringify({email,password}),anonymous:true});
    await saveSessionToken(result.accessToken);setUser(result.user);
  },[]);
  const register=useCallback(async(input:{email:string;password:string;username:string;displayName:string;dateOfBirth:string})=>{
    const result=await api<{message:string;verification?:unknown}>('/auth/register',{method:'POST',body:JSON.stringify(input),anonymous:true});
    return result;
  },[]);
  const signOut=useCallback(async()=>{try{await api('/auth/logout',{method:'POST'});}catch{}await clearSessionToken();setUser(null);},[]);
  const value=useMemo(()=>({user,loading,signIn,register,signOut,refresh}),[user,loading,signIn,register,signOut,refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider');return value;}
