import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronRight, Search } from "lucide-react";
import { api } from "../api/client";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { useAsyncData } from "../hooks/useDashboardData";
import { STATUS_COLORS } from "../lib/constants";
import type { DataStatus, Status } from "../types";

type FollowUpRow = {
  email: string;
  display_name: string;
  class_label: string;
  status: Status;
  hours: number;
  approved_hours: number;
  required: number;
  pct: number;
  avg_week: number;
  recent_avg: number;
  recent_weeks: number;
  recent_service_weeks: number;
  rhythm_flag: boolean;
  rhythm_reason: string;
  post_break_reentry_flag: boolean;
  post_break_reentry_reason: string;
  requires_follow_up: boolean;
  follow_up_reasons: string[];
  conversation_prompts: string[];
  pace_needed: number;
  pace_gap: number;
  pace_label: "Behind pace" | "Near pace" | "On pace" | "Goal reached";
  pending_hours: number;
  final_required: number;
  final_still_needed: number;
  weeks_remaining_to_cp4: number;
  projected_final_hours: number;
  projected_final_gap: number;
  outreach_sent: boolean;
  sent_date: string | null;
  notes: string;
  snoozed_until: string | null;
  snooze_reason: string;
  snooze_active: boolean;
};

type QueueView = "attention" | "snoozed" | "all";

