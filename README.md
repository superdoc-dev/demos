# SuperDoc Demos

Working demos built with [SuperDoc](https://superdoc.dev) — the document engine for the modern web.

Each demo is a standalone app that showcases a real-world use case: extracting document content for AI, building RAG pipelines, editing with tracked changes, and more.

## Demos

### [`rag/`](./rag) — DocRAG

Ask your documents. Get cited answers. Upload `.docx` files and get AI-powered answers with citations that scroll to the exact paragraph, comment, or tracked change in the source document.

**Stack**: Cloudflare Workers + R2, PostgreSQL + pgvector, React, SuperDoc, Claude, OpenAI embeddings

**What it shows**:
- Extract text, comments, and tracked changes from `.docx` files using the SuperDoc SDK
- Chunk and embed document content for vector search
- RAG pipeline: semantic search + Claude generates answers with citations
- Click a citation to navigate to the source in the SuperDoc viewer
- Cross-document search across multiple files

## Running a Demo

Each demo has its own README with setup instructions. The general pattern:

```bash
cd rag
bun install
cp .env.example .env  # add your API keys
bun run dev
```

## License

MIT

---

Built by [SuperDoc](https://superdoc.dev)
