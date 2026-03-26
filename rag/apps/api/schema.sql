CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT PRIMARY KEY,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_hash TEXT,
  status TEXT DEFAULT 'ready',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  node_type TEXT NOT NULL,
  content TEXT NOT NULL,
  context_type TEXT DEFAULT 'body',
  metadata TEXT DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
