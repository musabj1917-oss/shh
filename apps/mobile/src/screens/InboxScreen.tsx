import React,{useCallback,useMemo,useState} from 'react';
import {FlatList,Pressable,RefreshControl,Text,View} from 'react-native';
import {useFocusEffect,useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import NetInfo from '@react-native-community/netinfo';
import {api,messageForError} from '../api/client';
import type {MainTabParamList,RootStackParamList} from '../navigation/types';
import {Avatar,Button,EmptyState,Field,LoadingState,Notice,PageHeading,Screen} from '../components/UI';
import {colors} from '../theme/colors';

type Conversation={id:string;kind:'direct'|'group';title:string;last_message_text:string|null;last_message_type:string|null;last_message_at:string|null;unread_count:number;member_count:number;avatar_object_key?:string|null};
export function InboxScreen(){
 const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
 const tabs=useNavigation<BottomTabNavigationProp<MainTabParamList>>();
 const [conversations,setConversations]=useState<Conversation[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[unreadOnly,setUnreadOnly]=useState(false),[online,setOnline]=useState(true);
 const load=useCallback(async()=>{setError('');try{const result=await api<{conversations:Conversation[]}>('/conversations');setConversations(result.conversations||[]);}catch(e){setError(messageForError(e));}finally{setLoading(false);setRefreshing(false);}},[]);
 useFocusEffect(useCallback(()=>{load();const unsubscribe=NetInfo.addEventListener(state=>setOnline(Boolean(state.isConnected)));return()=>unsubscribe();},[load]));
 const filtered=useMemo(()=>conversations.filter(item=>(!unreadOnly||item.unread_count>0)&&(!query.trim()||item.title?.toLowerCase().includes(query.trim().toLowerCase())||item.last_message_text?.toLowerCase().includes(query.trim().toLowerCase()))),[conversations,query,unreadOnly]);
 const open=(item:Conversation)=>navigation.navigate('Chat',{conversationId:item.id,title:item.title||'Conversation',kind:item.kind});
 return <Screen style={{paddingHorizontal:18,paddingTop:18}}>
  <View style={{paddingHorizontal:2}}><PageHeading eyebrow="YOUR LITTLE CORNER" title="Good things, shared." subtitle="Pick up where you left off." right={<View style={{flexDirection:'row',gap:7}}><Pressable onPress={()=>navigation.navigate('Notifications')} style={{width:40,height:42,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'}} accessibilityRole="button" accessibilityLabel="Open notifications"><Text style={{fontSize:18,color:colors.mint}}>♧</Text></Pressable><Pressable onPress={()=>navigation.navigate('Groups')} style={{width:42,height:42,borderRadius:14,backgroundColor:colors.mintPale,alignItems:'center',justifyContent:'center'}} accessibilityRole="button" accessibilityLabel="Open groups"><Text style={{fontSize:19,color:colors.mint}}>⌘</Text></Pressable></View>}/></View>
  {!online?<Notice tone="error">You’re offline. Messages will load when your connection returns.</Notice>:null}
  {error?<Notice tone="error">{error} <Text onPress={load} style={{fontWeight:'800',color:colors.mint}}>Retry</Text></Notice>:null}
  <Field value={query} onChangeText={setQuery} placeholder="Search chats" returnKeyType="search" style={{marginBottom:10}}/>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
   <View style={{flexDirection:'row',gap:8}}><Pressable onPress={()=>setUnreadOnly(false)} style={{paddingVertical:7,paddingHorizontal:13,borderRadius:12,backgroundColor:!unreadOnly?colors.mint:colors.white,borderWidth:1,borderColor:!unreadOnly?colors.mint:colors.line}}><Text style={{fontSize:11,fontWeight:'700',color:!unreadOnly?'#fff':colors.muted}}>All chats</Text></Pressable><Pressable onPress={()=>setUnreadOnly(true)} style={{paddingVertical:7,paddingHorizontal:13,borderRadius:12,backgroundColor:unreadOnly?colors.mint:colors.white,borderWidth:1,borderColor:unreadOnly?colors.mint:colors.line}}><Text style={{fontSize:11,fontWeight:'700',color:unreadOnly?'#fff':colors.muted}}>Unread</Text></Pressable></View>
   <Pressable onPress={()=>tabs.navigate('People')} accessibilityRole="button"><Text style={{color:colors.mint,fontWeight:'800',fontSize:12}}>＋ New chat</Text></Pressable>
  </View>
  {loading?<LoadingState message="Gathering your conversations…"/>:<FlatList data={filtered} keyExtractor={item=>item.id} contentContainerStyle={{paddingBottom:24,flexGrow:1}}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={colors.mint}/>}
   ListEmptyComponent={<EmptyState title={unreadOnly?'All caught up.':'It starts with hello.'} detail={unreadOnly?'No unread messages right now.':'Find a friend, send a request, and start your first conversation.'} action={!unreadOnly?<Button title="Find people" onPress={()=>tabs.navigate('People')} small/>:undefined}/>}
   renderItem={({item})=><Pressable onPress={()=>open(item)} accessibilityRole="button" style={({pressed})=>[{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,paddingHorizontal:10,borderRadius:16,marginBottom:3,backgroundColor:pressed?colors.mintWash:'transparent'}]}>
    <Avatar name={item.title||'Haiku'} color={item.kind==='group'?colors.blue:colors.mint}/>
    <View style={{flex:1,minWidth:0,borderBottomWidth:.5,borderBottomColor:'#E9EEEA',paddingBottom:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',gap:8,alignItems:'center'}}><Text numberOfLines={1} style={{fontSize:14,fontWeight:item.unread_count?'800':'700',color:colors.ink,flex:1}}>{item.title||'Conversation'}</Text><Text style={{fontSize:10,color:colors.muted}}>{item.last_message_at?new Date(item.last_message_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):''}</Text></View>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:5}}><Text numberOfLines={1} style={{flex:1,fontSize:12,color:item.unread_count?colors.body:colors.muted}}>{item.last_message_type&&item.last_message_type!=='text'?'◉  Shared media':item.last_message_text||'Say hello to begin'}</Text>{item.unread_count>0?<View style={{minWidth:20,height:20,borderRadius:10,backgroundColor:colors.mint,alignItems:'center',justifyContent:'center',paddingHorizontal:5}}><Text style={{fontSize:10,color:'#fff',fontWeight:'800'}}>{item.unread_count}</Text></View>:null}</View>
      {item.kind==='group'?<Text style={{fontSize:9,color:colors.muted,marginTop:4}}>{item.member_count} members</Text>:null}
    </View>
   </Pressable>}/>} 
 </Screen>;
}
