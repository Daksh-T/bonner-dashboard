import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { STATUS_COLORS } from "../lib/constants";
import type { DataStatus, Status } from "../types";

const STATUS_OPTIONS: Status[] = ["Red", "Blue", "Yellow", "Green"];

export function SlackPage({ dataStatus }: { dataStatus: DataStatus | null }) {
  const cp = dataStatus?.active_checkpoint ?? "CP3";
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(new Set(["Red", "Blue", "Yellow"]));
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string>("");

  const toggleStatus = (status: Status) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const loadQueue = useCallback(async () => {
    if (!dataStatus?.loaded) return;
    setQueueLoading(true);
    try {
      const rows = await api.getSlackQueue(cp, [...selectedStatuses]);
      setQueue(rows);
    } catch (error) {
      console.error(error);
    } finally {
      setQueueLoading(false);
    }
  }, [cp, dataStatus?.loaded, selectedStatuses]);

  const updateMessage = async (email: string, message: string) => {
    setQueue((prev) => prev.map((row) => (String(row.email) === email ? { ...row, message } : row)));
    try {
      await api.updateSlackMessage(email, message);
    } catch (error) {
      console.error(error);
    }
  };

  const copyQueue = async () => {
    const lines = queue.map((row) => {
      const status = String(row.status ?? "");
      const colorHex = STATUS_COLORS[(status as Status) ?? "Exempt"] ?? "var(--text-muted)";
      const fields = [
        status,
        colorHex,
        String(row.display_name ?? row.email ?? ""),
        String(row.slack_id ?? ""),
        String(row.message ?? "").replace(/\n/g, " ").trim(),
      ];
      return fields.join(";");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyMsg(`Copied ${lines.length} rows.`);
    } catch (error) {
      console.error(error);
      setCopyMsg("Copy failed.");
    }
  };

  const readyRows = queue.filter((row) => row.slack_id && !row.delivery_issue);
  const missingRows = queue.filter((row) => !row.slack_id || row.delivery_issue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>Slack Prep</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Build the send list, review the draft messages, and use the roster file to message people manually later.
        </p>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
          Manual workflow
        </div>
        <div className="space-y-2 text-[12px]" style={{ color: "var(--text-2)" }}>
          <div>1. Build the queue for the statuses you want to message.</div>
          <div>2. Review or edit each message draft here.</div>
          <div>3. Use the Slack IDs from the roster-backed list below when you send messages manually.</div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Message queue — {cp}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((status) => {
              const active = selectedStatuses.has(status);
              const color = STATUS_COLORS[status];
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? `${color}18` : "transparent",
                    color: active ? color : "var(--text-muted)",
                    border: `1px solid ${active ? `${color}40` : "var(--border-3)"}`,
                  }}
                >
                  {status}
                </button>
              );
            })}
            <button
              onClick={loadQueue}
              disabled={queueLoading || !dataStatus?.loaded}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}
            >
              <RefreshCw size={11} className={queueLoading ? "animate-spin" : ""} />
              Build queue
            </button>
          </div>
        </div>

        {!queueLoading && queue.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <SummaryCard label="Ready to send" value={readyRows.length} tone="#27ae60" />
            <SummaryCard label="Missing Slack ID" value={missingRows.length} tone="#e74c3c" />
            <SummaryCard label="Total drafts" value={queue.length} tone="#3498db" />
          </div>
        )}

        {queueLoading && (
          <div className="space-y-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse-soft rounded-lg" style={{ background: "var(--surface-3)", animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        )}

        {!queueLoading && queue.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <button
                onClick={copyQueue}
                className="rounded-lg px-3 py-2 text-[12px] font-medium transition-colors"
                style={{ background: "#3498db", color: "#fff" }}
              >
                Copy all visible rows
              </button>
              <span className="text-[11px]" style={{ color: copyMsg ? "#27ae60" : "var(--text-muted)" }}>
                {copyMsg || "Format: status;color hex;name;slack id;message"}
              </span>
            </div>
            <div className="space-y-1.5">
              {queue.map((row) => (
                <QueueRow
                  key={String(row.email)}
                  row={row}
                  onUpdateMessage={updateMessage}
                />
              ))}
            </div>
          </>
        )}

        {!queueLoading && queue.length === 0 && (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>
            Select statuses and click "Build queue" to see who to message.
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface-3)", border: `1px solid ${tone}30` }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function QueueRow({
  row,
  onUpdateMessage,
}: {
  row: Record<string, unknown>;
  onUpdateMessage: (email: string, msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.message ?? ""));
  const textRef = useRef<HTMLTextAreaElement>(null);
  const color = STATUS_COLORS[(row.status as Status) ?? "Exempt"] ?? "var(--text-muted)";
  const hasIssue = Boolean(row.delivery_issue);

  const save = () => {
    setEditing(false);
    if (draft !== String(row.message ?? "")) onUpdateMessage(String(row.email), draft);
  };

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "var(--surface-3)",
        border: `1px solid ${hasIssue ? "#e74c3c30" : "var(--border)"}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
              {String(row.display_name ?? row.email)}
            </span>
            <span className="rounded-full px-1.5 py-0.5 text-[11px]" style={{ background: `${color}18`, color }}>
              {String(row.status ?? "")}
            </span>
            {hasIssue && (
              <span className="rounded-full px-1.5 py-0.5 text-[11px]" style={{ background: "#e74c3c18", color: "#e74c3c" }}>
                {String(row.delivery_issue)}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span>{String(row.email ?? "")}</span>
            <span>{row.slack_id ? `Slack ID: ${String(row.slack_id)}` : "No Slack ID in roster"}</span>
          </div>

          {editing ? (
            <div className="mt-2">
              <textarea
                ref={textRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                style={{ fontSize: 11, padding: "6px 8px", resize: "vertical" }}
              />
              <div className="mt-1 flex gap-1.5">
                <button
                  onClick={save}
                  className="rounded px-2 py-0.5 text-[11px]"
                  style={{ background: "#3498db18", color: "#3498db" }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(String(row.message ?? ""));
                  }}
                  className="rounded px-2 py-0.5 text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 w-full text-left text-[11px] leading-relaxed"
              style={{ color: "var(--text-3)" }}
            >
              {String(row.message ?? "").slice(0, 180)}
              {String(row.message ?? "").length > 180 ? "…" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
