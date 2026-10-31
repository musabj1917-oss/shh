import React,{useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {api,ApiError,messageForError} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {rememberInvite} from '../invites';
import {Button,Notice,Screen,Surface} from '../components/UI';
import {colors} from '../theme/colors';

type Props=NativeStackScreenProps<RootStackParamList,'JoinGroup'>;
type JoinResult='joined'|'approval_required'|'already_member';

export function JoinGroupScreen({route,navigation}:Props){
 const {token}=route.params;
 const {user}=useAuth();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<JoinResult|null>(null);

 useEffect(()=>{if(!user)rememberInvite(token);},[token,user]);

 const join=async()=>{
  if(!user)return;
  setBusy(true);setError('');
  try{
   const response=await api<{status:'joined'|'approval_required'}>(`/groups/join/${encodeURIComponent(token)}`,{method:'POST'});
   setResult(response.status);
  }catch(e){
   if(e instanceof ApiError&&e.code==='ALREADY_MEMBER'){setResult('already_member');return;}
   setError(messageForError(e));
  }finally{setBusy(false);}
 };

 return <Screen scroll>
  <View style={{paddingTop:22}}>
   <Text style={{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:colors.mint}}>GROUP INVITATION</Text>
   <Text style={{fontSize:29,fontWeight:'800',letterSpacing:-.9,color:colors.ink,marginTop:5}}>A place to join.</Text>
   <Text style={{fontSize:12,lineHeight:19,color:colors.muted,marginTop:7,marginBottom:20}}>This link was shared by a Haiku Messenger group administrator. Invitations can expire, be revoked, or reach their usage limit.</Text>
   {error?<Notice tone="error">{error}</Notice>:null}
   <Surface style={{padding:19,borderRadius:21}}>
    {!user?<>
      <Text style={{fontSize:14,fontWeight:'800',color:colors.ink}}>Sign in to continue</Text>
      <Text style={{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5,marginBottom:14}}>Group invitations are tied to your Haiku account. After signing in, this invitation will be waiting for you.</Text>
      <Button title="Sign in" onPress={()=>navigation.navigate('Auth')}/>
    </>:result==='joined'?<>
      <Text style={{fontSize:17,fontWeight:'800',color:colors.ink}}>You’re in.</Text>
      <Text style={{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5,marginBottom:14}}>The group now appears in your groups. Say hello when you’re ready.</Text>
      <Button title="Open my groups" onPress={()=>navigation.navigate('Groups')}/>
    </>:result==='approval_required'?<>
      <Text style={{fontSize:17,fontWeight:'800',color:colors.ink}}>Request sent.</Text>
      <Text style={{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5,marginBottom:14}}>A group administrator will review your request. You’ll be notified when there is a decision.</Text>
      <Button title="Back to chats" kind="secondary" onPress={()=>navigation.navigate('Main')}/>
    </>:result==='already_member'?<>
      <Text style={{fontSize:17,fontWeight:'800',color:colors.ink}}>Already a member.</Text>
      <Text style={{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5,marginBottom:14}}>You already belong to this group. You can open it from your groups list.</Text>
      <Button title="Open my groups" onPress={()=>navigation.navigate('Groups')}/>
    </>:<>
      <Text style={{fontSize:14,fontWeight:'800',color:colors.ink}}>Join this group?</Text>
      <Text style={{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5,marginBottom:8}}>You’ll share a group conversation with its members. Blocking rules and group moderation still apply.</Text>
      <Text numberOfLines={1} style={{fontSize:9,color:colors.muted,marginBottom:14}}>Invitation ···{token.slice(-6)}</Text>
      <Button title="Join group" onPress={join} loading={busy}/>
    </>}
   </Surface>
  </View>
 </Screen>;
}
