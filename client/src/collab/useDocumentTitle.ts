import { useEffect, useRef, useState } from 'react';
import { renameDocument } from '../api/documents';

// Holds the title and saves it to the server 0.6 seconds after you stop typing.
// Viewers (canEdit = false) never save.
export function useDocumentTitle(
  docId: string,
  token: string,
  initialTitle: string,
  canEdit: boolean,
) {
  const [title, setTitle] = useState(initialTitle);
  const [failed, setFailed] = useState(false);
  // The last title the server is known to have, so we do not re-save the same thing.
  const lastSaved = useRef(initialTitle);

  useEffect(() => {
    const trimmed = title.trim();
    if (!canEdit || trimmed === '' || trimmed === lastSaved.current) {
      return;
    }

    // Each keystroke restarts the timer: only the final pause triggers a save.
    const timer = setTimeout(() => {
      renameDocument(token, docId, trimmed)
        .then(() => {
          lastSaved.current = trimmed;
          setFailed(false);
        })
        .catch(() => setFailed(true));
    }, 600);

    return () => clearTimeout(timer);
  }, [title, canEdit, docId, token]);

  return { title, setTitle, failed };
}
