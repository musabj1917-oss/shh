import * as Ably from 'ably';

let restClient: Ably.Rest | undefined;
function getRest() {
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error('CONFIG_ABLY_MISSING');
  if (!restClient) restClient = new Ably.Rest({ key });
  return restClient;
}

/** Mint short-lived, user-scoped Ably token requests; the API key never leaves the server. */
export async function createRealtimeTokenRequest(userId: string, conversationIds: string[], preferences:{presenceVisible:boolean;typingIndicatorsEnabled:boolean;notificationsEnabled:boolean}) {
  const capability: Record<string, string[]> = {};
  if(preferences.notificationsEnabled)capability[`haiku:user:${userId}`]=['subscribe'];
  for (const id of conversationIds) {
    capability[`haiku:conversation:${id}:events`] = ['subscribe'];
    const ephemeral=['subscribe'];
    if(preferences.typingIndicatorsEnabled)ephemeral.push('publish');
    if(preferences.presenceVisible)ephemeral.push('presence');
    capability[`haiku:conversation:${id}:ephemeral`] = ephemeral;
  }
  return getRest().auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify(capability),
    ttl: 10 * 60 * 1000,
  });
}

/** Only event IDs are broadcast. Content stays in Neon and is fetched via authorized API routes. */
export async function publishMessageCreated(conversationId: string, messageId: string) {
  const client = getRest();
  await client.channels.get(`haiku:conversation:${conversationId}:events`).publish('message.created', { conversationId, messageId });
}

export async function publishUserEvent(userId: string, name: string, data: Record<string, unknown>) {
  const client = getRest();
  await client.channels.get(`haiku:user:${userId}`).publish(name, data);
}
