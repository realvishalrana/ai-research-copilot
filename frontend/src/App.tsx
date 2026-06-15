import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import SessionForm from "./components/SessionForm";
import WorkflowProgress from "./components/WorkflowProgress";
import ReportViewer from "./components/ReportViewer";
import ChatPanel from "./components/ChatPanel";
import { API_BASE } from "./config";

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  const fetchSession = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionData(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setSessionData(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setSessionData(data);
        if (data.status !== "running") {
          clearInterval(interval);
        }
      } catch (e) {
        console.error(e);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  const handleCreateSession = async (data: any) => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const payload = {
        ...data,
        website: data.website?.trim()
          ? data.website.trim().startsWith("http")
            ? data.website.trim()
            : `https://${data.website.trim()}`
          : undefined,
      };
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.detail
          ? Array.isArray(err.detail)
            ? err.detail.map((d: any) => d.msg).join(", ")
            : String(err.detail)
          : `Request failed (${res.status})`;
        setCreateError(msg);
        return;
      }
      const session = await res.json();
      setSessionId(session.id);
      setSidebarRefresh((n) => n + 1);
    } catch (e) {
      console.error(e);
      setCreateError("Could not reach the backend. Is it running on port 8000?");
    } finally {
      setIsCreating(false);
    }
  };

  const showChat = sessionData?.status === "completed" && sessionData?.report_data;
  const isIncomplete =
    sessionData?.status === "failed" ||
    (sessionData?.status === "completed" && !sessionData?.report_data);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-text">
      <Sidebar
        onSelectSession={(id) => {
          setCreateError(null);
          setSessionId(id || null);
        }}
        onSessionDeleted={(id) => {
          if (sessionId === id) {
            setSessionId(null);
            setSessionData(null);
          }
          setSidebarRefresh((n) => n + 1);
        }}
        onSessionRenamed={(id, name) => {
          if (sessionId === id) {
            setSessionData((prev: any) => (prev ? { ...prev, company_name: name } : prev));
          }
          setSidebarRefresh((n) => n + 1);
        }}
        currentSessionId={sessionId}
        refreshKey={sidebarRefresh}
      />
      
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <div className={`p-8 pb-32 transition-all duration-300 ${showChat ? "mr-96" : ""}`}>
          {!sessionId ? (
            <div>
              {createError && (
                <div className="max-w-2xl mx-auto mt-8 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  {createError}
                </div>
              )}
              <SessionForm key={sidebarRefresh} onSubmit={handleCreateSession} isLoading={isCreating} />
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-8 gap-4">
                <div className="min-w-0">
                  <h2 className="text-3xl font-bold">{sessionData?.company_name}</h2>
                  <p className="text-secondary mt-1">{sessionData?.objective}</p>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-medium border glass-panel shrink-0">
                  {sessionData?.status === "running" ? (
                    <span className="text-blue-400 animate-pulse">Running</span>
                  ) : sessionData?.status === "completed" && sessionData?.report_data ? (
                    <span className="text-green-400">Completed</span>
                  ) : isIncomplete ? (
                    <span className="text-amber-400">Incomplete</span>
                  ) : (
                    <span className="text-red-400">{sessionData?.status}</span>
                  )}
                </div>
              </div>

              {sessionData?.status === "running" && (
                <WorkflowProgress 
                  sessionId={sessionId} 
                  onComplete={() => fetchSession(sessionId)} 
                />
              )}

              {isIncomplete && (
                <div className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
                  This session has no report. Click <strong>+ New Session</strong> in the sidebar and try again.
                </div>
              )}

              {sessionData?.status === "completed" && sessionData?.report_data && (
                <ReportViewer data={JSON.parse(sessionData.report_data)} />
              )}
            </div>
          )}
        </div>
        
        {showChat && <ChatPanel key={sessionId} sessionId={sessionId} />}
      </main>
    </div>
  );
}
