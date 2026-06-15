from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SessionCreate(BaseModel):
    company_name: str
    website: Optional[str] = None
    objective: str

class SessionResponse(BaseModel):
    id: str
    company_name: str
    website: Optional[str] = None
    objective: str
    status: str
    report_data: Optional[str] = None
    is_pinned: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SessionUpdate(BaseModel):
    company_name: Optional[str] = None
    is_pinned: Optional[bool] = None

class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReportData(BaseModel):
    company_overview: str
    products_and_services: str
    target_customers: str
    business_signals: str
    risks_and_challenges: str
    suggested_discovery_questions: List[str]
    suggested_outreach_strategy: str
    unknowns: str
    sources: List[str]
