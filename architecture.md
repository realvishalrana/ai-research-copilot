# Architecture

## System Diagram

```mermaid
graph TD
    Client[React Frontend] --> |REST POST /sessions| API[FastAPI Backend]
    Client --> |SSE GET /sessions/{id}/stream| API
    
    API --> DB[(SQLite Database)]
    API --> |Background Task| LangGraph[LangGraph Workflow]
    
    subgraph LangGraph State Machine
        P[Planner Node] --> R[Researcher Node]
        R --> A[Analyzer Node]
        A --> Q[Quality Check Node]
        Q --> |Is Complete?| G[Report Generator]
        Q --> |Needs Revision| A
    end
    
    LangGraph --> |DuckDuckGo| Web(Internet)
    LangGraph --> |ChatOpenAI| LLM(OpenAI API)
    
    G --> |Save Report| DB
```

## Description
- **Frontend**: A React application that manages UI states and consumes backend REST APIs and SSE streams to provide real-time updates of the workflow.
- **Backend**: FastAPI acts as the orchestrator. Sessions are stored in a local SQLite database for quick setup and persistency.
- **AI Workflow**: LangGraph is used to manage the state machine of the research tasks. It ensures that planning, data gathering, analysis, and generation are decoupled, allowing for conditional loops (Quality Check) to retry if data is insufficient.
