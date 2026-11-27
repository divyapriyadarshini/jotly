import type { ReactNode } from 'react';
import { MarginColumn } from '../layout/MarginColumn';
import { PageShell } from '../layout/PageShell';
import { TextColumn } from '../layout/TextColumn';
import styles from './Notice.module.css';

type NoticeAction = { label: string; href?: string; onClick?: () => void };

type NoticeProps = {
  heading: string;
  children: ReactNode;
  action?: NoticeAction;
};

// A full-page message in the Manuscript layout: used for errors and refusals.
export function Notice({ heading, children, action }: NoticeProps) {
  return (
    <PageShell>
      <MarginColumn>
        <p className={styles.wordmark}>Jotly</p>
      </MarginColumn>
      <TextColumn>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.body}>{children}</p>
        {action &&
          (action.href ? (
            <a className={styles.action} href={action.href}>
              {action.label}
            </a>
          ) : (
            <button className={styles.action} type="button" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
      </TextColumn>
    </PageShell>
  );
}
