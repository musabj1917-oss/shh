import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { initImmersive, useImmersive } from './src/system/immersive';

function AppRoot() {
  const { colors, isDark } = useTheme();
  const { immersive } = useImmersive();

  useEffect(() => {
    void initImmersive();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar
        hidden={immersive}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <AppNavigator />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <AppRoot />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
