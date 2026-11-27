import { useState } from 'react';
import { type LinkAccess, setLinkAccess } from '../../api/documents';
import styles from './ShareControl.module.css';

const OPTIONS: { value: LinkAccess; label: string }[] = [
  { value: 'none', label: 'Only me' },
  { value: 'view', label: 'Anyone with the link can view' },
  { value: 'edit', label: 'Anyone with the link can edit' },
];

type ShareControlProps = { docId: string; token: string; initial: LinkAccess };

// A minimal sharing control for the owner. Phase 8 replaces it with a proper share dialog.
export function ShareControl({ docId, token, initial }: ShareControlProps) {
  const [value, setValue] = useState<LinkAccess>(initial);
  const [message, setMessage] = useState('');

  async function handleChange(next: LinkAccess) {
    const previous = value;
    setValue(next);
    setMessage('Saving...');
    try {
      await setLinkAccess(token, docId, next);
      setMessage('Saved.');
    } catch {
      setValue(previous); // the server refused, so put the control back
      setMessage('Could not change sharing.');
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('Link copied.');
    } catch {
      setMessage('Copy failed: copy the address bar instead.');
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor="share-access">
        Sharing
      </label>
      <select
        id="share-access"
        className={styles.select}
        value={value}
        onChange={(event) => handleChange(event.target.value as LinkAccess)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button className={styles.button} type="button" onClick={handleCopy}>
        Copy link
      </button>
      <p className={styles.status} role="status">
        {message}
      </p>
    </div>
  );
}
