-- One row per Yjs update. Replaying a document's rows in id order rebuilds the document.
CREATE TABLE document_updates (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doc_id      TEXT        NOT NULL,
  update_data BYTEA       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loading a document means "all rows for this doc_id, oldest first".
CREATE INDEX document_updates_doc_id_idx ON document_updates (doc_id, id);