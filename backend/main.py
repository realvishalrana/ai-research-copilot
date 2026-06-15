import uuid
import json
import asyncio
import logging
import queue
import threading
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from sse_starlette.sse import EventSourceResponse

import models
import schemas
from database import engine, get_db
from workflow import workflow, call_llm

models.Base.metadata.create_all(bind=engine)

def migrate_db():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN is_pinned BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            conn.rollback()

migrate_db()

app = FastAPI(title="Zylabs AI Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_workflows = {}
logger = logging.getLogger(__name__)

def normalize_website(website: str | None) -> str | None:
    if not website:
        return None
    website = website.strip()
    if not website:
        return None
    if not website.startswith(("http://", "https://")):
        website = f"https://{website}"
    return website

@app.post("/api/sessions", response_model=schemas.SessionResponse)
def create_session(session_in: schemas.SessionCreate, db: Session = Depends(get_db)):
    session_id = str(uuid.uuid4())
    website = normalize_website(session_in.website)
    db_session = models.SessionRecord(
        id=session_id,
        company_name=session_in.company_name,
        website=website,
        objective=session_in.objective,
        status="running"
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    thread = threading.Thread(
        target=run_workflow,
        args=(session_id, session_in.company_name, website or "", session_in.objective),
        daemon=True,
    )
    thread.start()
    return db_session

def run_workflow(session_id: str, company_name: str, website: str, objective: str):
    initial_state = {
        "session_id": session_id,
        "company_name": company_name,
        "website": website,
        "objective": objective,
        "search_queries": [],
        "research_data": "",
        "draft_analysis": "",
        "report_data": None,
        "retries": 0,
        "current_step": "planner",
        "error": None
    }

    event_queue: queue.Queue = queue.Queue()
    active_workflows[session_id] = event_queue
    final_status = "failed"

    try:
        final_state = None
        for output in workflow.stream(initial_state):
            for key, value in output.items():
                step = value.get("current_step", key)
                event_queue.put({"step": step, "status": "in_progress"})
                final_state = value

        db = next(get_db())
        session_record = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
        if session_record:
            has_report = bool(final_state and final_state.get("report_data"))
            has_error = bool(final_state and final_state.get("error"))
            if has_error or not has_report:
                session_record.status = "failed"
                final_status = "failed"
                logger.error(
                    "Workflow failed for session %s: %s",
                    session_id,
                    final_state.get("error") if final_state else "no report generated",
                )
            else:
                session_record.status = "completed"
                session_record.report_data = json.dumps(final_state["report_data"])
                final_status = "completed"
            db.commit()

        event_queue.put({"step": "done", "status": final_status})
    except Exception as e:
        logger.exception("Workflow crashed for session %s", session_id)
        db = next(get_db())
        session_record = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
        if session_record:
            session_record.status = "failed"
            db.commit()
        event_queue.put({"step": "error", "status": "failed", "error": str(e)})
    finally:
        active_workflows.pop(session_id, None)

@app.get("/api/sessions/{session_id}/stream")
async def stream_workflow(session_id: str, request: Request):
    async def event_generator():
        event_queue = active_workflows.get(session_id)
        if not event_queue:
            db = next(get_db())
            session_record = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
            if session_record and session_record.status in ["completed", "failed"]:
                yield {"event": "message", "data": json.dumps({"step": "done", "status": session_record.status})}
                return
            yield {"event": "error", "data": "Workflow not found"}
            return

        while True:
            if await request.is_disconnected():
                break
            try:
                msg = await asyncio.to_thread(event_queue.get, True, 30)
            except queue.Empty:
                db = next(get_db())
                session_record = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
                if session_record and session_record.status in ["completed", "failed"]:
                    yield {"event": "message", "data": json.dumps({"step": "done", "status": session_record.status})}
                break
            yield {"event": "message", "data": json.dumps(msg)}
            if msg.get("status") in ["completed", "failed"]:
                break
    return EventSourceResponse(event_generator())

@app.get("/api/sessions", response_model=list[schemas.SessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    return (
        db.query(models.SessionRecord)
        .order_by(models.SessionRecord.is_pinned.desc(), models.SessionRecord.created_at.desc())
        .all()
    )

@app.get("/api/sessions/{session_id}", response_model=schemas.SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.patch("/api/sessions/{session_id}", response_model=schemas.SessionResponse)
def update_session(
    session_id: str,
    update: schemas.SessionUpdate,
    db: Session = Depends(get_db),
):
    session = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if update.company_name is not None:
        name = update.company_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Company name cannot be empty")
        session.company_name = name
    if update.is_pinned is not None:
        session.is_pinned = update.is_pinned

    db.commit()
    db.refresh(session)
    return session

@app.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    active_workflows.pop(session_id, None)
    db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).delete()
    db.delete(session)
    db.commit()

@app.get("/api/sessions/{session_id}/chat", response_model=list[schemas.ChatMessageResponse])
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.id.asc())
        .all()
    )

@app.post("/api/sessions/{session_id}/chat", response_model=schemas.ChatMessageResponse)
def chat_with_session(session_id: str, chat_in: schemas.ChatMessageCreate, db: Session = Depends(get_db)):
    session = db.query(models.SessionRecord).filter(models.SessionRecord.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.report_data:
        raise HTTPException(status_code=400, detail="No report available for this session")

    history = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.id.asc())
        .all()
    )

    system_prompt = (
        "You are a sales research copilot. Answer ONLY using the report below. "
        "If the report lacks the answer, say what is unknown. Be concise and specific.\n\n"
        f"REPORT:\n{session.report_data}"
    )
    messages = [("system", system_prompt)]
    for msg in history:
        messages.append((msg.role, msg.content))
    messages.append(("user", chat_in.content))

    try:
        res = call_llm(messages)
        ai_content = res.content
    except Exception as e:
        logger.error("Chat LLM failed for session %s: %s", session_id, e)
        ai_content = "Sorry, I encountered an error while processing your request."

    user_msg = models.ChatMessage(session_id=session_id, role="user", content=chat_in.content)
    ai_msg = models.ChatMessage(session_id=session_id, role="assistant", content=ai_content)
    db.add(user_msg)
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)
    return ai_msg

if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
