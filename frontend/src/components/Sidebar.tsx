import { useEffect, useState } from "react";
import { API_BASE } from "../config";
import ConfirmDialog from "./ConfirmDialog";
import RenameDialog from "./RenameDialog";
import SessionContextMenu from "./SessionContextMenu";
import PinIcon from "./PinIcon";

type Session = {
  id: string;
  company_name: string;
  status: string;
  report_data: string | null;
  is_pinned: boolean;
  created_at: string;
};

function SessionRow({
  session,
  isActive,
  menuOpen,
  onSelect,
  onTogglePin,
  onOpenMenu,
  onCloseMenu,
  onRename,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onOpenMenu: (e: React.MouseEvent) => void;
  onCloseMenu: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const showActions = isActive || session.is_pinned;

  return (
    <div
      className={`group relative flex items-center rounded-lg transition-all ${
        isActive
          ? "bg-surface border border-white/10"
          : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left py-2.5 pl-3 pr-16 text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {session.status === "running" && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
          )}
          {session.status === "failed" && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          )}
          <span className="font-medium text-gray-200 truncate">{session.company_name}</span>
        </div>
      </button>

      <div
        className={`absolute right-1 flex items-center gap-0.5 transition-opacity ${
          showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          title={session.is_pinned ? "Unpin" : "Pin"}
          className={`p-1.5 rounded-full transition-colors ${
            session.is_pinned
              ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
              : "text-gray-400 hover:text-gray-200 hover:bg-white/10"
          }`}
          aria-label={session.is_pinned ? "Unpin session" : "Pin session"}
          aria-pressed={session.is_pinned}
        >
          <PinIcon filled={session.is_pinned} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={onOpenMenu}
            title="More options"
            className={`p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors ${
              menuOpen ? "bg-white/10 text-gray-200" : ""
            }`}
            aria-label="Session options"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM14 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
            </svg>
          </button>
          {menuOpen && (
            <SessionContextMenu
              isPinned={session.is_pinned}
              onRename={onRename}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onClose={onCloseMenu}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  onSelectSession,
  onSessionDeleted,
  onSessionRenamed,
  currentSessionId,
  refreshKey,
}: {
  onSelectSession: (id: string) => void;
  onSessionDeleted?: (id: string) => void;
  onSessionRenamed?: (id: string, name: string) => void;
  currentSessionId: string | null;
  refreshKey?: number;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [renameTarget, setRenameTarget] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const patchSession = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(typeof err.detail === "string" ? err.detail : "Request failed");
    }
    return res.json();
  };

  const handleTogglePin = async (session: Session) => {
    setActionError(null);
    try {
      await patchSession(session.id, { is_pinned: !session.is_pinned });
      await loadSessions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update pin");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete session");
      onSessionDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
      await loadSessions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmRename = async (name: string) => {
    if (!renameTarget) return;
    setIsRenaming(true);
    setActionError(null);
    try {
      await patchSession(renameTarget.id, { company_name: name });
      onSessionRenamed?.(renameTarget.id, name);
      setRenameTarget(null);
      await loadSessions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to rename session");
    } finally {
      setIsRenaming(false);
    }
  };

  const pinned = sessions.filter((s) => s.is_pinned);
  const recent = sessions.filter((s) => !s.is_pinned);

  const renderList = (list: Session[]) =>
    list.map((s) => (
      <SessionRow
        key={s.id}
        session={s}
        isActive={currentSessionId === s.id}
        menuOpen={openMenuId === s.id}
        onSelect={() => {
          setOpenMenuId(null);
          onSelectSession(s.id);
        }}
        onTogglePin={() => handleTogglePin(s)}
        onOpenMenu={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === s.id ? null : s.id);
        }}
        onCloseMenu={() => setOpenMenuId(null)}
        onRename={() => setRenameTarget(s)}
        onDelete={() => setDeleteTarget(s)}
      />
    ));

  return (
    <>
      <div className="w-64 bg-surface/50 border-r border-white/5 flex flex-col h-screen overflow-hidden shrink-0">
        <div className="p-4 border-b border-white/5">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Zylabs AI
          </h1>
          <p className="text-xs text-secondary mt-1">Research Copilot</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => onSelectSession("")}
            className="w-full bg-primary/10 hover:bg-primary/20 text-blue-400 border border-blue-500/30 rounded-lg py-2 px-4 text-sm font-medium transition-colors mb-3"
          >
            + New Session
          </button>

          {sessions.length === 0 && (
            <p className="text-xs text-gray-500 px-2 py-2">No sessions yet.</p>
          )}

          {pinned.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider px-2 mb-1.5">
                Pinned
              </div>
              <div className="space-y-0.5">{renderList(pinned)}</div>
            </div>
          )}

          {recent.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-secondary uppercase tracking-wider px-2 mb-1.5">
                {pinned.length > 0 ? "Recent" : "Recent Sessions"}
              </div>
              <div className="space-y-0.5">{renderList(recent)}</div>
            </div>
          )}

          {actionError && (
            <div className="mx-1 mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              {actionError}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete session?"
        message={
          deleteTarget
            ? `"${deleteTarget.company_name}" and its report will be permanently removed.`
            : ""
        }
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />

      <RenameDialog
        open={!!renameTarget}
        initialName={renameTarget?.company_name ?? ""}
        isLoading={isRenaming}
        onSave={handleConfirmRename}
        onCancel={() => {
          if (!isRenaming) setRenameTarget(null);
        }}
      />
    </>
  );
}
