import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';
import type { Doc } from 'yjs';
import { renderCaret, renderSelection } from '../collab/caretRender';
import { type CollabUser, getGuestIdentity } from '../collab/identity';
import { type SyncState, useCollabDoc } from '../collab/useCollabDoc';
import { usePresence } from '../collab/usePresence';
import { PresenceList } from '../components/editor/PresenceList';
import { SyncStatus } from '../components/editor/SyncStatus';
import { Toolbar } from '../components/editor/Toolbar';
import { MarginColumn } from '../components/layout/MarginColumn';
import { PageShell } from '../components/layout/PageShell';
import { TextColumn } from '../components/layout/TextColumn';
import { MarginNote } from '../components/ui/MarginNote';
import styles from './editor-page.module.css';

const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Phase 8 replaces this with real shareable links. For now: /?doc=notes
function getDocIdFromUrl(): string {
  const id = new URLSearchParams(window.location.search).get('doc');
  return id && DOC_ID_PATTERN.test(id) ? id : 'demo';
}

function WordCount({ editor }: { editor: Editor }) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => e.getText().split(/\s+/).filter(Boolean).length,
  });

  return (
    <p className={styles.count}>
      {words} {words === 1 ? 'word' : 'words'}
    </p>
  );
}

type EditorWorkspaceProps = {
  docId: string;
  ydoc: Doc;
  provider: WebsocketProvider;
  user: CollabUser;
  syncState: SyncState;
};

function EditorWorkspace({ docId, ydoc, provider, user, syncState }: EditorWorkspaceProps) {
  const [title, setTitle] = useState('Untitled document');
  const people = usePresence(provider);

  const editor = useEditor({
    extensions: [
      // Collaboration brings its own undo/redo, so StarterKit's must be off.
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, undoRedo: false }),
      // The shared document is the single source of truth. No `content` option here.
      Collaboration.configure({ document: ydoc }),
      // Draws other people's carets and selections, using awareness from the provider.
      CollaborationCaret.configure({
        provider,
        user,
        render: renderCaret,
        selectionRender: renderSelection,
      }),
    ],
    editorProps: {
      attributes: { 'aria-label': 'Document body' },
    },
  });

  return (
    <PageShell>
      <MarginColumn>
        <p className={styles.wordmark}>Jotly</p>
        <SyncStatus state={syncState} />
        <p className={styles.docId}>Room: {docId}</p>
        <PresenceList people={people} />
        <MarginNote>Open this page in a second tab. What you type appears in both.</MarginNote>
        {editor && <WordCount editor={editor} />}
      </MarginColumn>

      <TextColumn>
        <input
          className={styles.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Document title"
        />
        {editor && <Toolbar editor={editor} />}
        <div className={styles.sheet}>
          <EditorContent editor={editor} />
        </div>
      </TextColumn>
    </PageShell>
  );
}

export function EditorPage() {
  const [docId] = useState(getDocIdFromUrl);
  const [user] = useState(getGuestIdentity);
  const { ydoc, provider, state } = useCollabDoc(docId, user);

  // The shared document is created in an effect, so it doesn't exist on the very first render.
  if (!ydoc || !provider) {
    return null;
  }

  // key={ydoc.clientID}: if the Y.Doc is ever replaced, React builds a brand-new editor for it.
  return (
    <EditorWorkspace
      key={ydoc.clientID}
      docId={docId}
      ydoc={ydoc}
      provider={provider}
      user={user}
      syncState={state}
    />
  );
}
