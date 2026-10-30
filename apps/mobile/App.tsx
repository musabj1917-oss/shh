import React from 'react';
import {StatusBar,StyleSheet,View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/auth/AuthContext';
import {AppNavigator} from './src/navigation/AppNavigator';
import {colors} from './src/theme/colors';

export default function App(){
  return <SafeAreaProvider><AuthProvider><View style={styles.root}><StatusBar barStyle="dark-content"/><AppNavigator/></View></AuthProvider></SafeAreaProvider>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:colors.canvas}});
