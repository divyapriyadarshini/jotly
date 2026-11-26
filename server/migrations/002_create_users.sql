-- Every person who opens Jotly is a row here. A guest has no email or password;
-- registering later upgrades the same row, so their documents stay theirs.
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE,
  password_hash TEXT,
  display_name  TEXT        NOT NULL,
  is_guest      BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Emails are always stored in lowercase, so "A@x.com" and "a@x.com" are the same person.
  CONSTRAINT users_email_lowercase CHECK (email = lower(email)),

  -- A guest has neither email nor password; a registered user has both.
  CONSTRAINT users_guest_shape CHECK (
    (is_guest AND email IS NULL AND password_hash IS NULL)
    OR (NOT is_guest AND email IS NOT NULL AND password_hash IS NOT NULL)
  )
);