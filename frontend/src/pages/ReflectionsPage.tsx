import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api } from "../api/client";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { useAsyncData } from "../hooks/useDashboardData";
import type { DataStatus, ReflectionMember } from "../types";

type ImpactExample = Record<string, unknown> & { bucket?: "Blank" | "Filled" };

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#e74c3c",
  High: "#f39c12",
  Moderate: "#3498db",
  Low: "#27ae60",
};

const SEVERITY_ORDER = ["Critical", "High", "Moderate", "Low"];

// Plain-language definitions that mirror the backend severity() thresholds in
// backend/app/data/reflections.py. Keep these in sync with that function.
const SEVERITY_DEFINITIONS: Record<string, string> = {
  Critical: "Every impact is blank — 2 or more impacts, none with a reflection.",
  High: "Mostly blank — at least 3 blank reflections covering 75%+ of their impacts.",
  Moderate: "Frequently blank — at least 2 blank reflections covering 40%+ of their impacts.",
  Low: "Occasional gaps — at least one blank reflection, below the moderate threshold.",
};

export function ReflectionsPage({ dataStatus }: { dataStatus: DataStatus | null }) {
  const loaded = !!dataStatus?.loaded;
  const activeCheckpoint = dataStatus?.active_checkpoint ?? "CP3";
  const reflections = useAsyncData(() => api.getReflections(), [loaded, activeCheckpoint], loaded);

  const [filter, setFilter] = useState("all");
  const [activeMember, setActiveMember] = useState<ReflectionMember | null>(null);
  const [activeImpact, setActiveImpact] = useState<ImpactExample | null>(null);

  const data = reflections.data;
  const members = data?.members ?? [];
  const summary = (data?.summary ?? {}) as Record<string, number>;
  const totalFlagged = Number(summary.users_with_any_blank ?? members.length);

  const filtered = filter === "all" ? members : members.filter((member) => member.severity === filter);

  const modalImpacts = useMemo(() => {
    if (!activeMember) return { blank: [] as ImpactExample[], filled: [] as ImpactExample[] };
    const decorate = (items: ReflectionMember["blank_examples"], bucket: "Blank" | "Filled") =>
      items
        .map((item) => ({ ...item, bucket }))
        .sort((a, b) => impactDate(b).localeCompare(impactDate(a)));
    return {
      blank: decorate(activeMember.blank_examples, "Blank"),
      filled: decorate(activeMember.filled_examples, "Filled"),
    };
  }, [activeMember]);

  useEffect(() => {
    const first = modalImpacts.blank[0] ?? modalImpacts.filled[0] ?? null;
    setActiveImpact(first);
  }, [modalImpacts]);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>Reflections</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Review blank reflection patterns across full impact history
        </p>
      </div>

      {reflections.loading && <ReflectionsSkeleton />}

      {!reflections.loading && data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Flagged members"
              value={String(totalFlagged)}
              sublabel={totalFlagged ? "With at least one blank reflection" : "No one flagged"}
              accent="var(--text-2)"
            />
            {SEVERITY_ORDER.map((severity) => {
              const count = severityCount(summary, severity);
              return (
                <StatCard
                  key={severity}
                  label={severity}
                  value={String(count)}
                  sublabel={totalFlagged ? `${Math.round((count / totalFlagged) * 100)}% of flagged` : "0% of flagged"}
                  accent={SEVERITY_COLORS[severity]}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg p-1 w-fit" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} role="tablist" aria-label="Filter by severity">
            {["all", ...SEVERITY_ORDER].map((value) => {
              const active = filter === value;
              const color = value === "all" ? "var(--text-3)" : SEVERITY_COLORS[value];
              const label = value === "all" ? `All (${members.length})` : `${value} (${severityCount(summary, value)})`;
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  role="tab"
                  aria-selected={active}
                  title={value === "all" ? "Show every flagged member" : SEVERITY_DEFINITIONS[value]}
                  className="rounded-md px-3 py-1.5 text-[11px] font-medium transition-all"
                  style={{
                    background: active ? `${color}18` : "transparent",
                    color: active ? color : "var(--text-muted)",
                    border: active ? `1px solid ${color}30` : "1px solid transparent",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {filter !== "all" && SEVERITY_DEFINITIONS[filter] && (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[12px]"
              style={{ background: `${SEVERITY_COLORS[filter]}0d`, border: `1px solid ${SEVERITY_COLORS[filter]}30`, color: "var(--text-2)" }}
            >
              <span className="mt-px shrink-0 font-semibold" style={{ color: SEVERITY_COLORS[filter] }}>{filter}</span>
              <span>{SEVERITY_DEFINITIONS[filter]}</span>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((member) => (
              <ReflectionMemberRow key={member.email} member={member} onOpen={() => setActiveMember(member)} />
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
                No members at this severity
              </div>
            )}
          </div>

        </>
      )}

      <Dialog
        label="Member reflection detail"
        open={activeMember != null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveMember(null);
            setActiveImpact(null);
          }
        }}
      >
        <DialogContent>
          <div className="animate-fade-up">
            {activeMember && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>{activeMember.name}</h2>
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: `${SEVERITY_COLORS[activeMember.severity]}18`, color: SEVERITY_COLORS[activeMember.severity] }}
                      >
                        {activeMember.severity}
                      </span>
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>
                        {activeMember.pattern}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeMember.partners.map((partner) => (
                        <span key={partner} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                          {partner}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Blank" value={String(activeMember.blank_reflections)} accent={SEVERITY_COLORS[activeMember.severity]} />
                    <MiniStat label="Filled" value={String(activeMember.filled_reflections)} />
                    <MiniStat label="Total" value={String(activeMember.total_impacts)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                  <div className="space-y-4">
                    <ImpactListSection
                      title={`Blank Reflections (${modalImpacts.blank.length})`}
                      impacts={modalImpacts.blank}
                      emptyLabel="No blank reflections"
                      selectedImpact={activeImpact}
                      onSelect={setActiveImpact}
                    />
                    <ImpactListSection
                      title={`Filled Reflections (${modalImpacts.filled.length})`}
                      impacts={modalImpacts.filled}
                      emptyLabel="No filled reflections"
                      selectedImpact={activeImpact}
                      onSelect={setActiveImpact}
                    />
                  </div>

                  <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                      Impact Detail
                    </div>
                    {activeImpact ? (
                      <div className="space-y-4">
                        <div>
                          <div className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                            {String(activeImpact.event_name || activeImpact.group || "Impact")}
                          </div>
                          <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>
                            {String(activeImpact.group || activeImpact.organizer || "No partner listed")}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <MiniStat label="Bucket" value={String(activeImpact.bucket ?? "—")} accent={activeImpact.bucket === "Blank" ? "#e74c3c" : "#27ae60"} />
                          <MiniStat label="Hours" value={`${Number(activeImpact.hours ?? 0).toFixed(1)} hrs`} />
                          <MiniStat label="Date" value={impactDate(activeImpact) || "—"} />
                          <MiniStat label="Organizer" value={String(activeImpact.organizer || "—")} />
                        </div>

                        <div className="rounded-xl p-4" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                            Reflection / Review
                          </div>
                          <div className="whitespace-pre-wrap text-[13px] leading-6" style={{ color: "var(--text-bright)" }}>
                            {String(activeImpact.reflection || "[Blank]")}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Select an impact to inspect its details.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReflectionMemberRow({ member, onOpen }: { member: ReflectionMember; onOpen: () => void }) {
  const color = SEVERITY_COLORS[member.severity] ?? "var(--text-muted)";
  const filledPct = member.total_impacts ? Math.round((member.filled_reflections / member.total_impacts) * 100) : 0;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: color }} />
            <div className="truncate text-[14px] font-medium" style={{ color: "var(--text)" }}>{member.name}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${color}18`, color }}>
              {member.severity}
            </span>
            <span className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>
              {member.pattern}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            Partners Involved
          </div>
          <div className="flex flex-wrap gap-2">
            {member.partners.length > 0 ? (
              member.partners.slice(0, 6).map((partner) => (
                <span key={partner} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: "var(--bg-1)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                  {partner}
                </span>
              ))
            ) : (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No repeated partner pattern yet</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[14px] font-semibold tabular-nums" style={{ color }}>
              {member.blank_reflections}/{member.total_impacts}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>blank</div>
          </div>
          <div className="text-right">
            <div className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {filledPct}%
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>filled</div>
          </div>
          <button
            onClick={onOpen}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-bright)" }}
          >
            <ExternalLink size={12} />
            Show all impacts
          </button>
        </div>
      </div>
    </div>
  );
}

function ImpactListSection({
  title,
  impacts,
  emptyLabel,
  selectedImpact,
  onSelect,
}: {
  title: string;
  impacts: ImpactExample[];
  emptyLabel: string;
  selectedImpact: ImpactExample | null;
  onSelect: (impact: ImpactExample) => void;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        {title}
      </div>
      {impacts.length === 0 ? (
        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{emptyLabel}</div>
      ) : (
        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {impacts.map((impact, index) => {
            const active = impactKey(impact, index) === impactKey(selectedImpact, index);
            return (
              <button
                key={impactKey(impact, index)}
                onClick={() => onSelect(impact)}
                className="w-full rounded-xl px-3 py-2 text-left transition-all"
                style={{
                  background: active ? "var(--surface-3)" : "var(--bg-1)",
                  border: `1px solid ${active ? "#3498db40" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium" style={{ color: "var(--text)" }}>
                      {String(impact.group || impact.organizer || "No partner listed")}
                    </div>
                    <div className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {impactDate(impact) || "—"} · {Number(impact.hours ?? 0).toFixed(1)} hrs
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: impact.bucket === "Blank" ? "#e74c3c18" : "#27ae6018",
                      color: impact.bucket === "Blank" ? "#e74c3c" : "#27ae60",
                    }}
                  >
                    {impact.bucket}
                  </span>
                </div>
                <div className="mt-2 truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                  {String(impact.reflection || "[Blank]")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sublabel, accent }: { label: string; value: string; sublabel: string; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${accent}` }}>
      <div className="text-[24px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: accent }}>{label}</div>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sublabel}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
      <div className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-1 text-[13px] font-semibold" style={{ color: accent ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

function ReflectionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse-soft rounded-xl" style={{ background: "var(--surface)", animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse-soft rounded-xl" style={{ background: "var(--surface)", animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </div>
  );
}

function severityCount(summary: Record<string, number>, severity: string) {
  if (severity === "Critical") return Number(summary.critical ?? 0);
  if (severity === "High") return Number(summary.high ?? 0);
  if (severity === "Moderate") return Number(summary.moderate ?? 0);
  if (severity === "Low") return Number(summary.low ?? 0);
  return 0;
}

function impactDate(impact: Record<string, unknown> | null) {
  return String(impact?.date ?? impact?.date_created ?? "");
}

function impactKey(impact: Record<string, unknown> | null, fallback: number) {
  if (!impact) return `empty-${fallback}`;
  return String(impact.impact_id ?? `${impactDate(impact)}-${impact.group ?? "impact"}-${fallback}`);
}
