import type React from 'react';
import { useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  useCollaborationSession,
  useMonacoCollaboration,
  usePresence,
  ConnectionState,
  type CollaborationSessionOptions,
} from '../index.js';

/**
 * Reference component wiring the collaboration engine to Monaco. Shows
 * the participant list, connection state, and undo/redo. It's a thin
 * view over the hooks — all the CRDT/transport logic lives in the module.
 */
export interface CollaborativeEditorProps {
  options: CollaborationSessionOptions;
  defaultLanguage?: string;
  height?: string | number;
}

export function CollaborativeEditor({
  options,
  defaultLanguage = 'javascript',
  height = '70vh',
}: CollaborativeEditorProps): React.JSX.Element {
  const { session, connectionState } = useCollaborationSession(options);
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const { undo, redo, canUndo, canRedo } = useMonacoCollaboration(session, editorInstance);
  const participants = usePresence(session);
  const mounted = useRef(false);

  const handleMount: OnMount = (ed) => {
    mounted.current = true;
    setEditorInstance(ed);
  };

  return (
    <div className="collab-editor">
      <div className="collab-toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <ConnectionBadge state={connectionState} />
        <div className="collab-participants" style={{ display: 'flex', gap: 4 }}>
          {participants.map((p) => (
            <span
              key={p.user.userId}
              title={`${p.user.username} · ${p.status}`}
              style={{
                background: p.user.color,
                color: '#fff',
                borderRadius: 12,
                padding: '2px 8px',
                fontSize: 12,
                opacity: p.status === 'idle' ? 0.5 : 1,
              }}
            >
              {p.user.username}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button onClick={redo} disabled={!canRedo}>
            Redo
          </button>
        </div>
      </div>
      <Editor
        height={height}
        defaultLanguage={options.language ?? defaultLanguage}
        onMount={handleMount}
        options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
      />
    </div>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }): React.JSX.Element {
  const color =
    state === ConnectionState.SYNCED
      ? '#3bb273'
      : state === ConnectionState.CONNECTED
        ? '#ffbc42'
        : '#e15554';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {state}
    </span>
  );
}
