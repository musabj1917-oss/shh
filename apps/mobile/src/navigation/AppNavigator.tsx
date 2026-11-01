import React,{useCallback,useEffect} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {NavigationContainer,useNavigationContainerRef} from '@react-navigation/native';
import type {LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {MainTabParamList,RootStackParamList} from './types';
import {useAuth} from '../auth/AuthContext';
import {AuthScreen} from '../screens/AuthScreen';
import {ForgotPasswordScreen} from '../screens/ForgotPasswordScreen';
import {InboxScreen} from '../screens/InboxScreen';
import {ChatScreen} from '../screens/ChatScreen';
import {GroupsScreen} from '../screens/GroupsScreen';
import {GroupDetailScreen} from '../screens/GroupDetailScreen';
import {StoriesScreen} from '../screens/StoriesScreen';
import {StoryViewScreen} from '../screens/StoryViewScreen';
import {FriendsScreen} from '../screens/FriendsScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {NotificationsScreen} from '../screens/NotificationsScreen';
import {PublicProfileScreen} from '../screens/PublicProfileScreen';
import {JoinGroupScreen} from '../screens/JoinGroupScreen';
import {takePendingInvite} from '../invites';
import {colors} from '../theme/colors';
import {BrandMark} from '../components/UI';

const Stack=createNativeStackNavigator<RootStackParamList>();
const Tabs=createBottomTabNavigator<MainTabParamList>();
const tabGlyph:Record<keyof MainTabParamList,string>={Inbox:'💬',Stories:'✦',People:'👥',Profile:'⚙'};
const linking:LinkingOptions<RootStackParamList>={prefixes:['haikumessenger://'],config:{screens:{JoinGroup:'join/:token'}}};

function MainTabs(){
 return <Tabs.Navigator screenOptions={({route})=>({
   headerShown:false,
   tabBarActiveTintColor:colors.mint,
   tabBarInactiveTintColor:colors.muted,
   tabBarStyle:{
     height:64,
     paddingTop:6,
     paddingBottom:8,
     backgroundColor:'rgba(10, 16, 13, 0.96)',
     borderTopWidth:1,
     borderTopColor:colors.line,
     elevation:8,
     shadowColor:'#000',
     shadowOffset:{width:0,height:-4},
     shadowOpacity:0.4,
     shadowRadius:12
   },
   tabBarLabelStyle:{fontSize:10,fontWeight:'700',letterSpacing:0.2},
   tabBarIcon:({color,focused})=>(
     <View style={{
       width:38,
       height:28,
       borderRadius:14,
       alignItems:'center',
       justifyContent:'center',
       backgroundColor:focused?'rgba(163,230,53,0.12)':'transparent'
     }}>
       <Text style={{fontSize:16,color}}>{tabGlyph[route.name]}</Text>
     </View>
   )
 })}>
  <Tabs.Screen name="Inbox" component={InboxScreen} options={{tabBarLabel:'Chats'}}/>
  <Tabs.Screen name="Stories" component={StoriesScreen} options={{tabBarLabel:'Moments'}}/>
  <Tabs.Screen name="People" component={FriendsScreen} options={{tabBarLabel:'People'}}/>
  <Tabs.Screen name="Profile" component={ProfileScreen} options={{tabBarLabel:'Settings'}}/>
 </Tabs.Navigator>;
}

export function AppNavigator(){
 const {user,loading}=useAuth();
 const navigationRef=useNavigationContainerRef<RootStackParamList>();
 const openPendingInvite=useCallback(()=>{const token=takePendingInvite();if(token&&navigationRef.isReady())navigationRef.navigate('JoinGroup',{token});},[navigationRef]);
 useEffect(()=>{if(user)openPendingInvite();},[user,openPendingInvite]);
 if(loading)return <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:14,backgroundColor:colors.canvas}}><BrandMark size={48}/><ActivityIndicator color={colors.mint}/><Text style={{color:colors.muted,fontSize:12}}>Opening your space…</Text></View>;
 return <NavigationContainer ref={navigationRef} linking={linking} onReady={openPendingInvite}><Stack.Navigator screenOptions={{headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.canvas},headerTitleStyle:{fontWeight:'700',fontSize:16},contentStyle:{backgroundColor:colors.canvas},headerShadowVisible:false}}>
  {user?<>
    <Stack.Screen name="Main" component={MainTabs} options={{headerShown:false}}/>
    <Stack.Screen name="Chat" component={ChatScreen} options={({route})=>({title:route.params.title,headerShown:false})}/>
    <Stack.Screen name="Groups" component={GroupsScreen} options={{title:'Your groups'}}/>
    <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{title:'Group invitation'}}/>
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{title:'Notifications'}}/>
    <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{title:'Profile'}}/>
    <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={({route})=>({title:route.params.name})}/>
    <Stack.Screen name="StoryView" component={StoryViewScreen} options={{title:'Story',presentation:'modal'}}/>
  </>:<>
    <Stack.Screen name="Auth" component={AuthScreen} options={{headerShown:false}}/>
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{title:'Account recovery'}}/>
    <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{title:'Group invitation'}}/>
  </>}
 </Stack.Navigator></NavigationContainer>;
}
