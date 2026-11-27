import { randomBytes } from 'node:crypto';
import { type LinkAccess, type MemberRole, type Role, resolveRole } from '../access/roles.js';
import {
  createDocument,
  getDocumentWithRole,
  listDocumentsForUser,
  removeMember,
  setMember,
  updateDocument,
} from './documents.js';
import { closePool, pool } from './pool.js';
import { createGuest, createUser } from './users.js';

let failures = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failures += 1;
  }
}

// One row of the "who gets which role" table.
function rule(
  label: string,
  expected: Role | null,
  options: { isOwner?: boolean; memberRole?: MemberRole | null; linkAccess: LinkAccess },
): void {
  const actual = resolveRole({
    userId: options.isOwner ? 'the-owner' : 'someone-else',
    ownerId: 'the-owner',
    linkAccess: options.linkAccess,
    memberRole: options.memberRole ?? null,
  });
  check(`${label} -> ${expected ?? 'no access'}`, actual === expected);
}

async function main(): Promise<void> {
  const createdUserIds: string[] = [];

  try {
    // Part 1: the pure rules.
    rule('the owner', 'owner', { isOwner: true, linkAccess: 'none' });
    rule('a stranger on a private document', null, { linkAccess: 'none' });
    rule('a stranger with a view link', 'viewer', { linkAccess: 'view' });
    rule('a stranger with an edit link', 'editor', { linkAccess: 'edit' });
    rule('a viewer member on a private document', 'viewer', {
      memberRole: 'viewer',
      linkAccess: 'none',
    });
    rule('an editor member on a private document', 'editor', {
      memberRole: 'editor',
      linkAccess: 'none',
    });
    rule('a viewer member when the link allows editing', 'editor', {
      memberRole: 'viewer',
      linkAccess: 'edit',
    });

    // Part 2: the same rules through the real database.
    const suffix = randomBytes(4).toString('hex');
    const alice = await createUser({
      email: `alice-${suffix}@check.test`,
      passwordHash: 'not-a-real-hash',
      displayName: 'Alice',
    });
    const bob = await createGuest('Bob');
    createdUserIds.push(alice.id, bob.id);

    const doc = await createDocument(alice.id, 'Access check');
    check('a new document gets a 12-character id', /^[A-Za-z0-9_-]{12}$/.test(doc.id));
    check('a new document is private by default', doc.linkAccess === 'none');

    check(
      'the creator has the owner role',
      (await getDocumentWithRole(doc.id, alice.id))?.role === 'owner',
    );
    check('a stranger has no role', (await getDocumentWithRole(doc.id, bob.id))?.role === null);
    check(
      'an unknown document id returns null',
      (await getDocumentWithRole('does-not-exist', alice.id)) === null,
    );

    await updateDocument(doc.id, { linkAccess: 'view' });
    check(
      'a view link gives a stranger the viewer role',
      (await getDocumentWithRole(doc.id, bob.id))?.role === 'viewer',
    );

    await setMember(doc.id, bob.id, 'editor');
    check(
      'a member role beats a weaker link',
      (await getDocumentWithRole(doc.id, bob.id))?.role === 'editor',
    );

    const bobsList = await listDocumentsForUser(bob.id);
    check(
      'a shared document appears in the member list with their role',
      bobsList.some((item) => item.id === doc.id && item.role === 'editor'),
    );

    check('removing a member works', (await removeMember(doc.id, bob.id)) === true);
    check(
      'after removal the link role applies again',
      (await getDocumentWithRole(doc.id, bob.id))?.role === 'viewer',
    );

    await updateDocument(doc.id, { title: 'Renamed' });
    const renamed = await getDocumentWithRole(doc.id, alice.id);
    check(
      'renaming changes only the title',
      renamed?.document.title === 'Renamed' && renamed.document.linkAccess === 'view',
    );
  } finally {
    // Deleting the users also deletes their documents and memberships (ON DELETE CASCADE).
    if (createdUserIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
    }
    await closePool();
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error('Access check crashed:', error);
  process.exitCode = 1;
});
