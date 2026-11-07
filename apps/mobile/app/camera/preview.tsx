import React from 'react';
import { CameraPreviewScreen } from '../../src/screens/CameraPreviewScreen';

export default function CameraPreviewRoute(props: any) {
  const uri = props?.route?.params?.uri || props?.uri || '';
  const mediaType = props?.route?.params?.mediaType || props?.mediaType || 'photo';

  const adaptedRoute = {
    key: 'camera-preview',
    name: 'CameraPreview' as const,
    params: {
      uri: String(uri),
      mediaType: mediaType as 'photo' | 'video',
    },
  };

  return <CameraPreviewScreen route={adaptedRoute as any} navigation={props?.navigation as any} />;
}
