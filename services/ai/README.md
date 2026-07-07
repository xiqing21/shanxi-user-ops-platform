# Python AI Service

This service owns AI-heavy capabilities for the Shanxi full-user electricity operations platform:

- Text-to-SQL task planning
- DeepSeek structured JSON generation
- Metadata vector retrieval
- Milvus indexing
- Future offline evaluation and batch scenario generation

## Endpoints

- `GET /health`
- `GET /vector/search?q=大工业 晚高峰 突增`
- `POST /vector/reindex`
- `POST /agent/plan`

## Local Test

```bash
pnpm test:ai
```

## Docker

The root Docker Compose stack starts this service with Milvus Standalone:

```bash
pnpm stack:up
```

The default embedding model is a deterministic hash embedding so the demo can run without downloading model weights. For production, replace `HashEmbeddingModel` with BGE-M3 or another enterprise embedding model and keep the `VectorStore` interface unchanged.
