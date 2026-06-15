import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "../config";

const MAX_TEXTAREA_HEIGHT = 120;

export default function ChatPanel({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setMessages([]);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/chat`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setMessages(data.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })));
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errText =
          typeof data.detail === "string"
            ? data.detail
            : `Request failed (${res.status})`;
        setMessages((prev) => [...prev, { role: "assistant", content: errText }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to server." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 glass-panel border-l border-r-0 rounded-none rounded-l-2xl flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right">
      <div className="p-4 border-b border-white/10 bg-surface/50">
        <h3 className="text-lg font-bold">Copilot Chat</h3>
        <p className="text-xs text-secondary">Ask follow-up questions about the report</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory && (
          <div className="text-sm text-gray-400 text-center animate-pulse">Loading chat...</div>
        )}
        {!isLoadingHistory && messages.length === 0 && (
          <div className="text-sm text-gray-500 text-center">
            Ask a question about this research report.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl p-3 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-white rounded-br-none"
                  : "bg-surface border border-white/5 text-gray-200 rounded-bl-none"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-white/5 rounded-xl rounded-bl-none p-3 text-sm text-gray-400 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-surface/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Shift+Enter for new line)"
            className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-y-auto min-h-[2.5rem]"
            style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
