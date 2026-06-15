import { useEffect, useRef } from "react";
import PinIcon from "./PinIcon";

type SessionContextMenuProps = {
  isPinned: boolean;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onClose: () => void;
};

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-gray-200 hover:bg-white/5"
      }`}
    >
      <span className="w-4 h-4 shrink-0 opacity-80">{icon}</span>
      {label}
    </button>
  );
}

export default function SessionContextMenu({
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  onClose,
}: SessionContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-48 glass-panel py-1.5 px-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
    >
      <MenuItem
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
        }
        label="Rename"
        onClick={() => {
          onClose();
          onRename();
        }}
      />
      <MenuItem
        icon={<PinIcon filled={isPinned} className="w-4 h-4" />}
        label={isPinned ? "Unpin chat" : "Pin chat"}
        onClick={() => {
          onClose();
          onTogglePin();
        }}
      />
      <div className="my-1 border-t border-white/10" />
      <MenuItem
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        }
        label="Delete"
        danger
        onClick={() => {
          onClose();
          onDelete();
        }}
      />
    </div>
  );
}
