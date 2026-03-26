# SuperDoc Demos

Working demos built with [SuperDoc](https://superdoc.dev) — the document engine for the modern web.

Live at [demos.superdoc.dev](https://demos.superdoc.dev)

## Demos

### [`rag/`](./rag) — DocRAG

Ask your documents. Get cited answers. Upload `.docx` files and get AI-powered answers with citations that scroll to the exact paragraph, comment, or tracked change in the source document.

**Stack**: Cloudflare Workers + R2, PostgreSQL + pgvector, React, SuperDoc, Claude, OpenAI embeddings

### [`esign/`](./esign) — eSign

eSignature orchestration demo. Add signature fields to `.docx` and PDF documents, sign with custom signatures, and manage the signing workflow.

**Stack**: React, SuperDoc, @superdoc-dev/esign

### [`template-builder/`](./template-builder) — Template Builder

Document template engine demo. Build reusable templates with dynamic fields and merge data into `.docx` documents.

**Stack**: React, SuperDoc, @superdoc-dev/template-builder

## Running a Demo

Each demo is a standalone app. The general pattern:

```bash
cd <demo>
bun install
bun run dev
```

See each demo's directory for specific setup instructions.

## License

MIT

---

Built by [SuperDoc](https://superdoc.dev)
