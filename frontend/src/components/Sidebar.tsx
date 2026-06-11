import { BarChart2, FileText, Handshake, MessageSquare, RefreshCw, Settings, ShieldAlert, Users, X, Zap } from "lucide-react";
import type { Page } from "../App";
import type { DataStatus } from "../types";
import { CHECKPOINT_LABEL, CHECKPOINTS } from "../lib/constants";

const labelFor = (cp: string) => CHECKPOINT_LABEL[cp] ?? (cp === "TODAY" ? "Today's pace" : cp);

type NavItem = {
  page: Page;
  label: string;
  Icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
};

const NAV: NavItem[] = [
  { page: "overview",    label: "Overview",       Icon: BarChart2     },
  { page: "members",     label: "Members",        Icon: Users         },
  { page: "partners",    label: "Partners",       Icon: Handshake     },
  { page: "reflections", label: "Reflections",    Icon: FileText      },
  { page: "slack",       label: "Slack",          Icon: MessageSquare },
  { page: "export",      label: "Export",         Icon: Zap           },
  { page: "critical",    label: "Critical",       Icon: ShieldAlert   },
  { page: "settings",    label: "Settings",       Icon: Settings      },
];

type LoadState = "idle" | "loading" | "loaded" | "error";

interface SidebarProps {
  page: Page;
  onNavigate: (p: Page) => void;
  dataStatus: DataStatus | null;
  loadState: LoadState;
  onReload: () => void;
  onSetCheckpoint: (cp: string) => void;
  checkpointNames?: string[];
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ page, onNavigate, dataStatus, loadState, onReload, onSetCheckpoint, checkpointNames, open = false, onClose }: SidebarProps) {
  const activeCP = dataStatus?.active_checkpoint ?? "CP3";
  const loading = loadState === "loading";
  const checkpoints = checkpointNames && checkpointNames.length > 0 ? checkpointNames : [...CHECKPOINTS];

  return (
    <aside
      aria-label="Primary"
      className={`fixed inset-y-0 left-0 z-40 flex w-52 shrink-0 flex-col transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      style={{ background: "var(--bg-1)", borderRight: "1px solid var(--border-2)" }}
    >
      {/* Wordmark */}
      <div className="flex items-start justify-between px-5 pb-5 pt-6" style={{ borderBottom: "1px solid var(--border-2)" }}>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-faint)" }}>
            Bonner
          </div>
          <div className="mt-1 text-[15px] font-semibold" style={{ color: "var(--text)" }}>
            Hour Dashboard
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close navigation menu"
          className="rounded-md p-1 md:hidden"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Pages">
        {NAV.map(({ page: p, label, Icon }) => {
          const active = page === p;
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              aria-current={active ? "page" : undefined}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-[13px] transition-all duration-100"
              style={{
                background: active ? "var(--hover)" : "transparent",
                color:      active ? "var(--text)" : "var(--text-3)",
                fontWeight: active ? 500 : 400,
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-bright)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
            >
              <Icon
                size={14}
                aria-hidden="true"
                style={{ color: active ? "#3498db" : "currentColor", flexShrink: 0 }}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className="space-y-3 px-4 pb-5 pt-4" style={{ borderTop: "1px solid var(--border-2)" }}>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-faint)" }}>
            Checkpoint
          </label>
          <select
            value={activeCP}
            onChange={(e) => onSetCheckpoint(e.target.value)}
            disabled={loading}
            aria-label="Active checkpoint"
            style={{ background: "var(--bg)", borderColor: "var(--border-2)", fontSize: 13 }}
          >
            {checkpoints.map((cp) => (
                <option key={cp} value={cp}>{labelFor(cp)}</option>
              ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {dataStatus?.loaded ? (
              <span>
                <span style={{ color: "var(--text-3)" }}>{dataStatus.active_member_rows}</span>
                {" active"}
              </span>
            ) : (
              <span>No data</span>
            )}
          </div>
          <button
            onClick={onReload}
            disabled={loading}
            title="Reload data"
            aria-label="Reload data"
            className="rounded-md p-1.5 transition-colors disabled:opacity-30"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text)"; (e.currentTarget as HTMLElement).style.background = "var(--hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

      </div>
    </aside>
  );
}
