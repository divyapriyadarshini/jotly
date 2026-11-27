-- One row per document. The document's text itself lives in document_updates (Phase 6);
-- this table holds who owns it, what it is called and who may open it.
CREATE TABLE documents (
  id          TEXT        PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'Untitled document',
  -- "Anyone with the link": none = nobody, view = read only, edit = read and write.
  link_access TEXT        NOT NULL DEFAULT 'none' CHECK (link_access IN ('none', 'view', 'edit')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "My documents, most recently changed first."
CREATE INDEX documents_owner_idx ON documents (owner_id, updated_at DESC);

-- Specific people who were given access by name (the owner is not listed here).
CREATE TABLE document_members (
  document_id TEXT        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);

-- "Which documents were shared with me?"
CREATE INDEX document_members_user_idx ON document_members (user_id);