import json
import logging
import re
from typing import TypedDict, List, Optional, Dict, Any
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_community.tools import DuckDuckGoSearchRun
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Basic resiliency implementation similar to classifier.ts
circuit_open_until = 0
consecutive_failures = 0

def extract_json(text: str):
    """Parse JSON from LLM output, including markdown-fenced responses."""
    if not text or not text.strip():
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence:
        cleaned = fence.group(1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    for opener, closer in (("{", "}"), ("[", "]")):
        start = cleaned.find(opener)
        end = cleaned.rfind(closer)
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])

    raise ValueError(f"Could not parse JSON from AI response: {cleaned[:200]}")

def is_ai_available():
    import time
    global circuit_open_until
    return time.time() > circuit_open_until

def record_ai_success():
    global consecutive_failures, circuit_open_until
    consecutive_failures = 0
    circuit_open_until = 0

def record_ai_failure(err=None):
    import time
    global consecutive_failures, circuit_open_until
    consecutive_failures += 1
    # Check if rate limit
    if hasattr(err, "status_code") and err.status_code == 429:
        pass
    if consecutive_failures >= 3:
        circuit_open_until = time.time() + 5 * 60

def call_llm(messages, response_format=None):
    if not is_ai_available():
        raise Exception("AI temporarily unavailable")
    
    # Optional base_url setup if using a proxy like Antigravity
    base_url = os.environ.get("OPENAI_BASE_URL", None)
    model = os.environ.get("OPENAI_MODEL", "gpt-3.5-turbo") # Fallback to 3.5 turbo if not specified
    llm = ChatOpenAI(
        model=model,
        temperature=0.2,
        base_url=base_url,
        max_retries=2
    )
    if response_format:
        llm = llm.with_structured_output(response_format)
        
    try:
        res = llm.invoke(messages)
        record_ai_success()
        return res
    except Exception as e:
        record_ai_failure(e)
        logger.error(f"LLM Call Failed: {e}")
        raise e

class GraphState(TypedDict):
    session_id: str
    company_name: str
    website: Optional[str]
    objective: str
    search_queries: List[str]
    research_data: str
    draft_analysis: str
    report_data: Optional[Dict[str, Any]]
    retries: int
    current_step: str
    error: Optional[str]

def planner_node(state: GraphState):
    logger.info(f"[{state['session_id']}] Planner started")
    prompt = f"""
    You are an AI Research Planner. Your objective is to formulate 3 specific search queries
    to gather information about a company for a business/sales meeting.
    Company Name: {state['company_name']}
    Website: {state['website'] or 'Unknown'}
    Meeting Objective: {state['objective']}
    
    Respond ONLY with a JSON array of 3 string search queries.
    """
    try:
        res = call_llm([("system", prompt)])
        queries = extract_json(res.content)
        if not isinstance(queries, list):
            raise ValueError("Planner must return a JSON array of search queries")
        return {"search_queries": queries, "current_step": "researching", "error": None}
    except Exception as e:
        return {"error": str(e), "current_step": "error"}

def researcher_node(state: GraphState):
    logger.info(f"[{state['session_id']}] Researcher started")
    if state.get("error"):
        return {"current_step": "error"}

    queries = state.get("search_queries") or []
    if not queries:
        return {"error": "No search queries from planner", "current_step": "error"}

    try:
        search = DuckDuckGoSearchRun()
        all_results = []
        for q in queries:
            try:
                res = search.invoke(q)
                all_results.append(f"Query: {q}\nResult: {res}")
            except Exception as e:
                all_results.append(f"Query: {q}\nResult: Error {str(e)}")

        research_data = "\n\n".join(all_results)
        return {"research_data": research_data, "current_step": "analyzing", "error": None}
    except Exception as e:
        return {"error": str(e), "current_step": "error"}

def analyzer_node(state: GraphState):
    logger.info(f"[{state['session_id']}] Analyzer started")
    if state.get("error"):
        return {"current_step": "error"}
    prompt = f"""
    You are a Business Research Analyst. Analyze the following gathered research and extract key information.
    Company: {state['company_name']}
    Objective: {state['objective']}
    
    Research Data:
    {state['research_data']}
    
    Structure your analysis covering: Company Overview, Products/Services, Target Customers, Business Signals, Risks/Challenges, Unknowns, and Sources.
    """
    try:
        res = call_llm([("system", prompt)])
        return {"draft_analysis": res.content, "current_step": "quality_check", "error": None}
    except Exception as e:
        return {"error": str(e), "current_step": "error"}

