import React from 'react';
import { StoryViewScreen } from '../../src/screens/StoryViewScreen';

export default function StoryRoute(props: any) {
  const userId = props?.route?.params?.userId || props?.userId || '';
  const storyId = props?.route?.params?.storyId || props?.storyId || '';

  const adaptedRoute = {
    key: `story-${userId || storyId}`,
    name: 'StoryView' as const,
    params: {
      userId: userId ? String(userId) : undefined,
      storyId: storyId ? String(storyId) : undefined,
      initialIndex: props?.route?.params?.initialIndex || 0,
      stories: props?.route?.params?.stories,
    },
  };

  return <StoryViewScreen route={adaptedRoute as any} navigation={props?.navigation as any} />;
}
