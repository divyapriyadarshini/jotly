import { type Editor, useEditorState } from '@tiptap/react';
import styles from './toolbar.module.css';

type ToolbarProps = { editor: Editor };

export function Toolbar({ editor }: ToolbarProps) {
  // Subscribe to just these facts about the editor. The component re-renders
  // only when one of them changes, not on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const formatButtons = [
    {
      label: 'Bold',
      text: 'B',
      pressed: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      text: 'I',
      pressed: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
  ];

  const blockButtons = [
    {
      label: 'Heading 1',
      text: 'H1',
      pressed: state.h1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      text: 'H2',
      pressed: state.h2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Bulleted list',
      text: '•',
      pressed: state.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      text: '1.',
      pressed: state.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Quote',
      text: '"',
      pressed: state.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  const renderButton = (b: (typeof formatButtons)[number]) => (
    <button
      key={b.label}
      type="button"
      className={styles.button}
      aria-label={b.label}
      title={b.label}
      aria-pressed={b.pressed}
      onClick={b.run}
    >
      {b.text}
    </button>
  );

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      {formatButtons.map(renderButton)}
      <span className={styles.divider} aria-hidden="true" />
      {blockButtons.map(renderButton)}
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        className={styles.button}
        aria-label="Undo"
        title="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="Redo"
        title="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </button>
    </div>
  );
}