export function CriticalPage({
  onOpenProfile,
  dataStatus,
}: {
  onOpenProfile: (email: string) => void;
  dataStatus: DataStatus | null;
}) {
  const activeCheckpoint = dataStatus?.active_checkpoint ?? "CP3";
  const followUp = useAsyncData(() => api.getFollowUp(), [activeCheckpoint], true);
  const [view, setView] = useState<QueueView>("attention");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());
  const [planningRow, setPlanningRow] = useState<FollowUpRow | null>(null);
  const [snoozeDraft, setSnoozeDraft] = useState<{ row: FollowUpRow; until: string; reason: string } | null>(null);

  const rows = (followUp.data ?? []) as unknown as FollowUpRow[];
  const attention = rows.filter((row) => row.requires_follow_up && !row.snooze_active);
  const snoozed = rows.filter((row) => row.snooze_active);
  const all = rows;

  const visibleRows = useMemo(() => {
    const source = view === "attention" ? attention : view === "snoozed" ? snoozed : all;
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((row) => `${row.display_name} ${row.email} ${row.class_label}`.toLowerCase().includes(needle));
  }, [all, attention, query, snoozed, view]);

  const patchRow = (email: string, patch: Partial<FollowUpRow>) => {
    followUp.setData(rows.map((row) => (row.email === email ? { ...row, ...patch } : row)) as unknown as Array<Record<string, unknown>>);
  };

  const toggleOutreach = async (row: FollowUpRow) => {
    const next = !row.outreach_sent;
    patchRow(row.email, { outreach_sent: next });
    setSaving((current) => new Set(current).add(row.email));
    try {
      await api.updateSupport(row.email, next, row.notes);
    } catch {
      patchRow(row.email, { outreach_sent: row.outreach_sent });
    } finally {
      setSaving((current) => { const nextSet = new Set(current); nextSet.delete(row.email); return nextSet; });
    }
  };

  const saveNotes = async (row: FollowUpRow, notes: string) => {
    patchRow(row.email, { notes });
    setSaving((current) => new Set(current).add(row.email));
    try {
      await api.updateSupport(row.email, row.outreach_sent, notes);
    } finally {
      setSaving((current) => { const next = new Set(current); next.delete(row.email); return next; });
    }
  };

  const openSnooze = (row: FollowUpRow, days: number) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    setSnoozeDraft({ row, until: until.toISOString().slice(0, 10), reason: row.snooze_reason || row.notes || "" });
  };

  const saveSnooze = async () => {
    if (!snoozeDraft?.until) return;
    const { row, until, reason } = snoozeDraft;
    setSaving((current) => new Set(current).add(row.email));
    try {
      await api.updateFollowUpSnooze(row.email, until, reason);
      patchRow(row.email, { snoozed_until: until, snooze_reason: reason, snooze_active: true });
      setSnoozeDraft(null);
    } finally {
      setSaving((current) => { const next = new Set(current); next.delete(row.email); return next; });
    }
  };

  const clearSnooze = async (row: FollowUpRow) => {
    setSaving((current) => new Set(current).add(row.email));
    try {
      await api.updateFollowUpSnooze(row.email, null, "");
      patchRow(row.email, { snoozed_until: null, snooze_reason: "", snooze_active: false });
    } finally {
      setSaving((current) => { const next = new Set(current); next.delete(row.email); return next; });
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <div>
          <h1 className="text-balance text-[22px] font-semibold" style={{ color: "var(--text)" }}>Who needs my attention now, and why?</h1>
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Follow-up queue views">
          <QueueTab active={view === "attention"} onClick={() => setView("attention")} label="Needs attention" count={attention.length} />
          <QueueTab active={view === "snoozed"} onClick={() => setView("snoozed")} label="Snoozed" count={snoozed.length} />
          <QueueTab active={view === "all"} onClick={() => setView("all")} label="All students" count={all.length} />
        </div>
        <label className="relative block w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a student" aria-label="Find a student" style={{ paddingLeft: 34 }} />
        </label>
      </div>

      {followUp.loading ? (
        <QueueSkeleton />
      ) : visibleRows.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-[14px] font-medium" style={{ color: "var(--text-2)" }}>
            {view === "attention" ? "The follow-up queue is clear." : view === "snoozed" ? "No students are snoozed." : "No students match this search."}
          </div>
          {view === "attention" && <div className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Snoozed students return here on their review date.</div>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {visibleRows.map((row) => {
            const isSaving = saving.has(row.email);
            const notesExpanded = notesOpen.has(row.email);
            const reasons = row.follow_up_reasons?.length
              ? row.follow_up_reasons
              : ["Checkpoint pace and recent service rhythm look steady"];
            return (
              <article key={row.email} className="px-4 py-4 sm:px-5" style={{ borderBottom: "1px solid var(--border)", opacity: isSaving ? 0.6 : 1, transitionProperty: "opacity", transitionDuration: "150ms" }}>
                <div className="grid gap-4 lg:grid-cols-[minmax(190px,0.9fr)_minmax(260px,1.45fr)_250px_auto] lg:items-center">
                  <div className="min-w-0">
                    <button onClick={() => onOpenProfile(row.email)} className="block max-w-full truncate text-left text-[14px] font-semibold hover:underline" style={{ color: "var(--text)" }}>
                      {row.display_name}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `${STATUS_COLORS[row.status]}18`, color: STATUS_COLORS[row.status] }}>{row.status}</span>
                      <span>{row.class_label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{Number(row.hours).toFixed(1)} / {Number(row.required).toFixed(1)} hrs</span>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: row.snooze_active ? "#9b59b6" : row.requires_follow_up ? "#f39c12" : "#27ae60" }}>
                      {row.snooze_active ? `Returns ${formatDate(row.snoozed_until)}` : row.requires_follow_up ? "Checkpoint follow-up" : "Steady context"}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {reasons.slice(0, 2).map((reason) => <li key={reason} className="text-pretty text-[12px] leading-5" style={{ color: "var(--text-2)" }}>{reason}</li>)}
                    </ul>
                    {row.snooze_active && row.snooze_reason && <div className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{row.snooze_reason}</div>}
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-y py-3 lg:border-x lg:border-y-0 lg:px-4 lg:py-0" style={{ borderColor: "var(--border)" }}>
                    <QueueMetric label="Approved" value={`${Number(row.approved_hours).toFixed(1)}h`} />
                    <QueueMetric label="Recent avg" value={`${Number(row.recent_avg).toFixed(1)}h`} tone={row.rhythm_flag ? "#f39c12" : undefined} />
                    <QueueMetric label="Need / wk" value={row.pace_needed > 0 ? `${Number(row.pace_needed).toFixed(1)}h` : "—"} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button onClick={() => setPlanningRow(row)} className="flex min-h-10 items-center gap-1 rounded-lg px-3 text-[11px] font-medium" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
                      Planning details <ChevronRight size={13} />
                    </button>
                    <button onClick={() => toggleOutreach(row)} disabled={isSaving} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[11px] font-medium" style={{ background: row.outreach_sent ? "#27ae6015" : "var(--surface-3)", color: row.outreach_sent ? "#27ae60" : "var(--text-3)" }}>
                      <span className="flex h-4 w-4 items-center justify-center rounded" style={{ border: `1px solid ${row.outreach_sent ? "#27ae60" : "var(--text-faint)"}` }}>{row.outreach_sent && <Check size={11} />}</span>
                      Reached out
                    </button>
                    <select
                      aria-label={`Snooze ${row.display_name}`}
                      value=""
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "clear") clearSnooze(row);
                        else if (value) openSnooze(row, Number(value));
                      }}
                      className="min-h-10"
                      style={{ width: 122, fontSize: 11 }}
                    >
                      <option value="">{row.snooze_active ? "Change review" : "Snooze"}</option>
                      <option value="7">1 week</option>
                      <option value="14">2 weeks</option>
                      <option value="30">1 month</option>
                      <option value="1">Choose date…</option>
                      {row.snooze_active && <option value="clear">Return now</option>}
                    </select>
                    <button
                      onClick={() => setNotesOpen((current) => { const next = new Set(current); next.has(row.email) ? next.delete(row.email) : next.add(row.email); return next; })}
                      className="min-h-10 rounded-lg px-3 text-[11px]"
                      style={{ color: row.notes ? "var(--text-2)" : "var(--text-muted)" }}
                    >
                      {row.notes ? "Edit note" : "Add note"}
                    </button>
                  </div>
                </div>
                {notesExpanded && <NotesEditor value={row.notes} onSave={(notes) => saveNotes(row, notes)} onClose={() => setNotesOpen((current) => { const next = new Set(current); next.delete(row.email); return next; })} />}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={planningRow != null} onOpenChange={(open) => { if (!open) setPlanningRow(null); }}>
        <DialogContent>{planningRow && <PlanningDetails row={planningRow} />}</DialogContent>
      </Dialog>

      <Dialog open={snoozeDraft != null} onOpenChange={(open) => { if (!open) setSnoozeDraft(null); }}>
        <DialogContent>
          {snoozeDraft && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Set a review date for {snoozeDraft.row.display_name}</h2>
                <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>They will leave the active queue and return automatically on this date.</p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-muted)" }}>Review date</span>
                <input type="date" value={snoozeDraft.until} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setSnoozeDraft({ ...snoozeDraft, until: event.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-muted)" }}>Context</span>
                <textarea rows={3} value={snoozeDraft.reason} onChange={(event) => setSnoozeDraft({ ...snoozeDraft, reason: event.target.value })} placeholder="Unlogged hours, site schedule, wellness hours…" />
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setSnoozeDraft(null)} className="min-h-10 rounded-lg px-4 text-[12px]" style={{ color: "var(--text-3)" }}>Cancel</button>
                <button onClick={saveSnooze} className="min-h-10 rounded-lg px-4 text-[12px] font-medium" style={{ background: "#9b59b6", color: "#fff" }}>Snooze until review</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QueueTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className="min-h-10 rounded-lg px-3 text-[12px] font-medium" style={{ background: active ? "var(--surface-3)" : "transparent", color: active ? "var(--text)" : "var(--text-muted)" }}>
      {label} <span className="ml-1 tabular-nums" style={{ color: active ? "#3498db" : "var(--text-faint)" }}>{count}</span>
    </button>
  );
}

