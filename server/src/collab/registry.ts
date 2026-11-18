import { SharedDoc } from './SharedDoc.js';

const docs = new Map<string, SharedDoc>();

// Return the document for this room name, creating it the first time.
export function getDoc(name: string): SharedDoc {
  let doc = docs.get(name);
  if (!doc) {
    doc = new SharedDoc(name);
    docs.set(name, doc);
  }
  return doc;
}

export function getCollabStats(): { documents: number; connections: number } {
  let connections = 0;
  docs.forEach((doc) => {
    connections += doc.conns.size;
  });
  return { documents: docs.size, connections };
}
