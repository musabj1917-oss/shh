import React,{useCallback,useState} from 'react';
import {FlatList,Pressable,Text,View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {api,messageForError} from '../api/client';
import {Avatar,Button,EmptyState,LoadingState,Notice,Surface} from '../components/UI';
import {colors} from '../theme/colors';

type Props=NativeStackScreenProps<RootStackParamList,'Notifications'>;
type Notification={id:string;type:string;actor_id:string|null;entity_id:string|null;payload:Record<string,unknown>|null;created_at:string;read_at:string|null;username:string|null;display_name:string|null};
type Conversation={id:string;kind:'direct'|'group';title:string};
type Group={id:string;conversation_id:string;name:string};
const descriptions:Record<string,string>={friend_request:'sent you a friend request',friend_accepted:'accepted your friend request',message:'sent you a message',group_membership:'added you to a group',story_reply:'replied to your story',group_invite:'requested to join a group you manage'};
export function NotificationsScreen({navigation}:Props){
 const [items,setItems]=useState<Notification[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{setError('');try{const result=await api<{notifications:Notification[]}>('/conversations/notifications');setItems(result.notifications||[]);}catch(e){setError(messageForError(e));}finally{setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 const open=async(item:Notification)=>{setBusy(item.id);setError('');try{if(!item.read_at)await api(`/conversations/notifications/${item.id}/read`,{method:'POST'});if(item.type==='story_reply'&&typeof item.payload?.storyId==='string'){const story=await api<{story:{media_type:'image'|'video'}}>(`/stories/${item.payload.storyId}`);navigation.navigate('StoryView',{storyId:item.payload.storyId,title:item.display_name||'Story',mediaType:story.story.media_type});return;}if(item.type==='group_invite'&&item.entity_id){const result=await api<{group:{name:string};role:string}>(`/groups/${item.entity_id}`);navigation.navigate('GroupDetail',{groupId:item.entity_id,name:result.group.name,role:result.role});return;}if(item.type==='group_membership'&&item.entity_id){const result=await api<{groups:Group[]}>('/groups');const group=result.groups.find(g=>g.id===item.entity_id);if(group){navigation.navigate('Chat',{conversationId:group.conversation_id,title:group.name,kind:'group'});return;}}if(item.type==='message'&&typeof item.payload?.conversationId==='string'){const result=await api<{conversations:Conversation[]}>('/conversations');const convo=result.conversations.find(c=>c.id===item.payload?.conversationId);if(convo){navigation.navigate('Chat',{conversationId:convo.id,title:convo.title,kind:convo.kind});return;}}navigation.navigate('Main',{screen:'People'});}catch(e){setError(messageForError(e));}finally{setBusy('');}};
 return <View style={{flex:1,backgroundColor:colors.canvas,padding:18,paddingTop:20}}>
  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><View><Text style={{fontSize:10,fontWeight:'800',letterSpacing:1.3,color:colors.mint}}>UPDATES</Text><Text style={{fontSize:26,fontWeight:'800',letterSpacing:-.7,color:colors.ink,marginTop:3}}>Notifications</Text></View><Button title="Refresh" kind="secondary" onPress={()=>void load()} small/></View>
  <Notice tone="info">In-app updates only. Push notifications are not connected yet.</Notice>
  {error?<Notice tone="error">{error}</Notice>:null}
  {loading?<LoadingState message="Loading updates…"/>:<FlatList data={items} keyExtractor={item=>item.id} contentContainerStyle={{flexGrow:1,paddingBottom:24}} ListEmptyComponent={<EmptyState title="Nothing new." detail="Friend, group, message, and story updates will appear here."/>} renderItem={({item})=><Pressable onPress={()=>void open(item)} disabled={Boolean(busy)} style={{marginBottom:8}}><Surface style={{padding:12,borderRadius:15,flexDirection:'row',alignItems:'center',gap:10,opacity:busy===item.id?0.6:1}}><Avatar name={item.display_name||'Haiku'} color={item.type==='group_membership'?colors.blue:colors.mint}/><View style={{flex:1}}><Text style={{fontSize:11,lineHeight:16,color:colors.ink}}><Text style={{fontWeight:'800'}}>{item.display_name||'A Haiku member'}</Text> {descriptions[item.type]||'sent you an update'}</Text><Text style={{fontSize:9,color:colors.muted,marginTop:4}}>{new Date(item.created_at).toLocaleString()}</Text></View>{item.read_at?null:<View style={{width:8,height:8,borderRadius:4,backgroundColor:colors.mint}}/>}</Surface></Pressable>}/>} 
 </View>;
}
