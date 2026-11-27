import { apiFetch } from './http';

export type Role = 'owner' | 'editor' | 'viewer';
export type LinkAccess = 'none' | 'view' | 'edit';

// What the server sends for a document. `role` is MY role on it.
export type DocumentInfo = {
  id: string;
  title: string;
  linkAccess: LinkAccess;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  role: Role;
};

export async function createDocument(token: string): Promise<DocumentInfo> {
  const { document } = await apiFetch<{ document: DocumentInfo }>('/documents', {
    method: 'POST',
    token,
    body: {},
  });
  return document;
}

export async function fetchDocument(token: string, id: string): Promise<DocumentInfo> {
  const { document } = await apiFetch<{ document: DocumentInfo }>(`/documents/${id}`, { token });
  return document;
}

export async function renameDocument(token: string, id: string, title: string): Promise<void> {
  await apiFetch(`/documents/${id}`, { method: 'PATCH', token, body: { title } });
}

export async function setLinkAccess(
  token: string,
  id: string,
  linkAccess: LinkAccess,
): Promise<void> {
  await apiFetch(`/documents/${id}`, { method: 'PATCH', token, body: { linkAccess } });
}
