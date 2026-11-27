// Who may do what with a document. This file has NO database code on purpose: it is a pure
// function of plain values, so it is easy to test and the REST API and the WebSocket
// check can share it.

export type Role = 'owner' | 'editor' | 'viewer';
export type MemberRole = 'editor' | 'viewer';
export type LinkAccess = 'none' | 'view' | 'edit';

// Bigger number = more power.
const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function hasAtLeast(role: Role | null, minimum: Role): boolean {
  return role !== null && RANK[role] >= RANK[minimum];
}

// Can this role change the document's text? (Used for read-only viewers in 7C.)
export function canWrite(role: Role | null): boolean {
  return hasAtLeast(role, 'editor');
}

export function resolveRole(input: {
  userId: string;
  ownerId: string;
  linkAccess: LinkAccess;
  memberRole: MemberRole | null;
}): Role | null {
  if (input.userId === input.ownerId) {
    return 'owner';
  }

  // Collect every way this person could have been given access...
  const granted: Role[] = [];
  if (input.memberRole) {
    granted.push(input.memberRole);
  }
  if (input.linkAccess === 'edit') {
    granted.push('editor');
  }
  if (input.linkAccess === 'view') {
    granted.push('viewer');
  }

  // ...and keep the strongest one. No grants at all means no access (deny by default).
  let best: Role | null = null;
  for (const role of granted) {
    if (best === null || RANK[role] > RANK[best]) {
      best = role;
    }
  }
  return best;
}
