import type { ReactNode } from 'react';
import styles from './ui.module.css';

type StampProps = {
  children: ReactNode;
  // "alert" paints the stamp in the accent colour (used for "not synced" states).
  tone?: 'default' | 'alert';
};

export function Stamp({ children, tone = 'default' }: StampProps) {
  const className = tone === 'alert' ? `${styles.stamp} ${styles.alert}` : styles.stamp;
  return <span className={className}>{children}</span>;
}
