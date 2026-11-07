import { useEffect, useState } from 'react';
import { NativeModules, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IMMERSIVE_STORAGE_KEY = 'haiku_immersive_system_bars';
const { HaikuImmersive } = NativeModules;

let currentImmersiveState = true;
const listeners = new Set<(enabled: boolean) => void>();

export async function setImmersive(enabled: boolean): Promise<void> {
  currentImmersiveState = enabled;

  // Sync React Native's StatusBar
  StatusBar.setHidden(enabled, 'fade');
  if (Platform.OS === 'android') {
    (StatusBar as any).setTranslucent?.(true);
  }

  if (Platform.OS === 'android' && HaikuImmersive?.setImmersive) {
    try {
      await HaikuImmersive.setImmersive(enabled);
    } catch (e) {
      console.warn('Could not set immersive mode:', e);
    }
  }

  listeners.forEach((fn) => fn(enabled));
}

export async function getPersistedImmersive(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(IMMERSIVE_STORAGE_KEY);
    if (val === null) return true; // Default ON
    return val === 'true';
  } catch {
    return true;
  }
}

export async function persistImmersive(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(IMMERSIVE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Could not persist immersive setting:', e);
  }
  await setImmersive(enabled);
}

export async function initImmersive(): Promise<void> {
  const enabled = await getPersistedImmersive();
  await setImmersive(enabled);
}

export function useImmersive() {
  const [immersive, setImmersiveState] = useState<boolean>(currentImmersiveState);

  useEffect(() => {
    setImmersiveState(currentImmersiveState);
    const handler = (enabled: boolean) => setImmersiveState(enabled);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const toggle = async () => {
    await setImmersive(!currentImmersiveState);
  };

  const updatePersisted = async (val: boolean) => {
    await persistImmersive(val);
  };

  return {
    immersive,
    setImmersive,
    toggle,
    updatePersisted,
  };
}