function QueueMetric({ label, value, tone = "var(--text)" }: { label: string; value: string; tone?: string }) {
  return <div><div className="min-h-7 text-[11px] uppercase tracking-[0.09em]" style={{ color: "var(--text-muted)" }}>{label}</div><div className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: tone }}>{value}</div></div>;
}

function NotesEditor({ value, onSave, onClose }: { value: string; onSave: (notes: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end" style={{ borderColor: "var(--border)" }}>
      <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder="Follow-up context" style={{ resize: "vertical" }} />
      <div className="flex gap-2">
        <button onClick={() => { onSave(draft); onClose(); }} className="min-h-10 rounded-lg px-4 text-[12px] font-medium" style={{ background: "#3498db18", color: "#3498db" }}>Save note</button>
        <button onClick={onClose} className="min-h-10 rounded-lg px-3 text-[12px]" style={{ color: "var(--text-muted)" }}>Cancel</button>
      </div>
    </div>
  );
}

function PlanningDetails({ row }: { row: FollowUpRow }) {
  const statusColor = STATUS_COLORS[row.status];
  const projectedTone = row.projected_final_gap > 0 ? "#f39c12" : "#27ae60";
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>{row.display_name}</h2>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>{row.class_label} · planning details</p>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `${statusColor}18`, color: statusColor }}>{row.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4" style={{ borderColor: "var(--border)" }}>
        <QueueMetric label="Approved hours" value={Number(row.approved_hours).toFixed(1)} />
        <QueueMetric label="Avg / eligible wk" value={Number(row.avg_week).toFixed(1)} />
        <QueueMetric label="Recent 3-wk avg" value={Number(row.recent_avg).toFixed(1)} tone={row.rhythm_flag ? "#f39c12" : undefined} />
        <QueueMetric label="Need / remaining wk" value={row.pace_needed > 0 ? Number(row.pace_needed).toFixed(1) : "—"} />
      </div>
      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-muted)" }}>Projected finish</div>
          <div className="mt-2 text-[28px] font-bold tabular-nums" style={{ color: projectedTone }}>{Number(row.projected_final_hours).toFixed(1)} hrs</div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>Using {row.weeks_remaining_to_cp4} remaining eligible service weeks · final goal {Number(row.final_required).toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-muted)" }}>Why this surfaced</div>
          <ul className="mt-2 space-y-2">
            {(row.follow_up_reasons?.length ? row.follow_up_reasons : ["Checkpoint pace and recent service rhythm look steady"]).map((reason) => (
              <li key={reason} className="text-pretty text-[13px] leading-5" style={{ color: "var(--text-2)" }}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>
      {row.conversation_prompts?.length > 0 && (
        <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-muted)" }}>Conversation prompts</div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>Questions to verify the visible signals—not conclusions about the student.</p>
          <ul className="mt-3 space-y-2">
            {row.conversation_prompts.slice(0, 3).map((prompt) => (
              <li key={prompt} className="text-pretty text-[13px] leading-5" style={{ color: "var(--text-2)" }}>{prompt}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QueueSkeleton() {
  return <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>{[0, 1, 2, 3, 4].map((index) => <div key={index} className="h-24 animate-pulse-soft" style={{ background: index % 2 ? "var(--row-alt)" : "var(--surface)", borderBottom: "1px solid var(--border)", animationDelay: `${index * 50}ms` }} />)}</div>;
}

function formatDate(value: string | null) {
  if (!value) return "later";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
