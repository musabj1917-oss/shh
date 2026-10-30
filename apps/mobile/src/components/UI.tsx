import React from 'react';
import {ActivityIndicator,Image,Pressable,ScrollView,StyleSheet,Text,TextInput as NativeTextInput,TextInputProps,View,ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../theme/colors';

export function Screen({children,scroll=false,style}:{children:React.ReactNode;scroll?:boolean;style?:ViewStyle}){
  return <SafeAreaView style={[s.screen,style]} edges={['top','left','right']}>
    {scroll?<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>{children}</ScrollView>:children}
  </SafeAreaView>;
}
export function BrandMark({size=38}:{size?:number}){return <View style={[s.brand,{width:size,height:size,borderRadius:size*.34}]}><Text style={[s.brandText,{fontSize:size*.46}]}>h</Text></View>;}
export function PageHeading({eyebrow,title,subtitle,right}:{eyebrow?:string;title:string;subtitle?:string;right?:React.ReactNode}){
 return <View style={s.headingRow}><View style={{flex:1}}>{eyebrow?<Text style={s.eyebrow}>{eyebrow}</Text>:null}<Text style={s.heading}>{title}</Text>{subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}</View>{right}</View>;
}
export function Button({title,onPress,kind='primary',disabled=false,loading=false,small=false,style}:{title:string;onPress:()=>void;kind?:'primary'|'secondary'|'ghost'|'danger';disabled?:boolean;loading?:boolean;small?:boolean;style?:ViewStyle}){
  return <Pressable onPress={onPress} disabled={disabled||loading} accessibilityRole="button" style={({pressed})=>[s.button,s[`button_${kind}`],small&&s.buttonSmall,disabled&&s.disabled,pressed&&!disabled&&s.pressed,style]}>
    {loading?<ActivityIndicator size="small" color={kind==='primary'?'#fff':colors.mint}/>:<Text style={[s.buttonText,s[`buttonText_${kind}`],small&&s.buttonTextSmall]}>{title}</Text>}
  </Pressable>;
}
export function Field({label,error,style,...props}:Omit<TextInputProps,'style'> & {label?:string;error?:string;style?:ViewStyle}){
 return <View style={[{marginBottom:14},style]}>{label?<Text style={s.label}>{label}</Text>:null}<NativeTextInput placeholderTextColor="#9AA6A1" style={[s.field,error&&{borderColor:colors.red}]} accessibilityLabel={label} {...props}/>{error?<Text style={s.error}>{error}</Text>:null}</View>;
}
export function Surface({children,style}:{children:React.ReactNode;style?:ViewStyle}){return <View style={[s.surface,style]}>{children}</View>;}
export function Avatar({name,color=colors.mint,large=false}:{name:string;color?:string;large?:boolean}){
 const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
 return <View style={[s.avatar,large&&s.avatarLarge,{backgroundColor:color+'20'}]}><Text style={[s.avatarText,large&&{fontSize:18},{color}]}>{initials||'H'}</Text></View>;
}
export function RemoteAvatar({name,uri,color=colors.mint,large=false}:{name:string;uri?:string|null;color?:string;large?:boolean}){
 const size=large?72:44;
 if(!uri)return <Avatar name={name} color={color} large={large}/>;
 return <View style={[s.avatar,large&&s.avatarLarge,{overflow:'hidden',backgroundColor:color+'20'}]}><Image source={{uri}} resizeMode="cover" style={{width:size,height:size}} accessibilityLabel={`${name} profile picture`}/></View>;
}
export function LoadingState({message='Loading…'}:{message?:string}){return <View style={s.center}><ActivityIndicator size="large" color={colors.mint}/><Text style={s.muted}>{message}</Text></View>;}
export function EmptyState({title,detail,action}:{title:string;detail:string;action?:React.ReactNode}){return <View style={s.empty}><View style={s.emptyIcon}><Text style={{fontSize:24}}>✳</Text></View><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyDetail}>{detail}</Text>{action? <View style={{marginTop:16}}>{action}</View>:null}</View>;}
export function Notice({children,tone='info'}:{children:React.ReactNode;tone?:'info'|'error'|'success'}){
 const bg=tone==='error'?'#FFF1F0':tone==='success'?'#EAF6EE':colors.mintPale;const fg=tone==='error'?colors.red:tone==='success'?colors.mintDark:colors.mintDark;
 return <View style={[s.notice,{backgroundColor:bg}]}><Text style={[s.noticeText,{color:fg}]}>{children}</Text></View>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.canvas},scroll:{padding:20,paddingBottom:34},brand:{backgroundColor:colors.mint,alignItems:'center',justifyContent:'center',shadowColor:colors.mint,shadowOpacity:.15,shadowRadius:12,elevation:4},brandText:{fontWeight:'900',fontStyle:'italic',color:'#fff',marginTop:-3},
 headingRow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20},eyebrow:{fontSize:10,letterSpacing:1.8,fontWeight:'800',color:colors.mint,marginBottom:5},heading:{fontSize:27,lineHeight:32,letterSpacing:-.7,fontWeight:'800',color:colors.ink},subtitle:{marginTop:5,fontSize:13,lineHeight:19,color:colors.muted},
 button:{minHeight:48,borderRadius:15,alignItems:'center',justifyContent:'center',paddingHorizontal:18,flexDirection:'row'},button_primary:{backgroundColor:colors.mint},button_secondary:{backgroundColor:colors.mintPale,borderWidth:1,borderColor:'#D8EDE3'},button_ghost:{backgroundColor:'transparent'},button_danger:{backgroundColor:'#FFF0EE'},buttonText:{fontSize:14,fontWeight:'700'},buttonText_primary:{color:'#fff'},buttonText_secondary:{color:colors.mintDark},buttonText_ghost:{color:colors.mintDark},buttonText_danger:{color:colors.red},buttonSmall:{minHeight:35,borderRadius:11,paddingHorizontal:12},buttonTextSmall:{fontSize:12},disabled:{opacity:.45},pressed:{opacity:.8,transform:[{scale:.99}]},
 label:{fontSize:11,fontWeight:'700',color:colors.body,marginBottom:6},field:{height:50,borderWidth:1,borderColor:colors.line,borderRadius:14,backgroundColor:'#fff',paddingHorizontal:14,color:colors.ink,fontSize:14},error:{color:colors.red,fontSize:11,marginTop:5},surface:{backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:colors.line,padding:16,shadowColor:'#1C332C',shadowOpacity:.035,shadowRadius:12,elevation:1},avatar:{width:44,height:44,borderRadius:16,alignItems:'center',justifyContent:'center'},avatarLarge:{width:72,height:72,borderRadius:25},avatarText:{fontWeight:'800',fontSize:12},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12},muted:{fontSize:13,color:colors.muted},empty:{alignItems:'center',justifyContent:'center',paddingHorizontal:22,paddingVertical:40},emptyIcon:{width:52,height:52,borderRadius:18,backgroundColor:colors.mintPale,alignItems:'center',justifyContent:'center',marginBottom:13},emptyTitle:{fontWeight:'800',fontSize:16,color:colors.ink},emptyDetail:{fontSize:12,color:colors.muted,textAlign:'center',lineHeight:18,marginTop:6,maxWidth:270},notice:{padding:12,borderRadius:13,marginBottom:12},noticeText:{fontSize:12,lineHeight:18,fontWeight:'600'}
});
