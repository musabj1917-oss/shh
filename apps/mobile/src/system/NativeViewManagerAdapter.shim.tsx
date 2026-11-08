import React from 'react';
import {
  Image as RNImage,
  NativeModules,
  UIManager,
  View,
} from 'react-native';

export function requireNativeViewManager<P = any>(viewName: string): React.ComponentType<P> {
  const unimoduleProxy = NativeModules?.NativeUnimoduleProxy;
  const viewManagersMetadata = unimoduleProxy?.viewManagersMetadata ?? {};
  const appIdentifier = (globalThis.expo as any)?.['__expo_app_identifier__'] ?? '';
  const viewNameSuffix = appIdentifier ? `_${appIdentifier}` : '';
  const reactNativeViewName = `ViewManagerAdapter_${viewName}${viewNameSuffix}`;

  // Check if native view manager is actually registered in UIManager
  const hasNativeViewManager = Boolean(
    viewManagersMetadata[viewName] ||
    (UIManager && (UIManager.getViewManagerConfig?.(reactNativeViewName) || (UIManager as any)[reactNativeViewName]))
  );

  if (hasNativeViewManager) {
    try {
      const NativeComponentRegistry = require('react-native/Libraries/NativeComponent/NativeComponentRegistry');
      const nativeComponent = NativeComponentRegistry.get(reactNativeViewName, () => {
        const expoViewConfig = globalThis.expo?.getViewConfig?.(viewName);
        return {
          uiViewClassName: reactNativeViewName,
          ...(expoViewConfig || {}),
        };
      });

      return class extends React.PureComponent<P> {
        static displayName = viewName;
        render() {
          const Comp = nativeComponent;
          return <Comp {...this.props} />;
        }
      };
    } catch (e) {
      console.warn(`[requireNativeViewManager] Falling back to shim for ${viewName}:`, e);
    }
  }

  // Fallback for ExpoImage -> RN Image
  if (viewName === 'ExpoImage') {
    const ExpoImageFallback = React.forwardRef<any, any>((props, ref) => {
      const { source, style, contentFit, contentPosition, transition, cachePolicy, ...rest } = props;
      const resizeMode = contentFit === 'cover' ? 'cover' : contentFit === 'contain' ? 'contain' : 'stretch';
      let resolvedSource = source;
      if (Array.isArray(source) && source.length > 0) {
        resolvedSource = source[0];
      }
      if (typeof resolvedSource === 'string') {
        resolvedSource = { uri: resolvedSource };
      }
      return (
        <RNImage
          {...rest}
          ref={ref}
          source={resolvedSource}
          style={style}
          resizeMode={resizeMode}
        />
      );
    });
    ExpoImageFallback.displayName = 'ExpoImageFallback';
    return ExpoImageFallback as any;
  }

  // General fallback for bare React Native without native Expo view managers (e.g. ExpoCamera)
  const GenericFallback = React.forwardRef<any, any>((props, ref) => {
    return <View {...props} ref={ref} />;
  });
  GenericFallback.displayName = `FallbackView_${viewName}`;
  return GenericFallback as any;
}
