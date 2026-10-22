# examples/kb — fictional n-knowledge-base

Made-up general notes for demo mode, in the current vault layout:

`cs/`, `backend/{network,storage,architecture}`, `ai/llm/`, `math/`, `tools/`, `templates/`, plus `README.md` and `AGENTS.md`.

The vault has no map-of-content folder. The mindset note lives in `examples/life/learn/mind/`.

Links are `kb://<path>` relative to this vault: real filenames, no `.md`, no `%20`. A path with spaces is written `[label](<kb://backend/network/gRPC/gRPC Args>)`. Parentheses stay in the name (`kb://backend/architecture/限流方案(参考)`). A folder link ends with `/` (`kb://backend/` opens `index.md`; `kb://math/` has no index, so it opens the filtered list). A frontmatter id still resolves when the path does not match a file (`kb://cs/hash-table`).
