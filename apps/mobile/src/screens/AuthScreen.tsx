import React,{useState} from 'react';
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {registerSchema,loginSchema,meetsMinimumAge} from '@haiku/contracts';
import type {RootStackParamList} from '../navigation/types';
import {useAuth} from '../auth/AuthContext';
import {api,messageForError} from '../api/client';
import {Button,Field,Notice,Screen,Surface,BrandMark} from '../components/UI';
import {colors} from '../theme/colors';

type Props=NativeStackScreenProps<RootStackParamList,'Auth'>;
export function AuthScreen({navigation}:Props){
 const {signIn,register}=useAuth();
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[username,setUsername]=useState(''),[displayName,setDisplayName]=useState(''),[dateOfBirth,setDateOfBirth]=useState('');
 const [error,setError]=useState(''),[info,setInfo]=useState(''),[busy,setBusy]=useState(false);
 const isRegister=mode==='register';
 const submit=async()=>{
  setError('');setInfo('');
  const emailValue=email.trim().toLowerCase();
  if(isRegister){
    const input={email:emailValue,password,username:username.trim().toLowerCase(),displayName:displayName.trim(),dateOfBirth:dateOfBirth.trim()};
    const parsed=registerSchema.safeParse(input);
    if(!parsed.success){setError(parsed.error.issues[0]?.message||'Check your details and try again.');return;}
    if(!meetsMinimumAge(input.dateOfBirth)){setError('You need to be at least 13 to create an account.');return;}
    setBusy(true);try{const result=await register(parsed.data);setInfo(result.message+' Check your inbox for the verification link.');setMode('login');}
    catch(e){setError(messageForError(e));}finally{setBusy(false);}return;
  }
  const parsed=loginSchema.safeParse({email:emailValue,password});
  if(!parsed.success){setError(parsed.error.issues[0]?.message||'Enter a valid email and password.');return;}
  setBusy(true);try{await signIn(parsed.data.email,parsed.data.password);}
  catch(e){setError(messageForError(e));}finally{setBusy(false);}
 };
 const resend=async()=>{
  setError('');setInfo('');setBusy(true);
  try{const result=await api<{message:string}>('/auth/resend-verification',{method:'POST',body:JSON.stringify(email.trim().toLowerCase()),anonymous:true});setInfo(result.message);}
  catch(e){setError(messageForError(e));}finally{setBusy(false);}
 };
 return <Screen scroll style={{backgroundColor:colors.canvas}}>
  <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}>
   <View style={{paddingHorizontal:20,paddingTop:32,paddingBottom:28}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:11,marginBottom:38}}><BrandMark size={42}/><View><Text style={{color:colors.ink,fontWeight:'800',fontSize:18,letterSpacing:-.4}}>haiku</Text><Text style={{color:colors.muted,fontSize:10,marginTop:1}}>messenger</Text></View></View>
    <Text style={{fontSize:31,lineHeight:37,fontWeight:'800',letterSpacing:-1.1,color:colors.ink,marginBottom:8}}>{isRegister?'A little closer, every day.':'Make room for the people you love.'}</Text>
    <Text style={{fontSize:13,lineHeight:20,color:colors.muted,marginBottom:22}}>{isRegister?'Create your account. No school code needed.':'A calm, private space for your conversations.'}</Text>
    {error?<Notice tone="error">{error}</Notice>:null}
    {info?<Notice tone="success">{info}</Notice>:null}
    <Surface style={{padding:18,borderRadius:22}}>
     {isRegister?<>
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="How should people see you?" maxLength={60} autoCapitalize="words" returnKeyType="next"/>
      <Field label="Username" value={username} onChangeText={setUsername} placeholder="your_name" autoCapitalize="none" autoCorrect={false} maxLength={24} returnKeyType="next"/>
      <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} returnKeyType="next"/>
     </>:null}
     <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" returnKeyType="next"/>
     <Field label="Password" value={password} onChangeText={setPassword} placeholder={isRegister?'At least 12 characters':'Your password'} secureTextEntry textContentType={isRegister?'newPassword':'password'} returnKeyType="done" onSubmitEditing={submit}/>
     <Button title={isRegister?'Create account':'Sign in'} onPress={submit} loading={busy} style={{marginTop:2}}/>
     {!isRegister?<Pressable onPress={()=>navigation.navigate('ForgotPassword')} style={{alignSelf:'center',paddingVertical:14}}><Text style={{color:colors.mint,fontSize:12,fontWeight:'700'}}>Forgot your password?</Text></Pressable>:<Text style={{color:colors.muted,fontSize:10,lineHeight:15,textAlign:'center',marginTop:11}}>By creating an account, you confirm you are at least 13. Your full birth date is private.</Text>}
    </Surface>
    {error.includes('EMAIL_UNVERIFIED')||error.toLowerCase().includes('verify your email')?<Button title="Resend verification email" kind="secondary" onPress={resend} loading={busy} style={{marginTop:12}}/>:null}
    <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5,marginTop:22}}><Text style={{color:colors.muted,fontSize:12}}>{isRegister?'Already have an account?':'New to Haiku?'}</Text><Pressable onPress={()=>{setError('');setInfo('');setMode(isRegister?'login':'register');}}><Text style={{color:colors.mint,fontSize:12,fontWeight:'800'}}>{isRegister?'Sign in':'Create an account'}</Text></Pressable></View>
    <View style={{alignItems:'center',marginTop:26}}><Text style={{color:'#A6B0AC',fontSize:10}}>A thoughtful place to stay in touch.</Text></View>
   </View>
  </KeyboardAvoidingView>
 </Screen>;
}
