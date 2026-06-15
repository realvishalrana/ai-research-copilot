# Engineering Decisions

## 1. 3 Major Engineering Decisions

### A. SQLite for Persistence
**Decision:** Selected SQLite + SQLAlchemy instead of PostgreSQL for the database layer.
**Reasoning:** To minimize external dependencies and ensure the application is easily runnable in a local environment for evaluation purposes.
**Alternative Considered:** PostgreSQL. While better for production scaling and concurrency, it requires Docker or a local server setup, complicating the assignment review.

### B. DuckDuckGo Search Integration
**Decision:** Used DuckDuckGo Search (via `langchain-community`) to gather company context in the `Researcher` node.
**Reasoning:** DuckDuckGo provides a reliable, rate-limit friendly, and free web search API without requiring the reviewer to inject additional third-party API keys (like Tavily or SerpAPI).
**Alternative Considered:** Web scraping the exact URL. Scraping is fragile due to anti-bot mechanisms and dynamic JS-rendered sites. Searching provides a broader and more reliable summary of the company.

### C. Server-Sent Events (SSE) for Workflow Streaming
**Decision:** Used SSE to stream LangGraph progress updates to the frontend.
**Reasoning:** SSE is lightweight, native to HTTP, and perfect for unidirectional event streaming (backend to frontend).
**Alternative Considered:** WebSockets. While bidirectional, WebSockets are overkill for simply tracking the progress of an AI workflow.

---

## 2. Tradeoffs Made

- **Synchronous LLM Calls in Graph:** The LangGraph nodes are currently executing synchronous OpenAI API calls. While easy to reason about, this ties up the worker threads. Moving to `ChatOpenAI(async_mode=True)` would improve concurrency.
- **In-Memory Queue for SSE:** Active workflow streams are managed via an in-memory `asyncio.Queue` dictionary. This means the SSE streaming is not horizontally scalable. A production version would require Redis Pub/Sub.

---

## 3. Top Technical Debt Items

1. **State Persistence in LangGraph:** Currently, only the final report is saved to SQLite. Intermediate graph states (the checkpoints) are lost. Adding an external checkpointer (like `SqliteSaver`) to LangGraph would allow true pause/resume capabilities.
2. **Error Handling on Stream:** If the user closes the browser mid-stream, the background task still consumes OpenAI tokens to completion. The backend should handle cancellations gracefully.

---

## 4. Biggest Technical Risk

**AI Hallucination & Data Quality:** The report generator heavily relies on the Analyzer and Researcher nodes. If the DuckDuckGo search returns inaccurate information or fails to find the company, the LLM will either hallucinate answers or return a completely empty report, frustrating the user. The Quality Check node mitigates this slightly, but a deeper fact-checking mechanism is required.

---

## 5. What I would improve with 2 additional weeks

1. **Scalable Infrastructure:** Migrate to PostgreSQL, implement Redis for Pub/Sub SSE streaming across multiple instances, and use Celery for background task management.
2. **Human-in-the-Loop (HITL):** Use LangGraph's interrupt capabilities to pause at the `Quality_Check` node and let the user review the draft before generating the final report.
3. **Multi-Source Research:** Expand the researcher node to scrape the provided URL, search LinkedIn, and query Crunchbase via APIs for richer data.
