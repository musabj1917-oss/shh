/**
 * Safe shim for Expo runtime globals in bare React Native environments.
 * Prevents "TypeError: Cannot read property 'EventEmitter' of undefined" and
 * "TypeError: Cannot read property 'viewManagersMetadata' of null" when
 * packages importing expo-modules-core run in a bare APK without native ExpoModulesCore.
 */

import { NativeModules } from 'react-native';

// Ensure NativeUnimoduleProxy exists for legacy or unimodule callers
if (NativeModules && !NativeModules.NativeUnimoduleProxy) {
  NativeModules.NativeUnimoduleProxy = {
    viewManagersMetadata: {},
    exportedMethods: {},
    modulesConstants: {},
  };
}

if (!globalThis.expo) {
  class EventEmitter {
    private _listeners = new Map<string, Set<Function>>();

    addListener(eventName: string, listener: Function) {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      this._listeners.get(eventName)!.add(listener);
      return {
        remove: () => {
          this.removeListener(eventName, listener);
        },
      };
    }

    removeListener(eventName: string, listener: Function) {
      this._listeners.get(eventName)?.delete(listener);
    }

    removeAllListeners(eventName?: string) {
      if (eventName) {
        this._listeners.delete(eventName);
      } else {
        this._listeners.clear();
      }
    }

    emit(eventName: string, ...args: any[]) {
      this._listeners.get(eventName)?.forEach((fn) => {
        try {
          fn(...args);
        } catch (err) {
          console.error(err);
        }
      });
    }

    listenerCount(eventName: string): number {
      return this._listeners.get(eventName)?.size ?? 0;
    }

    startObserving() {}
    stopObserving() {}
  }

  class NativeModule extends EventEmitter {
    [key: string]: any;
  }

  class SharedObject extends EventEmitter {
    release() {}
  }

  class SharedRef extends SharedObject {
    nativeRefType = 'unknown';
  }

  const dummyFallbackModule = new NativeModule();

  const moduleProxy = new Proxy({} as Record<string, any>, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) {
        return target[prop];
      }
      return new Proxy(dummyFallbackModule, {
        get(mTarget, mProp) {
          if (typeof mProp === 'string' && mProp in mTarget) {
            return (mTarget as any)[mProp];
          }
          if (mProp === '__expo_module_name__') {
            return prop;
          }
          // Return granted permission for permission queries/requests
          if (typeof mProp === 'string' && (mProp.toLowerCase().includes('permission') || mProp.endsWith('Async'))) {
            return () =>
              Promise.resolve({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
              });
          }
          return () => undefined;
        },
      });
    },
  });

  globalThis.expo = {
    EventEmitter,
    NativeModule,
    SharedObject,
    SharedRef,
    modules: moduleProxy,
    uuidv4: () => '00000000-0000-4000-8000-000000000000',
    uuidv5: () => '00000000-0000-5000-8000-000000000000',
    getViewConfig: () => ({ validAttributes: {} }),
    reloadAppAsync: async () => {},
  } as any;
}

export {};
