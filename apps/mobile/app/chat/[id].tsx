import React from 'react';
import { ChatScreen } from '../../src/screens/ChatScreen';

export default function ChatRoute(props: any) {
  const id = props?.route?.params?.id || props?.route?.params?.conversationId || props?.id || '';
  const title = props?.route?.params?.title || props?.title || 'Chat';
  const kind = props?.route?.params?.kind || props?.kind || 'direct';

  const adaptedRoute = {
    key: `chat-${id}`,
    name: 'Chat' as const,
    params: {
      conversationId: String(id),
      title: String(title),
      kind: (kind === 'group' ? 'group' : 'direct') as 'direct' | 'group',
    },
  };

  return <ChatScreen route={adaptedRoute as any} navigation={props?.navigation as any} />;
}
