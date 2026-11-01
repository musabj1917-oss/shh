import React,{useCallback,useState} from 'react';
import {Alert,FlatList,Modal,Pressable,Text,View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect,useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {api,messageForError} from '../api/client';
import type {RootStackParamList} from '../navigation/types';
import {Avatar,Button,EmptyState,Field,FilterPill,LoadingState,Notice,PageHeading,Screen,Surface} from '../components/UI';
import {colors} from '../theme/colors';

type Person={id:string;username:string;display_name:string;bio?:string|null;avatar_object_key?:string|null};
type RequestRow=Person&{id:string;created_at:string;user_id?:string};
export function FriendsScreen(){
 const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
 const [tab,setTab]=useState<'friends'|'requests'|'discover'>('friends');
 const [friends,setFriends]=useState<Person[]>([]),[requests,setRequests]=useState<RequestRow[]>([]),[people,setPeople]=useState<Person[]>([]);
 const [query,setQuery]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busyId,setBusyId]=useState(''),[reportTarget,setReportTarget]=useState<Person|null>(null),[reportReason,setReportReason]=useState(''),[reportCategory,setReportCategory]=useState<'harassment'|'spam'|'impersonation'|'unsafe_content'|'other'>('other'),[sendingReport,setSendingReport]=useState(false),[evidenceId,setEvidenceId]=useState(''),[evidenceLabel,setEvidenceLabel]=useState(''),[evidenceBusy,setEvidenceBusy]=useState(false);
 const load=useCallback(async()=>{setError('');try{
  const [f,r]=await Promise.all([api<{friends:Person[]}>('/friends'),api<{requests:RequestRow[]}>('/friends/requests?direction=incoming')]);
  setFriends(f.friends||[]);setRequests(r.requests||[]);
 }catch(e){setError(messageForError(e));}finally{setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 const search=async()=>{if(query.trim().length<2){setError('Type at least two characters to discover people.');return;}setError('');setBusyId('search');try{const r=await api<{people:Person[]}>(`/profile/search?q=${encodeURIComponent(query.trim())}`);setPeople(r.people||[]);setTab('discover');}catch(e){setError(messageForError(e));}finally{setBusyId('');}};
 const suggestions=async()=>{setError('');setBusyId('suggestions');try{const r=await api<{people:Person[]}>('/profile/discover?mode=random&limit=20');setPeople(r.people||[]);setTab('discover');}catch(e){setError(messageForError(e));}finally{setBusyId('');}};
 const sendRequest=async(person:Person)=>{setError('');setBusyId(person.id);try{await api(`/friends/requests/${person.id}`,{method:'POST'});setPeople(prev=>prev.filter(x=>x.id!==person.id));}catch(e){setError(messageForError(e));}finally{setBusyId('');}};
 const accept=async(row:RequestRow)=>{setBusyId(row.id);setError('');try{await api(`/friends/requests/${row.id}/accept`,{method:'POST'});await load();}catch(e){setError(messageForError(e));}finally{setBusyId('');}};
 const reject=async(row:RequestRow)=>{setBusyId(row.id);setError('');try{await api(`/friends/requests/${row.id}/reject`,{method:'POST'});await load();}catch(e){setError(messageForError(e));}finally{setBusyId('');}};
 const startChat=async(person:Person)=>{setBusyId(person.id);setError('');try{const result=await api<{conversationId:string;kind:'direct'}>(`/conversations/direct/${person.id}`,{method:'POST'});navigation.navigate('Chat',{conversationId:result.conversationId,title:person.display_name,kind:'direct'});}catch(e){setError(messageForError(e));}finally{setBusyId('');}};
 const closeReport=()=>{setReportTarget(null);setReportReason('');setEvidenceId('');setEvidenceLabel('');};
 const attachEvidence=async()=>{setError('');const picked=await launchImageLibrary({mediaType:'mixed',selectionLimit:1,quality:.8});if(picked.didCancel)return;if(picked.errorCode){setError(picked.errorMessage||'Evidence could not be selected.');return;}const asset=picked.assets?.[0];if(!asset?.uri){setError('The selected file could not be opened.');return;}const mimeType=(asset.type||'image/jpeg').toLowerCase(),mediaType=mimeType.startsWith('video/')?'video':'image',byteSize=asset.fileSize||0;if(!byteSize){setError('Could not determine this file’s size. Choose another file.');return;}setEvidenceBusy(true);try{const intent=await api<{attachmentId:string;upload:{mode:'proxy'|'signed';url:string;method:'PUT';headers:Record<string,string>}}>('/media/upload-intents',{method:'POST',body:JSON.stringify({purpose:'report',mediaType,mimeType,byteSize})});const blob=await (await fetch(asset.uri)).blob();const uploaded=await fetch(intent.upload.url,{method:intent.upload.method,headers:intent.upload.headers,body:blob});if(!uploaded.ok)throw new Error(`Upload failed (${uploaded.status}).`);if(intent.upload.mode==='signed')await api(`/media/${intent.attachmentId}/complete`,{method:'POST'});setEvidenceId(intent.attachmentId);setEvidenceLabel(asset.fileName||(mediaType==='video'?'Video evidence':'Photo evidence'));}catch(e){setError(messageForError(e));}finally{setEvidenceBusy(false);}};
 const report=async()=>{if(!reportTarget)return;setSendingReport(true);setError('');try{await api('/reports',{method:'POST',body:JSON.stringify({targetUserId:reportTarget.id,category:reportCategory,reason:reportReason.trim()||undefined,evidenceAttachmentId:evidenceId||undefined})});Alert.alert('Report sent','Thank you. Your report was submitted for review.');closeReport();}catch(e){setError(messageForError(e));}finally{setSendingReport(false);}};
 const friendActions=(person:Person)=>Alert.alert(person.display_name,`Choose an action for @${person.username}.`,[{text:'Message',onPress:()=>{void startChat(person);}},{text:'Remove friend',style:'destructive',onPress:()=>Alert.alert('Remove friend?',`You will need a new accepted request before starting another private conversation with ${person.display_name}.`,[{text:'Cancel',style:'cancel'},{text:'Remove',style:'destructive',onPress:async()=>{try{await api(`/friends/${person.id}`,{method:'DELETE'});await load();}catch(e){setError(messageForError(e));}}}])},{text:'Block account',style:'destructive',onPress:()=>Alert.alert('Block account?',`${person.display_name} will no longer be able to contact you. This also removes the friendship.`,[{text:'Cancel',style:'cancel'},{text:'Block',style:'destructive',onPress:async()=>{try{await api(`/friends/blocks/${person.id}`,{method:'POST'});await load();}catch(e){setError(messageForError(e));}}}])},{text:'Report account',onPress:()=>setReportTarget(person)},{text:'Cancel',style:'cancel'}]);
 const data=tab==='friends'?friends:tab==='requests'?requests:people;
 return <Screen style={{paddingHorizontal:18,paddingTop:18}}>
  <PageHeading eyebrow="CONNECTIONS" title="People" subtitle="Find friends and start meaningful conversations."/>
  {error?<Notice tone="error">{error}</Notice>:null}
  <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
   <FilterPill label="Friends" active={tab==='friends'} count={friends.length} onPress={()=>{setTab('friends');setError('');}}/>
   <FilterPill label="Requests" active={tab==='requests'} count={requests.length} onPress={()=>{setTab('requests');setError('');}}/>
   <FilterPill label="Discover" active={tab==='discover'} onPress={()=>{setTab('discover');setError('');}}/>
  </View>
  {tab==='discover'?<><View style={{flexDirection:'row',gap:8,alignItems:'flex-start'}}><Field value={query} onChangeText={setQuery} placeholder="Search by name or username" autoCapitalize="none" style={{flex:1,marginBottom:8}} onSubmitEditing={search}/><Button title="Search" onPress={search} loading={busyId==='search'} small style={{marginTop:19}}/></View><Pressable onPress={suggestions} disabled={Boolean(busyId)} style={{alignSelf:'flex-start',paddingVertical:6,paddingHorizontal:10,borderRadius:12,backgroundColor:colors.mintPale,borderWidth:1,borderColor:colors.line,marginBottom:10}}><Text style={{fontSize:11,color:colors.mint,fontWeight:'800'}}>{busyId==='suggestions'?'Finding people…':'✦  Show suggested people'}</Text></Pressable></>:null}
  {loading&&tab!=='discover'?<LoadingState message="Finding your people…"/>:<FlatList data={data} keyExtractor={(item,index)=>`${item.id}-${index}`} contentContainerStyle={{paddingBottom:26,flexGrow:1}}
   ListEmptyComponent={<EmptyState title={tab==='friends'?'Your circle is waiting.':tab==='requests'?'No pending requests.':'Explore Haiku Messenger.'} detail={tab==='friends'?'Discover people, send a friend request, and start a private chat after they accept.':tab==='requests'?'Friend requests you receive will appear here.':'Search for a username or display name to find people.'}/>}
   renderItem={({item})=>{
    const row=item as Person&Partial<RequestRow>;
    return <Surface style={{padding:14,marginBottom:10,borderRadius:18,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.card,borderWidth:1,borderColor:colors.line}}>
      <Avatar name={row.display_name||row.username}/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={{fontSize:14,fontWeight:'800',color:colors.ink}}>{row.display_name}</Text><Text style={{fontSize:11,color:colors.muted,marginTop:2}}>@{row.username}</Text>{row.bio?<Text numberOfLines={1} style={{fontSize:11,color:colors.body,marginTop:4}}>{row.bio}</Text>:null}<Text onPress={()=>navigation.navigate('PublicProfile',{userId:row.user_id||row.id})} accessibilityRole="button" style={{fontSize:10,color:colors.mint,fontWeight:'700',marginTop:6}}>View profile →</Text></View>
      {tab==='friends'?<View style={{flexDirection:'row',alignItems:'center',gap:4}}><Button title="Message" onPress={()=>startChat(row)} loading={busyId===row.id} small/><Pressable onPress={()=>friendActions(row)} accessibilityRole="button" accessibilityLabel={`More actions for ${row.display_name}`} style={{padding:8}}><Text style={{fontSize:18,color:colors.muted}}>···</Text></Pressable></View>:tab==='requests'?<View style={{flexDirection:'row',gap:6}}><Button title="Accept" onPress={()=>accept(row as RequestRow)} loading={busyId===row.id} small/><Pressable onPress={()=>reject(row as RequestRow)} style={{paddingHorizontal:8,justifyContent:'center'}}><Text style={{fontSize:11,color:colors.red,fontWeight:'700'}}>Decline</Text></Pressable></View>:<View style={{alignItems:'center'}}><Button title="Add" onPress={()=>sendRequest(row)} loading={busyId===row.id} small/><Pressable onPress={()=>setReportTarget(row)} style={{padding:3}}><Text style={{fontSize:8,color:colors.muted}}>Report</Text></Pressable></View>}
     </Surface>;
   }}/>} 
  <Modal visible={Boolean(reportTarget)} transparent animationType="fade" onRequestClose={closeReport}>
    <View style={{flex:1,justifyContent:'center',padding:18,backgroundColor:'rgba(0,0,0,0.65)'}}>
      <View style={{backgroundColor:'rgba(23, 23, 23, 0.96)',borderRadius:24,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',padding:22}}>
        <Text style={{fontSize:19,fontWeight:'800',color:colors.ink}}>Report account</Text>
        <Text style={{fontSize:11,color:colors.body,marginTop:5,marginBottom:12}}>Report {reportTarget?.display_name} for review. Please don’t include sensitive personal data.</Text>
        {error?<Notice tone="error">{error}</Notice>:null}
        <Text style={{fontSize:10,fontWeight:'700',color:colors.body,marginBottom:7}}>Reason category</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:12}}>
          {(['harassment','spam','impersonation','unsafe_content','other'] as const).map(category=>(
            <Pressable key={category} onPress={()=>setReportCategory(category)} style={{paddingVertical:7,paddingHorizontal:10,borderRadius:11,borderWidth:1,borderColor:reportCategory===category?colors.mint:colors.line,backgroundColor:reportCategory===category?colors.mint:colors.card}}>
              <Text style={{fontSize:10,color:reportCategory===category?colors.mintContrast:colors.body,fontWeight:'700'}}>{category.replace('_',' ')}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Additional context (optional)" value={reportReason} onChangeText={setReportReason} placeholder="What happened?" multiline maxLength={2000} style={{height:96}}/>
        <View style={{flexDirection:'row',gap:8,alignItems:'center',marginBottom:14}}>
          <Button title={evidenceId?'Replace evidence':'Attach evidence'} kind="secondary" onPress={attachEvidence} loading={evidenceBusy} small/>
          <Text numberOfLines={1} style={{flex:1,fontSize:10,color:evidenceId?colors.mintAccent:colors.muted}}>{evidenceId?evidenceLabel:'Optional photo or video'}</Text>
          {evidenceId?<Pressable onPress={()=>{setEvidenceId('');setEvidenceLabel('');}} accessibilityRole="button" accessibilityLabel="Remove evidence"><Text style={{fontSize:10,color:colors.red,fontWeight:'700'}}>Remove</Text></Pressable>:null}
        </View>
        <View style={{flexDirection:'row',gap:8}}>
          <Button title="Cancel" kind="secondary" onPress={closeReport} style={{flex:1}}/>
          <Button title="Submit report" onPress={report} loading={sendingReport} disabled={evidenceBusy} style={{flex:1}}/>
        </View>
      </View>
    </View>
  </Modal>
 </Screen>;
}
