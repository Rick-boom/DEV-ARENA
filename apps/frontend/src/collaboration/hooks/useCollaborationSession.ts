import { useEffect, useRef, useState } from 'react';
import {
  CollaborationSession,
  type CollaborationSessionOptions,
} from '../collaboration-session.js';
import { ConnectionState } from '../types/collab.types.js';

/**
 * React entry point: creates a CollaborationSession for the lifetime of
 * the component and exposes its connection state. The session is held in
 * a ref so re-renders never recreate it; it's torn down on unmount. This
 * hook owns NO editor logic — it just manages the session lifecycle.
 */
export function useCollaborationSession(options: CollaborationSessionOptions | null): {
  session: CollaborationSession | null;
  connectionState: ConnectionState;
} {
  const ref = useRef<CollaborationSession | null>(null);
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED,
  );

  useEffect(() => {
    if (!options) return;
    const s = new CollaborationSession(options);
    ref.current = s;
    setSession(s);
    const off = s.onConnectionChange(setConnectionState);
    void s.start();
    return () => {
      off();
      s.destroy();
      ref.current = null;
      setSession(null);
    };
    // Recreate only when the room identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.roomName, options?.identity.userId]);

  return { session, connectionState };
}
