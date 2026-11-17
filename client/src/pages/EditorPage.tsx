import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState } from 'react';
import { Toolbar } from '../components/editor/Toolbar';
import { MarginColumn } from '../components/layout/MarginColumn';
import { PageShell } from '../components/layout/PageShell';
import { TextColumn } from '../components/layout/TextColumn';
import { MarginNote } from '../components/ui/MarginNote';
import { Stamp } from '../components/ui/Stamp';
import styles from './editor-page.module.css';

const initialContent = `
  <h2>A first page</h2>
  <p>Start typing. Select a word and press <strong>Cmd+B</strong>, or use the toolbar above.</p>
  <p>Soon a second person will be able to open this same page and write beside you.</p>
`;

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

export function EditorPage() {
  const [title, setTitle] = useState('Untitled document');

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: initialContent,
    editorProps: {
      attributes: { 'aria-label': 'Document body' },
    },
  });

  return (
    <PageShell>
      <MarginColumn>
        <p className={styles.wordmark}>Jotly</p>
        <Stamp>Local draft</Stamp>
        <MarginNote>Only you can see this page. Sharing and live cursors come next.</MarginNote>
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
