import { useEffect, useState } from 'react';
import type { CollaborationSession } from '../collaboration-session.js';
import type { AwarenessUserState } from '../types/collab.types.js';

/**
 * Subscribes to remote collaborator presence (active/idle, cursor,
 * language, file) for rendering the participant list / avatars. Pure
 * read model over Awareness; re-renders only when presence changes.
 */
export function usePresence(session: CollaborationSession | null): AwarenessUserState[] {
  const [participants, setParticipants] = useState<AwarenessUserState[]>([]);

  useEffect(() => {
    if (!session) return;
    const update = (states: Map<number, AwarenessUserState>): void =>
      setParticipants([...states.values()]);
    const off = session.awarenessManager.onChange(update);
    update(session.awarenessManager.getRemoteStates());
    return off;
  }, [session]);

  return participants;
}
