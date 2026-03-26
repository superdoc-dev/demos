# DocRAG

Ask your documents. Get cited answers.

Upload `.docx` files, ask questions in natural language, and get answers with citations that navigate to the exact paragraph, comment, or tracked change in the source document. Powered by [SuperDoc](https://superdoc.dev).

## How it Works

1. **Upload** `.docx` files through the UI
2. **Extract** text, comments, and tracked changes using the [SuperDoc SDK](https://docs.superdoc.dev)
3. **Chunk** each paragraph with its stable node ID, embed with OpenAI
4. **Store** chunks in Cloudflare Vectorize, metadata in D1, files in R2
5. **Query** — ask a question, relevant chunks are retrieved via vector search
6. **Answer** — Claude generates a response with `[cite:ID]` references
7. **Navigate** — click a citation to scroll to the source in the SuperDoc viewer

## Architecture

```
apps/
  api/              Cloudflare Worker — query, documents, file serving
  web/              React frontend — document viewer + chat sidebar
  ingest-service/   Docker service — automated extraction for VM deployment
packages/
  shared/           SuperDoc extraction, chunking, embedding client
docs/               Sample .docx files
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed automatically)
- Cloudflare account (free tier works)
- OpenAI API key (for embeddings)
- Anthropic API key (for Claude)

### Setup

```bash
bun install

# Create Cloudflare resources
cd apps/api
npx wrangler d1 create docrag
# Copy the database_id into wrangler.toml

npx wrangler d1 execute docrag --local --file=schema.sql
npx wrangler vectorize create rag-chunks --dimensions=1536 --metric=cosine

# Add secrets for local dev
cat > .dev.vars << EOF
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EOF
cd ../..
```

### Run

```bash
# Terminal 1: API (Cloudflare Worker via wrangler dev)
bun run dev:api

# Terminal 2: Frontend (Vite)
bun run dev:web
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

### Worker + Frontend

```bash
# Deploy API Worker
cd apps/api
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler d1 execute docrag --remote --file=schema.sql
wrangler deploy

# Deploy frontend to Cloudflare Pages
cd ../..
bun run deploy:web
```

### Ingest Service (VM)

For automated ingestion, deploy the Docker service to a VM:

```bash
docker build -f apps/ingest-service/Dockerfile -t docrag-ingest .
docker run -d \
  -e API_URL=https://docrag-api.<account>.workers.dev \
  -e OPENAI_API_KEY=sk-... \
  -e AUTH_TOKEN=your-shared-secret \
  -p 4000:4000 \
  docrag-ingest
```

## License

MIT

---

Built by [SuperDoc](https://superdoc.dev)
