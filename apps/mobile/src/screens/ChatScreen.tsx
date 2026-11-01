import React,{useCallback,useEffect,useRef,useState} from 'react';
import * as Ably from 'ably';
import {Alert,FlatList,Image,KeyboardAvoidingView,Linking,Platform,Pressable,Text,TextInput,View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {api,apiUrl,getSessionToken,messageForError} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {Avatar,EmptyState,Notice} from '../components/UI';
import {colors} from '../theme/colors';

type Props=NativeStackScreenProps<RootStackParamList,'Chat'>;
type Message={id:string;sender_id:string|null;message_type:'text'|'image'|'video'|'voice';body:string|null;attachment_id:string|null;reply_to_id:string|null;created_at:string;edited_at:string|null;receipt_status?:'sent'|'delivered'|'read'|null;sender?:{username:string;displayName:string}|null};
type ChannelSet={realtime:Ably.Realtime;events:Ably.RealtimeChannel;ephemeral:Ably.RealtimeChannel};
const timeLabel=(value:string)=>new Date(value).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const expiryOptions:{value:1|24|168|null;label:string}[]=[{value:null,label:'Off'},{value:1,label:'1h'},{value:24,label:'24h'},{value:168,label:'7d'}];

export function ChatScreen({route,navigation}:Props){
 const {conversationId,title,kind}=route.params;
 const {user}=useAuth();
 const [messages,setMessages]=useState<Message[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[hasMore,setHasMore]=useState(false),[loadingOlder,setLoadingOlder]=useState(false),[error,setError]=useState(''),[text,setText]=useState(''),[sending,setSending]=useState(false),[uploading,setUploading]=useState(false),[realtimeStatus,setRealtimeStatus]=useState('Connecting…'),[typing,setTyping]=useState(false),[typingEnabled,setTypingEnabled]=useState(false),[,setPresenceEnabled]=useState(false),[editingId,setEditingId]=useState(''),[replyingTo,setReplyingTo]=useState<Message|null>(null),[mediaUrls,setMediaUrls]=useState<Record<string,string>>({}),[expiresInHours,setExpiresInHours]=useState<1|24|168|null>(null);
 const ephemeralRef=useRef<Ably.RealtimeChannel|null>(null),typingTimer=useRef<ReturnType<typeof setTimeout>|null>(null),remoteTypingTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const load=useCallback(async()=>{setError('');try{const result=await api<{messages:Message[];hasMore:boolean}>(`/conversations/${conversationId}/messages?limit=50`);setMessages(result.messages||[]);setHasMore(result.hasMore);await api(`/conversations/${conversationId}/read`,{method:'POST'});}catch(e){setError(messageForError(e));}finally{setLoading(false);setRefreshing(false);}},[conversationId]);
 const loadOlder=useCallback(async()=>{if(!hasMore||loadingOlder||!messages.length)return;setLoadingOlder(true);try{const before=encodeURIComponent(messages[0].created_at);const result=await api<{messages:Message[];hasMore:boolean}>(`/conversations/${conversationId}/messages?limit=50&before=${before}`);setMessages(current=>[...(result.messages||[]),...current]);setHasMore(result.hasMore);}catch(e){setError(messageForError(e));}finally{setLoadingOlder(false);}},[conversationId,hasMore,loadingOlder,messages]);
 useFocusEffect(useCallback(()=>{
   let mounted=true,channelSet:ChannelSet|undefined;
   void load();
   const connect=async()=>{
    const token=await getSessionToken();
    if(!token){setRealtimeStatus('Sign in to connect');return;}
    let preferences={presenceVisible:false,typingIndicatorsEnabled:false};
    try{const result=await api<{settings:{presence_visible:boolean;typing_indicators_enabled:boolean}}>('/profile/settings');preferences={presenceVisible:result.settings.presence_visible!==false,typingIndicatorsEnabled:result.settings.typing_indicators_enabled!==false};}catch{}
    if(!mounted)return;
    setPresenceEnabled(preferences.presenceVisible);setTypingEnabled(preferences.typingIndicatorsEnabled);
    const realtime=new Ably.Realtime({authUrl:`${apiUrl()}/conversations/realtime/token-request`,authMethod:'POST',authHeaders:{Authorization:`Bearer ${token}`},autoConnect:true});
    const events=realtime.channels.get(`haiku:conversation:${conversationId}:events`);
    const ephemeral=realtime.channels.get(`haiku:conversation:${conversationId}:ephemeral`);
    channelSet={realtime,events,ephemeral};
    realtime.connection.on((change)=>{if(!mounted)return;setRealtimeStatus(change.current==='connected'?'Live':change.current==='failed'?'Offline · retrying':change.current);});
    events.subscribe('message.created',()=>{if(mounted)void load();});
    ephemeral.subscribe('typing',(message)=>{
      if(message.clientId===user?.id)return;
      if(mounted){setTyping(Boolean((message.data as {active?:boolean}|undefined)?.active));if(remoteTypingTimer.current)clearTimeout(remoteTypingTimer.current);remoteTypingTimer.current=setTimeout(()=>setTyping(false),1600);}
    });
    ephemeral.presence.subscribe();
    if(preferences.presenceVisible){try{await ephemeral.presence.enter({displayName:user?.displayName||'Haiku member'});}catch{setRealtimeStatus('Realtime unavailable');}}
    ephemeralRef.current=ephemeral;
   };
   void connect().catch(()=>setRealtimeStatus('Realtime not configured'));
   return()=>{mounted=false;ephemeralRef.current=null;if(typingTimer.current)clearTimeout(typingTimer.current);if(remoteTypingTimer.current)clearTimeout(remoteTypingTimer.current);if(channelSet){channelSet.ephemeral.presence.leave().catch(()=>undefined);channelSet.events.unsubscribe();channelSet.ephemeral.unsubscribe();channelSet.realtime.close();}};
 },[conversationId,load,user?.id,user?.displayName]));

 useEffect(()=>{
  let active=true;
  const missing=messages.filter(item=>item.attachment_id&&!mediaUrls[item.attachment_id]&&item.message_type!=='voice');
  if(missing.length){Promise.all(missing.map(async item=>{try{const result=await api<{url:string}>(`/media/${item.attachment_id}`);return [item.attachment_id!,result.url] as const;}catch{return null;}})).then(results=>{if(!active)return;setMediaUrls(prev=>{const next={...prev};for(const pair of results)if(pair)next[pair[0]]=pair[1];return next;});});}
  return()=>{active=false;};
 },[messages,mediaUrls]);

 const publishTyping=(active:boolean)=>{if(!typingEnabled)return;const channel=ephemeralRef.current;if(channel)channel.publish('typing',{active}).catch(()=>undefined);};
 const onChangeText=(value:string)=>{setText(value);publishTyping(true);if(typingTimer.current)clearTimeout(typingTimer.current);typingTimer.current=setTimeout(()=>publishTyping(false),1000);};
 const send=async()=>{
  const value=text.trim();if(!value||sending)return;setSending(true);setError('');
  try{
   if(editingId){await api(`/conversations/${conversationId}/messages/${editingId}`,{method:'PATCH',body:JSON.stringify({text:value})});setEditingId('');}
   else await api(`/conversations/${conversationId}/messages`,{method:'POST',body:JSON.stringify({text:value,replyToId:replyingTo?.id,expiresInHours})});
   setText('');setReplyingTo(null);publishTyping(false);await load();
  }catch(e){setError(messageForError(e));}finally{setSending(false);}
 };
 const uploadMedia=async()=>{
  setError('');
  const picked=await launchImageLibrary({mediaType:'mixed',selectionLimit:1,quality:0.8});
  if(picked.didCancel)return;
  if(picked.errorCode){setError(picked.errorMessage||'Could not open your photo library.');return;}
  const asset=picked.assets?.[0];if(!asset?.uri){setError('The selected file could not be opened.');return;}
  const mimeType=(asset.type||'image/jpeg').toLowerCase();const mediaType=mimeType.startsWith('video/')?'video':'image';const byteSize=asset.fileSize||0;
  if(!byteSize){setError('Could not determine this file’s size. Choose another file.');return;}
  setUploading(true);
  try{
   const intent=await api<{attachmentId:string;upload:{mode:'proxy'|'signed';url:string;method:'PUT';headers:Record<string,string>}}>(`/media/upload-intents`,{method:'POST',body:JSON.stringify({purpose:'message',mediaType,mimeType,byteSize,conversationId})});
   const local=await fetch(asset.uri);const blob=await local.blob();
   const uploaded=await fetch(intent.upload.url,{method:intent.upload.method,headers:intent.upload.headers,body:blob});
   if(!uploaded.ok)throw new Error(`Upload failed (${uploaded.status}).`);
   if(intent.upload.mode==='signed')await api(`/media/${intent.attachmentId}/complete`,{method:'POST'});
   await api(`/conversations/${conversationId}/messages`,{method:'POST',body:JSON.stringify({attachmentId:intent.attachmentId})});
   await load();
  }catch(e){setError(messageForError(e));}finally{setUploading(false);}
 };
 const messageActions=(item:Message)=>{
  const own=item.sender_id===user?.id;
  const options:any[]=[{text:'Reply',onPress:()=>{setReplyingTo(item);setEditingId('');}}];
  if(own&&item.message_type==='text'&&Date.now()-new Date(item.created_at).getTime()<15*60*1000)options.push({text:'Edit',onPress:()=>{setEditingId(item.id);setReplyingTo(null);setText(item.body||'');}});
  if(!own)options.push({text:'Report message',onPress:()=>Alert.alert('Report this message?','The message and its context will be reviewed by a moderator. Expired content cannot be recovered.',[{text:'Cancel',style:'cancel'},{text:'Report',style:'destructive',onPress:async()=>{try{await api('/reports',{method:'POST',body:JSON.stringify({messageId:item.id,category:'other'})});Alert.alert('Report submitted','Thank you for helping keep Haiku Messenger safer.');}catch(e){setError(messageForError(e));}}}])});
  options.push({text:'Delete for me',onPress:async()=>{try{await api(`/conversations/${conversationId}/messages/${item.id}?mode=me`,{method:'DELETE'});await load();}catch(e){setError(messageForError(e));}}});
  if(own)options.push({text:'Delete for everyone',style:'destructive',onPress:async()=>{try{await api(`/conversations/${conversationId}/messages/${item.id}?mode=everyone`,{method:'DELETE'});await load();}catch(e){setError(messageForError(e));}}});
  options.push({text:'Cancel',style:'cancel'});
  Alert.alert('Message options',own?'Manage this message.':'Reply or remove this message from your view.',options);
 };
 const renderMessage=({item}: {item:Message})=>{
  const mine=item.sender_id===user?.id;
  const isMedia=Boolean(item.attachment_id)&&item.message_type!=='text';
  return <View style={{width:'100%',alignItems:mine?'flex-end':'flex-start',paddingHorizontal:14,marginBottom:9}}>
   {kind==='group'&&!mine&&item.sender?.displayName?<Text style={{fontSize:9,color:colors.body,marginLeft:8,marginBottom:3}}>{item.sender.displayName}</Text>:null}
   <Pressable
     onLongPress={()=>messageActions(item)}
     style={{
       maxWidth:'84%',
       paddingHorizontal:13,
       paddingVertical:10,
       borderRadius:18,
       borderBottomRightRadius:mine?4:18,
       borderBottomLeftRadius:mine?18:4,
       backgroundColor:mine?colors.mint:colors.card,
       borderWidth:mine?0:1,
       borderColor:colors.line,
       elevation:2,
       shadowColor:mine?colors.mint:'#000',
       shadowOpacity:mine?0.25:0.4,
       shadowRadius:mine?8:4
     }}
   >
    {item.reply_to_id?<Text style={{fontSize:10,fontWeight:'700',color:mine?colors.mintContrast:colors.mintAccent,marginBottom:4}}>↪ Quoted reply</Text>:null}
    {isMedia&&item.message_type==='image'?mediaUrls[item.attachment_id!]?<Image source={{uri:mediaUrls[item.attachment_id!]}} style={{width:220,height:190,borderRadius:12,backgroundColor:colors.mintPale}} resizeMode="cover"/>:<View style={{width:210,height:110,alignItems:'center',justifyContent:'center',backgroundColor:mine?colors.mintDark:colors.mintPale,borderRadius:10}}><Text style={{color:mine?colors.mintContrast:colors.mint,fontSize:12}}>Loading photo…</Text></View>:null}
    {isMedia&&item.message_type==='video'?<Pressable onPress={async()=>{try{const result=await api<{url:string}>(`/media/${item.attachment_id}`);await Linking.openURL(result.url);}catch(e){setError(messageForError(e));}}} style={{padding:13,backgroundColor:mine?colors.mintDark:colors.mintPale,borderRadius:10}}><Text style={{color:mine?colors.mintContrast:colors.mintDark,fontWeight:'700'}}>▶  Open video</Text></Pressable>:null}
    {item.body?<Text style={{fontSize:14,lineHeight:20,fontWeight:mine?'600':'400',color:mine?colors.mintContrast:colors.ink}}>{item.body}</Text>:null}
    <Text style={{textAlign:'right',fontSize:9,fontWeight:'600',color:mine?'rgba(7,18,10,0.65)':colors.muted,marginTop:5}}>
      {timeLabel(item.created_at)}{item.edited_at?' · edited':''}{mine&&item.receipt_status?` · ${item.receipt_status==='read'?'✓✓ Seen':item.receipt_status==='delivered'?'✓✓':'✓'}`:''}
    </Text>
   </Pressable>
  </View>;
 };
 return <View style={{flex:1,backgroundColor:colors.canvas}}>
  <View style={{height:62,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:colors.line,backgroundColor:'rgba(10, 16, 13, 0.96)'}}>
    <Pressable onPress={()=>navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" style={{width:38,height:38,borderRadius:12,backgroundColor:colors.mintPale,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'}}>
      <Text style={{fontSize:20,color:colors.mint,marginTop:-2}}>‹</Text>
    </Pressable>
    <View style={{position:'relative'}}>
      <Avatar name={title} color={kind==='group'?colors.blue:colors.mint}/>
      <View style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:5,backgroundColor:realtimeStatus==='Live'?colors.online:colors.offline,borderWidth:1.5,borderColor:colors.canvas}}/>
    </View>
    <View style={{flex:1}}>
      <Text numberOfLines={1} style={{fontWeight:'800',fontSize:15,color:colors.ink}}>{title}</Text>
      <Text style={{fontSize:10,color:realtimeStatus==='Live'?colors.mint:colors.muted,marginTop:2}}>
        {realtimeStatus==='Live'?'● Active now':kind==='group'?'Group conversation':realtimeStatus}
      </Text>
    </View>
    <Pressable onPress={()=>void load()} accessibilityRole="button" accessibilityLabel="Refresh messages" style={{width:38,height:38,borderRadius:12,backgroundColor:colors.mintPale,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'}}>
      <Text style={{fontSize:16,color:colors.mint}}>↻</Text>
    </Pressable>
  </View>
  {error?<View style={{paddingHorizontal:12,paddingTop:8}}><Notice tone="error">{error}</Notice></View>:null}
  {typing?<Text style={{fontSize:10,color:colors.muted,paddingHorizontal:18,paddingTop:7}}>{title} is typing…</Text>:null}
  <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={Platform.OS==='ios'?6:0}>
   {loading?<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.muted}}>Loading conversation…</Text></View>:messages.length===0?<EmptyState title="A fresh beginning." detail="Send a message to start this conversation."/>:<FlatList inverted data={[...messages].reverse()} keyExtractor={item=>item.id} renderItem={renderMessage} contentContainerStyle={{paddingTop:16,paddingBottom:12}} keyboardShouldPersistTaps="handled" onRefresh={()=>{setRefreshing(true);load();}} refreshing={refreshing} onEndReached={()=>{void loadOlder();}} onEndReachedThreshold={0.35} ListFooterComponent={loadingOlder?<Text style={{textAlign:'center',fontSize:10,color:colors.muted,padding:12}}>Loading older messages…</Text>:undefined}/>}
   {editingId?<View style={{paddingHorizontal:13,paddingTop:7,flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontSize:10,color:colors.mint,fontWeight:'700'}}>Editing message</Text><Pressable onPress={()=>{setEditingId('');setText('');}}><Text style={{fontSize:10,color:colors.red}}>Cancel</Text></Pressable></View>:replyingTo?<View style={{paddingHorizontal:13,paddingTop:7,flexDirection:'row',justifyContent:'space-between'}}><Text numberOfLines={1} style={{fontSize:10,color:colors.mint,fontWeight:'700',flex:1}}>Replying to {replyingTo.sender_id===user?.id?'yourself':replyingTo.sender?.displayName||title}</Text><Pressable onPress={()=>setReplyingTo(null)}><Text style={{fontSize:10,color:colors.red}}>Cancel</Text></Pressable></View>:null}
   <View style={{paddingHorizontal:10,paddingTop:8,paddingBottom:Platform.OS==='ios'?14:10,backgroundColor:colors.canvas}}>
    {!editingId?<View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:5,paddingBottom:7}}><Text style={{fontSize:8,fontWeight:'800',letterSpacing:.7,color:colors.muted}}>DISAPPEARS</Text>{expiryOptions.map(option=><Pressable key={option.label} onPress={()=>setExpiresInHours(option.value)} accessibilityRole="button" accessibilityState={{selected:expiresInHours===option.value}} accessibilityLabel={option.value===null?'Messages do not expire':`Messages expire after ${option.label}`} style={{paddingVertical:4,paddingHorizontal:8,borderRadius:9,borderWidth:1,borderColor:expiresInHours===option.value?colors.mint:colors.line,backgroundColor:expiresInHours===option.value?colors.mint:colors.card}}><Text style={{fontSize:9,fontWeight:'700',color:expiresInHours===option.value?colors.mintContrast:colors.muted}}>{option.label}</Text></Pressable>)}<Text numberOfLines={2} style={{fontSize:9,color:colors.muted,marginLeft:2,flexShrink:1}}>{expiresInHours===null?'Text & photos stay; video & voice clear after 10m':`Clears after ${expiresInHours===168?'7d':`${expiresInHours}h`}`}</Text></View>:null}
    <View style={{minHeight:52,flexDirection:'row',alignItems:'flex-end',gap:8,paddingHorizontal:10,paddingVertical:7,borderWidth:1,borderColor:colors.line,borderRadius:20,backgroundColor:'rgba(14, 22, 17, 0.95)'}}>
     <Pressable onPress={uploading?undefined:uploadMedia} accessibilityRole="button" accessibilityLabel="Attach photo or video" style={{width:36,height:36,borderRadius:12,backgroundColor:colors.mintPale,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:20,color:colors.mint}}>{uploading?'…':'＋'}</Text></Pressable>
     <TextInput value={text} onChangeText={onChangeText} placeholder={editingId?'Edit your message…':'Write a thoughtful message…'} placeholderTextColor={colors.muted} multiline style={{flex:1,maxHeight:110,minHeight:36,paddingVertical:8,color:colors.ink,fontSize:14}} editable={!uploading}/>
     <Pressable onPress={send} disabled={!text.trim()||sending||uploading} accessibilityRole="button" accessibilityLabel={editingId?'Save edit':'Send message'} style={{width:38,height:38,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:text.trim()?colors.mint:'rgba(163,230,53,0.12)'}}><Text style={{fontSize:16,fontWeight:'800',color:text.trim()?colors.mintContrast:colors.muted}}>↑</Text></Pressable>
    </View>
    {uploading?<Text style={{fontSize:10,color:colors.muted,marginLeft:9,marginTop:5}}>Uploading securely…</Text>:null}
   </View>
  </KeyboardAvoidingView>
 </View>;
}
