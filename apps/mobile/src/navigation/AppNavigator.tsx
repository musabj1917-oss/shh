import React,{useCallback,useEffect} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {NavigationContainer,useNavigationContainerRef} from '@react-navigation/native';
import type {LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
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

function LeftNavRail({state,descriptors,navigation,insets}:BottomTabBarProps){
  return (
    <View style={{
      width:72,
      paddingTop:Math.max(insets.top,14),
      paddingBottom:Math.max(insets.bottom,14),
      backgroundColor:'rgba(10, 16, 13, 0.98)',
      borderRightWidth:1,
      borderRightColor:colors.line,
      alignItems:'center',
      justifyContent:'space-between',
      zIndex:10
    }}>
      {/* Top: App Logo */}
      <View style={{alignItems:'center',gap:12}}>
        <BrandMark size={36}/>
        <View style={{width:28,height:1,backgroundColor:colors.line}}/>
      </View>

      {/* Center: Navigation Menu on the left */}
      <View style={{gap:14,alignItems:'center'}}>
        {state.routes.map((route,index)=>{
          const isFocused=state.index===index;
          const {options}=descriptors[route.key];
          const label=options.tabBarLabel!==undefined
            ? options.tabBarLabel
            : options.title!==undefined
            ? options.title
            : route.name;
          const glyph=tabGlyph[route.name as keyof MainTabParamList];

          const onPress=()=>{
            const event=navigation.emit({
              type:'tabPress',
              target:route.key,
              canPreventDefault:true
            });
            if(!isFocused&&!event.defaultPrevented){
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused?{selected:true}:{}}
              accessibilityLabel={typeof label==='string'?label:route.name}
              style={({pressed})=>[
                {
                  width:54,
                  height:52,
                  borderRadius:16,
                  alignItems:'center',
                  justifyContent:'center',
                  backgroundColor:isFocused?'rgba(163, 230, 53, 0.14)':pressed?'rgba(255, 255, 255, 0.04)':'transparent',
                  borderWidth:1,
                  borderColor:isFocused?'rgba(163, 230, 53, 0.35)':'transparent'
                }
              ]}
            >
              <Text style={{fontSize:19}}>{glyph}</Text>
              <Text style={{
                fontSize:9,
                fontWeight:isFocused?'800':'600',
                color:isFocused?colors.mint:colors.muted,
                marginTop:2,
                letterSpacing:0.2
              }}>
                {typeof label==='string'?label:route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bottom: Active status indicator */}
      <View style={{alignItems:'center',gap:6}}>
        <View style={{width:8,height:8,borderRadius:4,backgroundColor:colors.mint,opacity:0.85}}/>
      </View>
    </View>
  );
}

function MainTabs(){
 return <Tabs.Navigator
   tabBar={(props)=><LeftNavRail {...props}/>}
   screenOptions={{
     headerShown:false,
     tabBarPosition:'left',
     sceneStyle:{backgroundColor:colors.canvas}
   }}>
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
