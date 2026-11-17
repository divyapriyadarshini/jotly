import type { ReactNode } from 'react';
import styles from './ui.module.css';

type MarginNoteProps = { children: ReactNode };

export function MarginNote({ children }: MarginNoteProps) {
  return <p className={styles.note}>{children}</p>;
}
