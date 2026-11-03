/** Credentials for a direct LiveKit connection, issued after game admission. */
export type VoiceToken = Readonly<{
  token: string;
  serverUrl: string;
  publish: boolean;
  hidden: boolean;
}>;

export function readVoiceToken(value: unknown): VoiceToken | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4 ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    value.token.length > 16384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.token) ||
    !('serverUrl' in value) ||
    typeof value.serverUrl !== 'string' ||
    !('publish' in value) ||
    typeof value.publish !== 'boolean' ||
    !('hidden' in value) ||
    typeof value.hidden !== 'boolean' ||
    (value.hidden && value.publish)
  )
    return null;
  try {
    const url = new URL(value.serverUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !(
        ['wss:', 'https:'].includes(url.protocol) ||
        (['ws:', 'http:'].includes(url.protocol) &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      )
    )
      return null;
  } catch {
    return null;
  }
  return Object.freeze({ ...value }) as VoiceToken;
}
