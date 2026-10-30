import React,{useCallback,useState} from 'react';
import {Alert,Image,Linking,Pressable,Text,TextInput,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {api,messageForError} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import type {RootStackParamList} from '../navigation/types';
import {Button,LoadingState,Notice} from '../components/UI';
import {colors} from '../theme/colors';

type Props=NativeStackScreenProps<RootStackParamList,'StoryView'>;
type Story={id:string;user_id:string;media_type:'image'|'video';caption:string|null;expires_at:string;attachment_id:string;display_name:string;username:string};
type Viewer={id:string;username:string;display_name:string;viewed_at:string};
export function StoryViewScreen({route,navigation}:Props){
 const {storyId}=route.params;const {user}=useAuth();
 const [story,setStory]=useState<Story|null>(null),[url,setUrl]=useState(''),[viewers,setViewers]=useState<Viewer[]>([]),[text,setText]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const load=useCallback(async()=>{setError('');try{const result=await api<{story:Story}>(`/stories/${storyId}`);setStory(result.story);const media=await api<{url:string}>(`/media/${result.story.attachment_id}`);setUrl(media.url);if(result.story.user_id===user?.id){const v=await api<{viewers:Viewer[]}>(`/stories/${storyId}/viewers`);setViewers(v.viewers||[]);}}catch(e){setError(messageForError(e));}finally{setLoading(false);}},[storyId,user?.id]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 const reply=async()=>{if(!text.trim()||!story)return;setBusy(true);setError('');try{await api(`/stories/${storyId}/replies`,{method:'POST',body:JSON.stringify({text:text.trim()})});setText('');setSent(true);}catch(e){setError(messageForError(e));}finally{setBusy(false);}};
 const remove=()=>Alert.alert('Delete this story?', 'It will no longer be visible in Haiku Messenger.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{setBusy(true);try{await api(`/stories/${storyId}`,{method:'DELETE'});navigation.goBack();}catch(e){setError(messageForError(e));}finally{setBusy(false);}}}]);
 const authorActions=()=>Alert.alert(story?.display_name||'Story account','Choose an action.',[{text:'Report account',onPress:async()=>{try{await api('/reports',{method:'POST',body:JSON.stringify({targetUserId:story?.user_id,category:'other',reason:'Reported from a story.'})});Alert.alert('Report submitted','Thank you for helping keep Haiku Messenger safer.');}catch(e){setError(messageForError(e));}}},{text:'Block account',style:'destructive',onPress:()=>Alert.alert('Block this account?', 'You will no longer see each other’s content or messages.',[{text:'Cancel',style:'cancel'},{text:'Block',style:'destructive',onPress:async()=>{try{await api(`/friends/blocks/${story?.user_id}`,{method:'POST'});navigation.goBack();}catch(e){setError(messageForError(e));}}}])},{text:'Cancel',style:'cancel'}]);
 if(loading)return <LoadingState message="Opening story…"/>;
 if(!story)return <View style={{flex:1,justifyContent:'center',padding:20}}>{error?<Notice tone="error">{error}</Notice>:null}<Button title="Close" onPress={()=>navigation.goBack()}/></View>;
 const own=story.user_id===user?.id;
 return <View style={{flex:1,backgroundColor:'#10211D',padding:16,paddingTop:28}}>
  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><View><Text style={{fontSize:16,fontWeight:'800',color:'#fff'}}>{story.display_name}</Text><Text style={{fontSize:10,color:'#B9CDC4',marginTop:3}}>@{story.username} · expires {new Date(story.expires_at).toLocaleString()}</Text></View>{own?<Pressable onPress={remove} style={{padding:8}}><Text style={{fontSize:11,color:'#FFD3CE',fontWeight:'700'}}>Delete</Text></Pressable>:<Pressable onPress={authorActions} style={{padding:8}}><Text style={{fontSize:11,color:'#FFD3CE',fontWeight:'700'}}>···</Text></Pressable>}</View>
  {error?<Notice tone="error">{error}</Notice>:null}
  <View style={{flex:1,backgroundColor:'#203A32',borderRadius:21,overflow:'hidden',alignItems:'center',justifyContent:'center'}}>
   {story.media_type==='image'&&url?<Image source={{uri:url}} resizeMode="contain" style={{width:'100%',height:'100%'}}/>:story.media_type==='video'?<Button title="▶  Play video" onPress={()=>url?Linking.openURL(url):setError('Video is not available.')} kind="secondary"/>:<Text style={{fontSize:12,color:'#fff'}}>Loading media…</Text>}
   {story.caption?<View style={{position:'absolute',bottom:12,left:12,right:12,padding:12,borderRadius:12,backgroundColor:'rgba(14,28,24,.78)'}}><Text style={{color:'#fff',fontSize:13,lineHeight:19}}>{story.caption}</Text></View>:null}
  </View>
  {own?<View style={{marginTop:12}}><Text style={{fontSize:10,fontWeight:'800',color:'#DCEDE5',marginBottom:7}}>VIEWED BY {viewers.length}</Text><Text numberOfLines={1} style={{fontSize:10,color:'#B9CDC4'}}>{viewers.slice(0,6).map(item=>item.display_name).join(' · ')||'No views yet'}</Text></View>:<View style={{flexDirection:'row',gap:8,alignItems:'center',marginTop:12}}>{sent?<Text style={{flex:1,color:'#BFE9D5',fontSize:11}}>Reply sent.</Text>:<TextInput value={text} onChangeText={setText} placeholder="Reply to this story…" placeholderTextColor="#B9CDC4" style={{flex:1,minHeight:44,borderRadius:14,backgroundColor:'#27483E',paddingHorizontal:13,color:'#fff',fontSize:12}}/>}<Button title="Send" onPress={reply} loading={busy} disabled={!text.trim()} small/></View>}
 </View>;
}
