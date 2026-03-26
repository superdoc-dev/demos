# Document RAG with SuperDoc

Ask questions across multiple `.docx` files. Get answers with citations that navigate to the exact paragraph, comment, or tracked change in the source document.

## How it Works

1. **Upload** `.docx` files through the UI or CLI
2. **Extract** text, comments, and tracked changes using the [SuperDoc SDK](https://docs.superdoc.dev)
3. **Chunk** each paragraph with its stable node ID, embed with OpenAI
4. **Store** chunks in Cloudflare Vectorize, metadata in D1, files in R2
5. **Query** — user asks a question, relevant chunks are retrieved via vector search
6. **Answer** — Claude generates a response with `[cite:ID]` references
7. **Navigate** — click a citation to scroll to the source in the SuperDoc viewer

## Architecture

```
apps/
  api/              Cloudflare Worker — query, documents, file serving
  web/              React frontend — document viewer + chat sidebar
  ingest/           CLI — extract + embed locally, upload to Worker
  ingest-service/   Docker service — automated extraction for VM deployment
packages/
  shared/           SuperDoc extraction, chunking, embedding client
docs/               Sample .docx files (fictional "Nexus Analytics" project)
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
npx wrangler d1 create rag-demo
# Copy the database_id into wrangler.toml

npx wrangler d1 execute rag-demo --local --file=schema.sql
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

# Ingest sample documents
bun ingest docs/nexus-prd.docx
bun ingest docs/nexus-budget.docx
bun ingest docs/nexus-legal-review.docx
bun ingest docs/nexus-meeting-notes.docx
bun ingest docs/nexus-customer-research.docx
```

Open [http://localhost:3000](http://localhost:3000)

### Sample Questions

Try these across the Nexus Analytics documents:

- "What are the biggest risks to the beta launch?"
- "How much will the NLQ feature cost?"
- "What was decided about HIPAA?"
- "What do customers think about anomaly detection?"
- "Who is HealthBridge and why do they matter?"

## Deploy

### Worker + Frontend

```bash
# Deploy API Worker
cd apps/api
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler d1 execute rag-demo --remote --file=schema.sql
wrangler deploy

# Deploy frontend to Cloudflare Pages
cd ../..
bun run deploy:web
```

### Ingest Service (VM)

For automated ingestion, deploy the Docker service to a VM:

```bash
docker build -f apps/ingest-service/Dockerfile -t rag-ingest .
docker run -d \
  -e API_URL=https://rag-demo-api.<account>.workers.dev \
  -e OPENAI_API_KEY=sk-... \
  -e AUTH_TOKEN=your-shared-secret \
  -p 4000:4000 \
  rag-ingest
```

## License

MIT
