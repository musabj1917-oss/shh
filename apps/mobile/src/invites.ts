// Deep-link invitation tokens are held in memory only. They are not secrets
// beyond their own capability, but they should not be persisted in plain text.
let pendingInvite: string | null = null;

export function rememberInvite(token: string) {
  pendingInvite = token;
}

export function takePendingInvite() {
  const token = pendingInvite;
  pendingInvite = null;
  return token;
}

export function inviteTokenFromUrl(url: string) {
  const match = url.match(/join\/([A-Za-z0-9_-]{20,128})(?:[?#].*)?$/);
  return match ? match[1] : null;
}
