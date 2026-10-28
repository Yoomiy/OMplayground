-- The test database is isolated. These two platform tables are only FK/bucket
-- fixtures; transaction/permission behavior below uses real PostgreSQL roles.
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE TABLE public.game_sessions(id UUID PRIMARY KEY);
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN NOT NULL,
  file_size_limit BIGINT, allowed_mime_types TEXT[]);
