import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from './src/auth/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { initImmersive, useImmersive } from './src/system/immersive';
import { UpdateGate } from './src/updates';
import { injectWebStyles, initWebMetadata } from './src/theme/webStyles';
import { PermissionsModal } from './src/components/PermissionsModal';

function AppRoot() {
  const { colors, isDark } = useTheme();
  const { immersive } = useImmersive();

  useEffect(() => {
    void initImmersive();
    initWebMetadata();
  }, []);

  useEffect(() => {
    injectWebStyles(colors.mint);
  }, [colors.mint]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar
        hidden={immersive}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <UpdateGate>
        <AppNavigator />
      </UpdateGate>
      <PermissionsModal />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <AppRoot />
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
