import type { ReactNode } from 'react';
import styles from './ui.module.css';

type StampProps = { children: ReactNode };

export function Stamp({ children }: StampProps) {
  return <span className={styles.stamp}>{children}</span>;
}