def quality_check_node(state: GraphState):
    logger.info(f"[{state['session_id']}] Quality Check started")
    prompt = f"""
    Evaluate the following draft analysis for completeness based on standard briefing requirements.
    Draft: {state['draft_analysis']}
    
    Does it clearly identify Risks, Unknowns, and Sources? 
    Respond with JSON: {{"is_complete": true/false, "feedback": "reasoning..."}}
    """
    try:
        res = call_llm([("system", prompt)])
        evaluation = extract_json(res.content)

        if evaluation.get("is_complete", False):
            return {"current_step": "generating_report", "error": None}
        else:
            return {"current_step": "needs_revision", "error": None}
    except Exception as e:
        # Default to passing if quality check fails parsing
        return {"current_step": "generating_report"}

def format_field_value(value: Any) -> str:
    if value is None:
        return "Unknown"
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(format_field_value(item) for item in value)
    if isinstance(value, dict):
        return "\n".join(
            f"{key.replace('_', ' ').title()}: {format_field_value(val)}"
            for key, val in value.items()
        )
    return str(value)

def normalize_list_field(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        items: List[str] = []
        for item in value:
            if isinstance(item, str):
                items.append(item)
            else:
                items.append(format_field_value(item))
        return items
    return [format_field_value(value)]

def normalize_report_data(raw: Dict[str, Any]) -> Dict[str, Any]:
    string_fields = [
        "company_overview",
        "products_and_services",
        "target_customers",
        "business_signals",
        "risks_and_challenges",
        "suggested_outreach_strategy",
        "unknowns",
    ]
    return {
        **{field: format_field_value(raw.get(field)) for field in string_fields},
        "suggested_discovery_questions": normalize_list_field(
            raw.get("suggested_discovery_questions")
        ),
        "sources": normalize_list_field(raw.get("sources")),
    }

def report_generator_node(state: GraphState):
    logger.info(f"[{state['session_id']}] Report Generator started")
    prompt = f"""
    Generate the final structured JSON briefing report based on this analysis:
    {state['draft_analysis']}
    
    Required JSON structure EXACTLY:
    {{
        "company_overview": "string",
        "products_and_services": "string",
        "target_customers": "string",
        "business_signals": "string",
        "risks_and_challenges": "string",
        "suggested_discovery_questions": ["q1", "q2"],
        "suggested_outreach_strategy": "string",
        "unknowns": "string",
        "sources": ["source1"]
    }}
    Ensure all fields exist. Use "Not found" or "Unknown" if data is missing.
    Respond with JSON only, no markdown or explanation.
    """
    if state.get("error"):
        return {"current_step": "error"}

    try:
        res = call_llm([("system", prompt)])
        report_data = normalize_report_data(extract_json(res.content))
        return {"report_data": report_data, "current_step": "completed", "error": None}
    except Exception as e:
        return {"error": str(e), "current_step": "error"}

def route_after_planner(state: GraphState):
    if state.get("error") or state.get("current_step") == "error":
        return "error"
    return "researcher"

def route_after_researcher(state: GraphState):
    if state.get("error") or state.get("current_step") == "error":
        return "error"
    return "analyzer"

def route_after_analyzer(state: GraphState):
    if state.get("error") or state.get("current_step") == "error":
        return "error"
    return "quality_check"

def route_quality(state: GraphState):
    if state.get("error"):
        return "error"
    step = state.get("current_step")
    if step == "needs_revision":
        retries = state.get("retries", 0)
        if retries >= 2:
            return "report_generator"
        state["retries"] = retries + 1
        return "analyzer"
    return "report_generator"

# Build Graph
builder = StateGraph(GraphState)
builder.add_node("planner", planner_node)
builder.add_node("researcher", researcher_node)
builder.add_node("analyzer", analyzer_node)
builder.add_node("quality_check", quality_check_node)
builder.add_node("report_generator", report_generator_node)

builder.set_entry_point("planner")
builder.add_conditional_edges("planner", route_after_planner, {
    "researcher": "researcher",
    "error": END,
})
builder.add_conditional_edges("researcher", route_after_researcher, {
    "analyzer": "analyzer",
    "error": END,
})
builder.add_conditional_edges("analyzer", route_after_analyzer, {
    "quality_check": "quality_check",
    "error": END,
})
builder.add_conditional_edges("quality_check", route_quality, {
    "analyzer": "analyzer",
    "report_generator": "report_generator",
    "error": END
})
builder.add_edge("report_generator", END)

workflow = builder.compile()
