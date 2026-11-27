import { type Response, Router } from 'express';
import { z } from 'zod';
import { hasAtLeast, type Role } from '../access/roles.js';
import {
  createDocument,
  type DocumentRow,
  getDocumentWithRole,
  listDocumentsForUser,
  listMembers,
  removeMember,
  setMember,
  updateDocument,
} from '../db/documents.js';
import { findUserByEmail } from '../db/users.js';
import { HttpError } from '../errors.js';
import { getAuth, requireAuth } from '../middleware/auth.js';

export const documentsRouter = Router();

// Every route below needs a signed-in person (a guest counts).
documentsRouter.use(requireAuth);

const docIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const userIdSchema = z.string().uuid();
const titleSchema = z.string().trim().min(1, 'Enter a title').max(120);

const createSchema = z.object({ title: titleSchema.optional() });

const updateSchema = z
  .object({
    title: titleSchema.optional(),
    linkAccess: z.enum(['none', 'view', 'edit']).optional(),
  })
  .refine((value) => value.title !== undefined || value.linkAccess !== undefined, {
    message: 'Send a title or a linkAccess to change.',
  });

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['editor', 'viewer']),
});

// What we send to browsers for a document.
function toResponse(document: DocumentRow, role: Role) {
  return {
    id: document.id,
    title: document.title,
    linkAccess: document.linkAccess,
    ownerId: document.ownerId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    role,
  };
}

function currentUserId(res: Response): string {
  const auth = getAuth(res);
  if (!auth) {
    throw new HttpError(401, 'unauthorized', 'You need to sign in to do that.');
  }
  return auth.userId;
}

function invalidInput(error: z.ZodError): HttpError {
  return new HttpError(400, 'invalid_input', error.issues[0]?.message ?? 'Invalid input.');
}

// Find the document and check the caller is allowed to do something that needs `minimum` power.
async function loadDocument(res: Response, rawId: unknown, minimum: Role) {
  const userId = currentUserId(res);

  const id = docIdSchema.safeParse(rawId);
  if (!id.success) {
    throw new HttpError(404, 'not_found', 'Document not found.');
  }

  const found = await getDocumentWithRole(id.data, userId);
  if (!found) {
    throw new HttpError(404, 'not_found', 'Document not found.');
  }

  const role = found.role;
  if (!role || !hasAtLeast(role, minimum)) {
    throw new HttpError(
      403,
      'forbidden',
      "You don't have permission to do that with this document.",
    );
  }
  return { document: found.document, role };
}

// POST /documents: create a new, private document that I own.
documentsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw invalidInput(parsed.error);
  }
  const document = await createDocument(currentUserId(res), parsed.data.title);
  res.status(201).json({ document: toResponse(document, 'owner') });
});

// GET /documents: documents I own or that were shared with me by name.
documentsRouter.get('/', async (_req, res) => {
  const items = await listDocumentsForUser(currentUserId(res));
  res.json({ documents: items.map((item) => toResponse(item, item.role)) });
});

// GET /documents/:id: one document, my role on it, and (for the owner) who it is shared with.
documentsRouter.get('/:id', async (req, res) => {
  const { document, role } = await loadDocument(res, req.params.id, 'viewer');
  const members = role === 'owner' ? await listMembers(document.id) : undefined;
  res.json({ document: toResponse(document, role), members });
});

// PATCH /documents/:id: rename (editors and owner) or change link sharing (owner only).
documentsRouter.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw invalidInput(parsed.error);
  }

  const { document, role } = await loadDocument(res, req.params.id, 'editor');
  if (parsed.data.linkAccess !== undefined && role !== 'owner') {
    throw new HttpError(403, 'forbidden', 'Only the owner can change who has access.');
  }

  const updated = await updateDocument(document.id, parsed.data);
  if (!updated) {
    throw new HttpError(404, 'not_found', 'Document not found.');
  }
  res.json({ document: toResponse(updated, role) });
});

// PUT /documents/:id/members: give a registered person access by email (owner only).
documentsRouter.put('/:id/members', async (req, res) => {
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) {
    throw invalidInput(parsed.error);
  }

  const { document } = await loadDocument(res, req.params.id, 'owner');

  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    throw new HttpError(404, 'no_such_user', 'Nobody has registered with that email yet.');
  }
  if (user.id === document.ownerId) {
    throw new HttpError(400, 'invalid_input', 'The owner already has full access.');
  }

  await setMember(document.id, user.id, parsed.data.role);
  res.json({
    member: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: parsed.data.role,
    },
  });
});

// DELETE /documents/:id/members/:userId: take someone's access away (owner only).
documentsRouter.delete('/:id/members/:userId', async (req, res) => {
  const { document } = await loadDocument(res, req.params.id, 'owner');

  const memberId = userIdSchema.safeParse(req.params.userId);
  if (!memberId.success) {
    throw new HttpError(404, 'not_found', 'That person is not a member.');
  }

  const removed = await removeMember(document.id, memberId.data);
  if (!removed) {
    throw new HttpError(404, 'not_found', 'That person is not a member.');
  }
  res.status(204).end();
});
