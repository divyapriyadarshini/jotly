import { randomBytes } from 'node:crypto';
import { type LinkAccess, type MemberRole, type Role, resolveRole } from '../access/roles.js';
import { pool } from './pool.js';

export type DocumentRow = {
  id: string;
  ownerId: string;
  title: string;
  linkAccess: LinkAccess;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentListItem = DocumentRow & { role: Role };

export type MemberItem = {
  userId: string;
  email: string | null;
  displayName: string;
  role: MemberRole;
};

// Renames snake_case database columns to camelCase fields.
const COLUMNS = `id, owner_id AS "ownerId", title, link_access AS "linkAccess",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function createDocument(ownerId: string, title?: string): Promise<DocumentRow> {
  // 9 random bytes -> 12 URL-safe characters (72 bits: not guessable).
  const id = randomBytes(9).toString('base64url');
  const { rows } = await pool.query<DocumentRow>(
    `INSERT INTO documents (id, owner_id, title)
     VALUES ($1, $2, COALESCE($3::text, 'Untitled document'))
     RETURNING ${COLUMNS}`,
    [id, ownerId, title ?? null],
  );
  return rows[0] as DocumentRow;
}

// The document plus THIS person's role on it. Returns null if the document does not exist.
// A null role means it exists but this person has no access.
export async function getDocumentWithRole(
  docId: string,
  userId: string,
): Promise<{ document: DocumentRow; role: Role | null } | null> {
  const [documentResult, memberResult] = await Promise.all([
    pool.query<DocumentRow>(`SELECT ${COLUMNS} FROM documents WHERE id = $1`, [docId]),
    pool.query<{ role: MemberRole }>(
      'SELECT role FROM document_members WHERE document_id = $1 AND user_id = $2',
      [docId, userId],
    ),
  ]);

  const document = documentResult.rows[0];
  if (!document) {
    return null;
  }

  const role = resolveRole({
    userId,
    ownerId: document.ownerId,
    linkAccess: document.linkAccess,
    memberRole: memberResult.rows[0]?.role ?? null,
  });
  return { document, role };
}

// Documents this person owns or was added to by name, newest activity first.
export async function listDocumentsForUser(userId: string): Promise<DocumentListItem[]> {
  const { rows } = await pool.query<DocumentListItem>(
    `SELECT d.id, d.owner_id AS "ownerId", d.title, d.link_access AS "linkAccess",
            d.created_at AS "createdAt", d.updated_at AS "updatedAt",
            CASE WHEN d.owner_id = $1 THEN 'owner' ELSE m.role END AS role
     FROM documents d
     LEFT JOIN document_members m ON m.document_id = d.id AND m.user_id = $1
     WHERE d.owner_id = $1 OR m.user_id IS NOT NULL
     ORDER BY d.updated_at DESC
     LIMIT 200`,
    [userId],
  );
  return rows;
}

// Change the title and/or link setting. A field left undefined stays as it was.
export async function updateDocument(
  docId: string,
  changes: { title?: string; linkAccess?: LinkAccess },
): Promise<DocumentRow | null> {
  const { rows } = await pool.query<DocumentRow>(
    `UPDATE documents
     SET title = COALESCE($2::text, title),
         link_access = COALESCE($3::text, link_access),
         updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [docId, changes.title ?? null, changes.linkAccess ?? null],
  );
  return rows[0] ?? null;
}

// Add someone, or change their role if they are already a member.
export async function setMember(docId: string, userId: string, role: MemberRole): Promise<void> {
  await pool.query(
    `INSERT INTO document_members (document_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [docId, userId, role],
  );
}

// Returns true if someone was actually removed.
export async function removeMember(docId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM document_members WHERE document_id = $1 AND user_id = $2',
    [docId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listMembers(docId: string): Promise<MemberItem[]> {
  const { rows } = await pool.query<MemberItem>(
    `SELECT u.id AS "userId", u.email, u.display_name AS "displayName", m.role
     FROM document_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.document_id = $1
     ORDER BY m.created_at`,
    [docId],
  );
  return rows;
}
