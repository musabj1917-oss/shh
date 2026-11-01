import React,{useCallback,useState} from 'react';
import {Alert,FlatList,Modal,Pressable,Text,View} from 'react-native';
import {useFocusEffect,useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {api,messageForError} from '../api/client';
import {inviteTokenFromUrl} from '../invites';
import type {RootStackParamList} from '../navigation/types';
import {Avatar,Button,EmptyState,Field,LoadingState,Notice,Surface} from '../components/UI';
import {colors} from '../theme/colors';

type Group={id:string;conversation_id:string;name:string;role:string;member_count:number;last_message?:string|null};
type Friend={id:string;username:string;display_name:string};
export function GroupsScreen(){
 const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
 const [groups,setGroups]=useState<Group[]>([]),[friends,setFriends]=useState<Friend[]>([]),[selected,setSelected]=useState<string[]>([]),[name,setName]=useState(''),[joinToken,setJoinToken]=useState(''),[modal,setModal]=useState(false),[joinModal,setJoinModal]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[joining,setJoining]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{setError('');try{const [g,f]=await Promise.all([api<{groups:Group[]}>('/groups'),api<{friends:Friend[]}>('/friends')]);setGroups(g.groups||[]);setFriends(f.friends||[]);}catch(e){setError(messageForError(e));}finally{setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 const create=async()=>{if(!name.trim()){setError('Add a group name.');return;}setBusy(true);setError('');try{await api('/groups',{method:'POST',body:JSON.stringify({name:name.trim(),memberIds:selected})});setModal(false);setName('');setSelected([]);await load();}catch(e){setError(messageForError(e));}finally{setBusy(false);}};
 const join=async()=>{const raw=joinToken.trim();const token=inviteTokenFromUrl(raw)||raw;if(!token){setError('Enter an invitation link or token.');return;}setJoining(true);setError('');try{const result=await api<{status:'joined'|'approval_required';groupId?:string;groupName?:string}>('/groups/join/'+encodeURIComponent(token),{method:'POST'});setJoinModal(false);setJoinToken('');if(result.status==='approval_required')Alert.alert('Request sent','A group admin will review your request.');else Alert.alert('You’re in','You joined the group.');await load();}catch(e){setError(messageForError(e));}finally{setJoining(false);}};
 const toggle=(id:string)=>setSelected(prev=>prev.includes(id)?prev.filter(item=>item!==id):[...prev,id]);
 return <View style={{flex:1,backgroundColor:colors.canvas,padding:18,paddingTop:20}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><View><Text style={{fontSize:10,fontWeight:'800',letterSpacing:1.4,color:colors.mint}}>TOGETHER</Text><Text style={{fontSize:27,fontWeight:'800',letterSpacing:-.8,color:colors.ink,marginTop:3}}>Your groups</Text></View><View style={{flexDirection:'row',gap:7}}><Button title="Join" kind="secondary" onPress={()=>{setJoinModal(true);setError('');}} small/><Button title="＋ New" onPress={()=>{setModal(true);setError('');}} small/></View></View>
  {error?<Notice tone="error">{error}</Notice>:null}
  {loading?<LoadingState message="Loading groups…"/>:<FlatList data={groups} keyExtractor={item=>item.id} contentContainerStyle={{flexGrow:1,paddingBottom:30}}
   ListEmptyComponent={<EmptyState title="Better together." detail="Create a group to bring your friends into one conversation." action={<Button title="Create a group" onPress={()=>setModal(true)} small/>}/>}
   renderItem={({item})=><Surface style={{padding:13,marginBottom:9,borderRadius:17,flexDirection:'row',alignItems:'center',gap:11}}>
    <Pressable onPress={()=>navigation.navigate('Chat',{conversationId:item.conversation_id,title:item.name,kind:'group'})} style={{flex:1,flexDirection:'row',alignItems:'center',gap:10}}><Avatar name={item.name} color={colors.blue}/><View style={{flex:1}}><Text numberOfLines={1} style={{fontSize:13,fontWeight:'800',color:colors.ink}}>{item.name}</Text><Text style={{fontSize:10,color:colors.muted,marginTop:3}}>{item.member_count} members · {item.role}</Text><Text numberOfLines={1} style={{fontSize:10,color:colors.body,marginTop:4}}>{item.last_message||'Start your group conversation'}</Text></View></Pressable>
    <Pressable onPress={()=>navigation.navigate('GroupDetail',{groupId:item.id,name:item.name,role:item.role})} accessibilityRole="button" accessibilityLabel={`Manage ${item.name}`} style={{padding:8}}><Text style={{fontSize:19,color:colors.mint}}>···</Text></Pressable>
   </Surface>}/>} 
  <Modal visible={joinModal} transparent animationType="fade" onRequestClose={()=>setJoinModal(false)}>
   <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.72)',justifyContent:'center',padding:18}}><View style={{backgroundColor:'rgba(23,23,23,0.98)',borderRadius:24,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',padding:22}}>
    <Text style={{fontSize:20,fontWeight:'800',color:colors.ink}}>Join a group</Text><Text style={{fontSize:11,color:colors.muted,marginTop:5,marginBottom:14}}>Paste the invitation link or token shared by a group member.</Text>
    {error?<Notice tone="error">{error}</Notice>:null}<Field label="Invitation link or token" value={joinToken} onChangeText={setJoinToken} autoCapitalize="none" autoCorrect={false}/>
    <View style={{flexDirection:'row',gap:8,marginTop:8}}><Button title="Cancel" kind="secondary" onPress={()=>setJoinModal(false)} style={{flex:1}}/><Button title="Continue" onPress={join} loading={joining} style={{flex:1}}/></View>
   </View></View>
  </Modal>
  <Modal visible={modal} transparent animationType="fade" onRequestClose={()=>setModal(false)}>
   <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.72)',justifyContent:'center',padding:18}}><View style={{maxHeight:'86%',backgroundColor:'rgba(23,23,23,0.98)',borderRadius:24,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',padding:22}}>
    <Text style={{fontSize:20,fontWeight:'800',color:colors.ink}}>Create a group</Text><Text style={{fontSize:11,color:colors.muted,marginTop:5,marginBottom:14}}>You’ll be the owner. Choose friends to add now or later.</Text>
    {error?<Notice tone="error">{error}</Notice>:null}
    <Field label="Group name" value={name} onChangeText={setName} placeholder="Weekend plans" maxLength={80}/>
    <Text style={{fontSize:11,fontWeight:'700',color:colors.body,marginBottom:7}}>Add friends · {selected.length} selected</Text>
    <FlatList data={friends} keyExtractor={item=>item.id} style={{maxHeight:250}} ListEmptyComponent={<Text style={{fontSize:11,color:colors.muted,padding:12}}>Add friends first, or create an empty group.</Text>} renderItem={({item})=><Pressable onPress={()=>toggle(item.id)} style={{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:8}}><Avatar name={item.display_name}/><View style={{flex:1}}><Text style={{fontSize:12,fontWeight:'700',color:colors.ink}}>{item.display_name}</Text><Text style={{fontSize:10,color:colors.muted}}>@{item.username}</Text></View><Text style={{fontSize:18,color:selected.includes(item.id)?colors.mint:colors.muted}}>{selected.includes(item.id)?'●':'○'}</Text></Pressable>}/>
    <View style={{flexDirection:'row',gap:8,marginTop:14}}><Button title="Cancel" kind="secondary" onPress={()=>setModal(false)} style={{flex:1}}/><Button title="Create group" onPress={create} loading={busy} style={{flex:1}}/></View>
   </View></View>
  </Modal>
 </View>;
}
