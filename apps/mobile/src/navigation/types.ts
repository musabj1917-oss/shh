import type {NavigatorScreenParams} from '@react-navigation/native';
export type RootStackParamList={
  Main:NavigatorScreenParams<MainTabParamList>|undefined;
  Auth:undefined;
  ForgotPassword:undefined;
  Notifications:undefined;
  PublicProfile:{userId:string};
  Chat:{conversationId:string;title:string;kind:'direct'|'group'};
  Groups:undefined;
  JoinGroup:{token:string};
  GroupDetail:{groupId:string;name:string;role:string};
  StoryView:{storyId:string;title:string;mediaType:'image'|'video'};
  PasswordReset:{token:string};
};
export type MainTabParamList={Inbox:undefined;Stories:undefined;People:undefined;Profile:undefined};
