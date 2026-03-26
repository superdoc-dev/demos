CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  status TEXT DEFAULT 'ready',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  node_type TEXT NOT NULL,
  content TEXT NOT NULL,
  context_type TEXT DEFAULT 'body',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
