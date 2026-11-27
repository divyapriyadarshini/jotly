import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';
import type { Doc } from 'yjs';
import type { DocumentInfo } from '../api/documents';
import { renderCaret, renderSelection } from '../collab/caretRender';
import { type CollabUser, getGuestIdentity } from '../collab/identity';
import { type Refusal, type SyncState, useCollabDoc } from '../collab/useCollabDoc';
import { useDocumentTitle } from '../collab/useDocumentTitle';
import { usePresence } from '../collab/usePresence';
import { Notice } from '../components/editor/Notice';
import { PresenceList } from '../components/editor/PresenceList';
import { ShareControl } from '../components/editor/ShareControl';
import { SyncStatus } from '../components/editor/SyncStatus';
import { Toolbar } from '../components/editor/Toolbar';
import { MarginColumn } from '../components/layout/MarginColumn';
import { PageShell } from '../components/layout/PageShell';
import { TextColumn } from '../components/layout/TextColumn';
import { MarginNote } from '../components/ui/MarginNote';
import styles from './editor-page.module.css';
import { useBootstrap } from './useBootstrap';

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
  document: DocumentInfo;
  token: string;
  ydoc: Doc;
  provider: WebsocketProvider;
  user: CollabUser;
  syncState: SyncState;
};

function EditorWorkspace({
  document,
  token,
  ydoc,
  provider,
  user,
  syncState,
}: EditorWorkspaceProps) {
  const canEdit = document.role !== 'viewer';
  const { title, setTitle, failed } = useDocumentTitle(document.id, token, document.title, canEdit);
  const people = usePresence(provider);

  const editor = useEditor({
    // Viewers can read and see who is here, but cannot type. (The server enforces this
    // too: this setting is only for a sensible screen.)
    editable: canEdit,
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
        <p className={styles.docId}>Room: {document.id}</p>
        <PresenceList people={people} />
        {document.role === 'owner' && (
          <ShareControl docId={document.id} token={token} initial={document.linkAccess} />
        )}
        {document.role === 'owner' && (
          <MarginNote>
            Set sharing to "can edit", copy the link, and open it in a second window.
          </MarginNote>
        )}
        {!canEdit && (
          <MarginNote>You have view-only access. You can read along, but not edit.</MarginNote>
        )}
        {failed && <MarginNote>The title could not be saved. Change it to try again.</MarginNote>}
        {editor && <WordCount editor={editor} />}
      </MarginColumn>

      <TextColumn>
        <input
          className={styles.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          readOnly={!canEdit}
          aria-label="Document title"
        />
        {editor && canEdit && <Toolbar editor={editor} />}
        <div className={styles.sheet}>
          <EditorContent editor={editor} />
        </div>
      </TextColumn>
    </PageShell>
  );
}

const REFUSAL_COPY: Record<Refusal, { heading: string; message: string }> = {
  unauthorized: {
    heading: 'Your session has expired',
    message: 'Reload the page to start a new session.',
  },
  forbidden: {
    heading: "You don't have access to this document",
    message: 'Ask the owner to share it with you, or start a new document of your own.',
  },
  'not-found': {
    heading: 'Document not found',
    message: 'This link may be wrong, or the document no longer exists.',
  },
};

type LiveEditorProps = { document: DocumentInfo; token: string };

// Everything that needs a known document and a login token lives here, so the hooks
// below can be called without checking for "not loaded yet".
function LiveEditor({ document, token }: LiveEditorProps) {
  const [user] = useState(getGuestIdentity);
  const { ydoc, provider, state, refusal } = useCollabDoc(document.id, user, token);

  if (refusal) {
    const copy = REFUSAL_COPY[refusal];
    return (
      <Notice
        heading={copy.heading}
        action={
          refusal === 'unauthorized'
            ? { label: 'Reload', onClick: () => window.location.reload() }
            : { label: 'Start a new document', href: '/' }
        }
      >
        {copy.message}
      </Notice>
    );
  }

  // The shared document is created in an effect, so it doesn't exist on the very first render.
  if (!ydoc || !provider) {
    return null;
  }

  // key={ydoc.clientID}: if the Y.Doc is ever replaced, React builds a brand-new editor for it.
  return (
    <EditorWorkspace
      key={ydoc.clientID}
      document={document}
      token={token}
      ydoc={ydoc}
      provider={provider}
      user={user}
      syncState={state}
    />
  );
}

export function EditorPage() {
  const bootstrap = useBootstrap();

  if (bootstrap.status === 'loading') {
    return null;
  }

  if (bootstrap.status === 'error') {
    return (
      <Notice
        heading={bootstrap.heading}
        action={{ label: 'Try again', onClick: () => window.location.reload() }}
      >
        {bootstrap.message}
      </Notice>
    );
  }

  return <LiveEditor document={bootstrap.document} token={bootstrap.token} />;
}
