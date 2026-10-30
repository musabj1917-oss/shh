import React from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
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
import {colors} from '../theme/colors';
import {BrandMark} from '../components/UI';

const Stack=createNativeStackNavigator<RootStackParamList>();
const Tabs=createBottomTabNavigator<MainTabParamList>();
const tabGlyph:Record<keyof MainTabParamList,string>={Inbox:'◌',Stories:'◉',People:'♧',Profile:'○'};

function MainTabs(){
 return <Tabs.Navigator screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:colors.mint,tabBarInactiveTintColor:'#8A9691',tabBarStyle:{height:62,paddingTop:7,paddingBottom:7,backgroundColor:'#fff',borderTopColor:colors.line},tabBarLabelStyle:{fontSize:10,fontWeight:'700'},tabBarIcon:({color})=><Text style={{fontSize:20,color,lineHeight:22}}>{tabGlyph[route.name]}</Text>})}>
  <Tabs.Screen name="Inbox" component={InboxScreen} options={{tabBarLabel:'Chats'}}/>
  <Tabs.Screen name="Stories" component={StoriesScreen}/>
  <Tabs.Screen name="People" component={FriendsScreen}/>
  <Tabs.Screen name="Profile" component={ProfileScreen}/>
 </Tabs.Navigator>;
}

export function AppNavigator(){
 const {user,loading}=useAuth();
 if(loading)return <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:14,backgroundColor:colors.canvas}}><BrandMark size={48}/><ActivityIndicator color={colors.mint}/><Text style={{color:colors.muted,fontSize:12}}>Opening your space…</Text></View>;
 return <NavigationContainer><Stack.Navigator screenOptions={{headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.canvas},headerTitleStyle:{fontWeight:'700',fontSize:16},contentStyle:{backgroundColor:colors.canvas},headerShadowVisible:false}}>
  {user?<>
    <Stack.Screen name="Main" component={MainTabs} options={{headerShown:false}}/>
    <Stack.Screen name="Chat" component={ChatScreen} options={({route})=>({title:route.params.title,headerShown:false})}/>
    <Stack.Screen name="Groups" component={GroupsScreen} options={{title:'Your groups'}}/>
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{title:'Notifications'}}/>
    <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{title:'Profile'}}/>
    <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={({route})=>({title:route.params.name})}/>
    <Stack.Screen name="StoryView" component={StoryViewScreen} options={{title:'Story',presentation:'modal'}}/>
  </>:<>
    <Stack.Screen name="Auth" component={AuthScreen} options={{headerShown:false}}/>
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{title:'Account recovery'}}/>
  </>}
 </Stack.Navigator></NavigationContainer>;
}
