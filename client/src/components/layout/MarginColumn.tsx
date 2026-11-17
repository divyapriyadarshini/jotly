import type { ReactNode } from 'react';
import styles from './layout.module.css';

type MarginColumnProps = { children: ReactNode };

export function MarginColumn({ children }: MarginColumnProps) {
  return (
    <aside className={styles.margin} aria-label="Document margin">
      {children}
    </aside>
  );
}
