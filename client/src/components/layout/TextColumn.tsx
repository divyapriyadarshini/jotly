import type { ReactNode } from 'react';
import styles from './layout.module.css';

type TextColumnProps = { children: ReactNode };

export function TextColumn({ children }: TextColumnProps) {
  return <main className={styles.text}>{children}</main>;
}
