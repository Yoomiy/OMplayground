/** Hand state is independent of LiveKit media and server-owned role metadata. */
export function receiveClassroomHandMessage(
  hands: Map<string, boolean>,
  message: { type?: unknown; handRaised?: unknown },
  senderIdentity: string | undefined,
  localIdentity: string,
  reply: (message: { type: "HAND_RAISE"; handRaised: boolean }, destination: string) => void
): boolean {
  if (!senderIdentity) return false;
  if (message.type === "HAND_STATE_REQUEST") {
    reply({ type: "HAND_RAISE", handRaised: hands.get(localIdentity) === true }, senderIdentity);
    return false;
  }
  if (message.type !== "HAND_RAISE" || typeof message.handRaised !== "boolean") return false;
  hands.set(senderIdentity, message.handRaised);
  return true;
}

/** A room connection can precede peers being ready to receive the first request. */
export function requestClassroomHandStates(
  send: () => Promise<void>,
  reportFailure: (error: unknown) => void
): () => void {
  const request = () => { void send().catch(reportFailure); };
  request();
  const retry = setTimeout(request, 1000);
  return () => clearTimeout(retry);
}
