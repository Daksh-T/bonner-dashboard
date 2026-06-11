import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { useAsyncData } from "../hooks/useDashboardData";
import { CHECKPOINT_LABEL, STATUS_COLORS } from "../lib/constants";
import type { DataStatus, InsightBucket, Status } from "../types";

const CLASS_ORDER = ["Senior", "Junior", "Sophomore", "Freshman", "Other"];
const OVERVIEW_STATUS_ORDER: Status[] = ["Red", "Blue", "Yellow", "Green"];

type RecordShape = Record<string, unknown>;
type DrilldownState =
  | { kind: "week-hours" }
  | { kind: "week-members" }
  | { kind: "avg-progress" }
  | { kind: "class"; className: string }
  | null;

export function OverviewPage({
  onOpenProfile,
  onNavigate,
  dataStatus,
}: {
  onOpenProfile: (e: string) => void;
  onNavigate: (page: "overview" | "members" | "partners" | "reflections" | "slack" | "export" | "critical" | "settings") => void;
  dataStatus: DataStatus | null;
}) {
  const loaded = !!dataStatus?.loaded;
  const activeCheckpoint = dataStatus?.active_checkpoint ?? "CP3";
  const overview = useAsyncData(() => api.getOverview(), [loaded, activeCheckpoint], loaded);
  const classDist = useAsyncData(() => api.getClassDistribution(), [loaded, activeCheckpoint], loaded);
  const insights = useAsyncData(() => api.getInsights(), [loaded, activeCheckpoint], loaded);

  const [drilldown, setDrilldown] = useState<DrilldownState>(null);

  const drilldownKey = drilldown ? `${drilldown.kind}:${drilldown.kind === "class" ? drilldown.className : ""}` : "";
  const drilldownData = useAsyncData(
    () => api.getOverviewDrilldown(drilldown?.kind ?? "", drilldown?.kind === "class" ? drilldown.className : undefined),
    [drilldownKey],
    drilldown != null,
  );

  const counts = overview.data?.status_counts ?? ({} as Record<Status, number>);
  const pulse = overview.data?.cohort_pulse;
  const total = OVERVIEW_STATUS_ORDER.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  const distRows = (classDist.data ?? []).sort((a, b) => {
    const ai = CLASS_ORDER.indexOf(String(a["class"] ?? "Other"));
    const bi = CLASS_ORDER.indexOf(String(b["class"] ?? "Other"));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const concerning = [...(insights.data?.concerning ?? [])].sort((a, b) => {
    const order: Record<string, number> = { Blue: 0, Red: 1 };
    const ao = order[String(a.status ?? "")] ?? 2;
    const bo = order[String(b.status ?? "")] ?? 2;
    return ao !== bo ? ao - bo : Number(a.hours ?? 0) - Number(b.hours ?? 0);
  });
  // "Needs attention" is only the genuinely behind members (Red = behind pace,
  // Blue = nothing logged). On-track members flagged purely for unverified hours
  // are surfaced separately so a green badge never sits under "Needs attention".
  const needsAttention = concerning.filter((m) => m.status === "Red" || m.status === "Blue");
  const pendingReview = concerning.filter((m) => m.status !== "Red" && m.status !== "Blue");

  if (!loaded && !overview.loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-32 text-center">
        <div className="mb-3 text-[14px] font-medium" style={{ color: "var(--text-muted)" }}>No data loaded</div>
        <div className="text-[12px]" style={{ color: "var(--text-faint)" }}>Use the reload button in the sidebar to load CSV exports</div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>
          {CHECKPOINT_LABEL[dataStatus?.active_checkpoint ?? ""] ?? dataStatus?.active_checkpoint ?? "—"}
          {dataStatus?.active_checkpoint !== "TODAY" && (
            <span className="ml-2 text-[14px] font-normal" style={{ color: "var(--text-faint)" }}>checkpoint</span>
          )}
        </h1>
        {pulse && (
          <div className="flex items-baseline gap-2">
            <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color: "var(--text)" }}>
              {pulse.on_track_pct.toFixed(0)}%
            </span>
            <span className="text-[13px] font-medium" style={{ color: "var(--text-3)" }}>on track</span>
          </div>
        )}
      </div>

      <StatusStrip counts={counts} total={total} loading={overview.loading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <SectionHead icon={<AlertTriangle size={13} style={{ color: "#e74c3c" }} />} label="Needs attention" count={needsAttention.length} />

          {overview.loading || insights.loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse-soft rounded-xl" style={{ background: "var(--surface)", animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
          ) : needsAttention.length === 0 ? (
            <div className="rounded-xl py-10 text-center text-[12px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-faint)" }}>
              No one is behind pace
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Members needing attention">
              {needsAttention.map((member) => (
                <li key={member.email}>
                  <AtRiskCard member={member} variant="risk" onOpen={() => onOpenProfile(member.email)} />
                </li>
              ))}
            </ul>
          )}

          {!insights.loading && pendingReview.length > 0 && (
            <div className="space-y-2 pt-2">
              <SectionHead icon={<Clock size={13} style={{ color: "#f39c12" }} />} label="On track · hours pending verification" count={pendingReview.length} />
              <ul className="space-y-2" aria-label="Members with pending hours">
                {pendingReview.map((member) => (
                  <li key={member.email}>
                    <AtRiskCard member={member} variant="pending" onOpen={() => onOpenProfile(member.email)} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!insights.loading && (insights.data?.recent_surge ?? []).length > 0 && (
            <div className="space-y-3 pt-2">
              <SectionHead icon={<TrendingUp size={13} style={{ color: "#27ae60" }} />} label="Recent activity" count={(insights.data?.recent_surge ?? []).length} />
              <div className="grid grid-cols-2 gap-2">
                {(insights.data?.recent_surge ?? []).slice(0, 6).map((member) => (
                  <button
                    key={member.email}
                    onClick={() => onOpenProfile(member.email)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium" style={{ color: "var(--text-bright)" }}>{member.display_name}</div>
                      <div className="text-[11px]" style={{ color: "#27ae60" }}>
                        +{Number(member.recent_hours ?? 0).toFixed(1)} hrs recent
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <SectionHead label="This week" />
            <div className="mt-3 space-y-1">
              {overview.loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 animate-pulse-soft rounded-lg" style={{ background: "var(--surface)", animationDelay: `${i * 40}ms` }} />
                ))
              ) : pulse ? (
                <>
                  <StatRow label="Hours logged" value={`${pulse.week_hours.toFixed(1)} hrs`} accent="#3498db" onClick={() => setDrilldown({ kind: "week-hours" })} />
                  <StatRow label="Active members" value={String(pulse.week_members)} onClick={() => setDrilldown({ kind: "week-members" })} />
                  <StatRow label="Pending verify" value={`${pulse.pending_hours.toFixed(1)} hrs`} accent={pulse.pending_hours > 20 ? "#f39c12" : undefined} onClick={() => onNavigate("partners")} />
                  <StatRow label="Avg progress" value={`${pulse.avg_progress_pct.toFixed(0)}%`} onClick={() => setDrilldown({ kind: "avg-progress" })} />
                </>
              ) : null}
            </div>
          </div>

          <div>
            <SectionHead label="By class" />
            <div className="mt-3 space-y-1.5">
              {classDist.loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 animate-pulse-soft rounded-lg" style={{ background: "var(--surface)", animationDelay: `${i * 50}ms` }} />
                ))
              ) : distRows.map((row) => {
                const className = String(row["class"] ?? "—");
                const rowTotal = OVERVIEW_STATUS_ORDER.reduce((sum, key) => sum + Number(row[key] ?? 0), 0);
                const redBlue = Number(row["Red"] ?? 0) + Number(row["Blue"] ?? 0);
                return (
                  <button
                    key={className}
                    onClick={() => setDrilldown({ kind: "class", className })}
                    className="block w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-2)" }}>{className}</span>
                      <div className="flex items-center gap-2 text-[11px]">
                        {redBlue > 0 && <span style={{ color: "#e74c3c" }}>{redBlue} at risk</span>}
                        <span style={{ color: "var(--text-faint)" }}>{rowTotal} total</span>
                      </div>
                    </div>
                    <div className="flex h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-1)" }}>
                      {OVERVIEW_STATUS_ORDER.map((status) => {
                        const val = Number(row[status] ?? 0);
                        if (!val || !rowTotal) return null;
                        return <div key={status} style={{ width: `${(val / rowTotal) * 100}%`, background: STATUS_COLORS[status], opacity: 0.85 }} />;
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={drilldown != null} onOpenChange={(open) => { if (!open) setDrilldown(null); }} label="Overview details">
        <DialogContent>
          <div className="animate-fade-up">
            {drilldown?.kind === "week-hours" && <OverviewHoursModal data={drilldownData.data as RecordShape | null} />}
            {drilldown?.kind === "avg-progress" && (
              <AvgProgressModal
                series={(drilldownData.data?.series as Array<RecordShape> | undefined) ?? []}
                members={Number(drilldownData.data?.members ?? 0)}
                loading={drilldownData.loading}
                current={pulse?.avg_progress_pct ?? 0}
              />
            )}
            {drilldown?.kind === "week-members" && (
              <OverviewMembersModal
                title="Active Members This Week"
                subtitle="Members who logged any hours during the current seven-day window."
                variant="week"
                activeCheckpoint={activeCheckpoint}
                members={(drilldownData.data?.members as Array<RecordShape> | undefined) ?? []}
              />
            )}
            {drilldown?.kind === "class" && (
              <OverviewMembersModal
                title={`${drilldown.className} Breakdown`}
                subtitle="Checkpoint progress, recent movement, and partner context for this class."
                variant="class"
                activeCheckpoint={activeCheckpoint}
                members={(drilldownData.data?.members as Array<RecordShape> | undefined) ?? []}
                summary={(drilldownData.data?.summary as Record<string, number> | undefined) ?? {}}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewHoursModal({ data }: { data: RecordShape | null }) {
  const allImpacts = (data?.impacts as Array<RecordShape> | undefined) ?? [];
  const memberIndex = useMemo(() => {
    const map = new Map<string, string>(); // email → status
    ((data?.members as Array<RecordShape> | undefined) ?? []).forEach((m) => {
      map.set(String(m.email ?? ""), String(m.status ?? ""));
    });
    return map;
  }, [data]);

  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [selectedImpactId, setSelectedImpactId] = useState<string | null>(null);

  const siteTree = useMemo(() => {
    const siteMap = new Map<string, { hours: number; count: number; memberMap: Map<string, { name: string; email: string; hours: number; impacts: RecordShape[] }> }>();
    allImpacts.forEach((impact) => {
      const partner = String(impact.partner || "(No Group Listed)");
      if (!siteMap.has(partner)) siteMap.set(partner, { hours: 0, count: 0, memberMap: new Map() });
      const site = siteMap.get(partner)!;
      site.hours += Number(impact.hours ?? 0);
      site.count += 1;
      const email = String(impact.email ?? "");
      if (!site.memberMap.has(email)) site.memberMap.set(email, { name: String(impact.member_name ?? email), email, hours: 0, impacts: [] });
      const mem = site.memberMap.get(email)!;
      mem.hours += Number(impact.hours ?? 0);
      mem.impacts.push(impact);
    });
    return Array.from(siteMap.entries())
      .sort((a, b) => b[1].hours - a[1].hours)
      .map(([partner, d]) => ({
        partner,
        hours: d.hours,
        count: d.count,
        members: Array.from(d.memberMap.values()).sort((a, b) => b.hours - a.hours),
      }));
  }, [allImpacts]);

  const totalHours = useMemo(() => allImpacts.reduce((s, i) => s + Number(i.hours ?? 0), 0), [allImpacts]);
  const selectedImpact = allImpacts.find((i) => String(i.impact_id ?? "") === selectedImpactId) ?? null;

  const toggleSite = (p: string) => setExpandedSites((prev) => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  const toggleMember = (k: string) => setExpandedMembers((prev) => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  return (
    <div className="flex flex-col gap-4" style={{ maxHeight: "78vh" }}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Hours This Week</h2>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{allImpacts.length} impacts · {totalHours.toFixed(1)} hrs</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,1fr)_260px] gap-6" style={{ minHeight: 0, overflow: "hidden", height: "calc(78vh - 64px)" }}>
        <div className="overflow-y-auto overscroll-contain px-1">
          {siteTree.length === 0 && (
            <div className="py-10 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No impacts this week.</div>
          )}
          {siteTree.map(({ partner, hours, count, members }) => {
            const siteOpen = expandedSites.has(partner);
            return (
              <div key={partner} className="mb-0.5">
                <button
                  onClick={() => toggleSite(partner)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors"
                  style={{ background: siteOpen ? "var(--surface-3)" : "transparent" }}
                >
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{siteOpen ? "▾" : "▸"}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: siteOpen ? "var(--text)" : "var(--text-2)" }}>{partner}</span>
                  <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{hours.toFixed(1)} hrs · {count}</span>
                </button>
                {siteOpen && (
                  <div className="ml-4 border-l" style={{ borderColor: "var(--border-3)" }}>
                    {members.map((member) => {
                      const mKey = `${partner}:${member.email}`;
                      const mOpen = expandedMembers.has(mKey);
                      const status = memberIndex.get(member.email) as Status | undefined;
                      return (
                        <div key={member.email}>
                          <button
                            onClick={() => toggleMember(mKey)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors"
                            style={{ background: mOpen ? "var(--surface-3)" : "transparent" }}
                          >
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{mOpen ? "▾" : "▸"}</span>
                            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: mOpen ? "var(--text)" : "var(--text-2)" }}>{member.name}</span>
                            {status && <span className="shrink-0 text-[11px] font-semibold" style={{ color: STATUS_COLORS[status] }}>{status}</span>}
                            <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{member.hours.toFixed(1)} hrs</span>
                          </button>
                          {mOpen && (
                            <div className="ml-4 border-l" style={{ borderColor: "var(--border-3)" }}>
                              {member.impacts.map((impact) => {
                                const iId = String(impact.impact_id ?? "");
                                const active = iId === selectedImpactId;
                                return (
                                  <button
                                    key={iId}
                                    onClick={() => setSelectedImpactId(active ? null : iId)}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                                    style={{ background: active ? "var(--surface-3)" : "transparent" }}
                                  >
                                    <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: active ? "var(--text)" : "var(--text-3)" }}>
                                      {String(impact.event_name || partner || "(Untitled)")}
                                    </span>
                                    <div className="shrink-0 text-right">
                                      <div className="text-[11px] tabular-nums" style={{ color: active ? "var(--text-bright)" : "var(--text-muted)" }}>{Number(impact.hours ?? 0).toFixed(1)} hrs</div>
                                      <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>{String(impact.start_date || "")}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <ImpactDetailCard impact={selectedImpact} emptyLabel="Expand a site → member → select an impact." />
      </div>
    </div>
  );
}

function OverviewMembersModal({
  title,
  subtitle,
  variant,
  members,
  summary,
  activeCheckpoint,
}: {
  title: string;
  subtitle: string;
  variant: "week" | "class";
  members: Array<RecordShape>;
  summary?: Record<string, number>;
  activeCheckpoint: string;
}) {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedImpactId, setSelectedImpactId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedEmail(members[0] ? String(members[0].email ?? "") : null);
  }, [members]);

  const selectedMember = members.find((member) => String(member.email ?? "") === selectedEmail) ?? members[0] ?? null;
  const profile = useAsyncData(
    () => (selectedEmail ? api.getMemberProfile(selectedEmail) : Promise.resolve(null)),
    [selectedEmail ?? "", activeCheckpoint],
    !!selectedEmail,
  );
  const impactHistory = useMemo(
    () => ((((profile.data as RecordShape | null)?.impact_history as Array<RecordShape> | undefined) ?? []).slice(0, 18)),
    [profile.data],
  );

  useEffect(() => {
    setSelectedImpactId(impactHistory[0] ? String(impactHistory[0].impact_id ?? "idx-0") : null);
  }, [selectedEmail, impactHistory]);

  const selectedImpact = impactHistory.find(
    (impact, idx) => String(impact.impact_id ?? `idx-${idx}`) === selectedImpactId,
  ) ?? impactHistory[0] ?? null;
  const partnerBreakdown = useMemo(
    () => ((((profile.data as RecordShape | null)?.partner_breakdown as Array<RecordShape> | undefined) ?? []).slice(0, 6)),
    [profile.data],
  );
  const checkpointProgress = useMemo(
    () => (((profile.data as RecordShape | null)?.checkpoint_progress as Array<RecordShape> | undefined) ?? []),
    [profile.data],
  );
  const currentCheckpoint =
    checkpointProgress.find((item) => String(item.name ?? "") === activeCheckpoint)
    ?? checkpointProgress.find((item) => Number(item.pct ?? 0) < 100)
    ?? (checkpointProgress.length ? checkpointProgress[checkpointProgress.length - 1] : null);
  const selectedStatus = String(selectedMember?.status ?? "") as Status;

  return (
    <div className="flex flex-col gap-4 px-1" style={{ maxHeight: "78vh" }}>
      <div>
        <h2 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>

      {!!summary && (
        <div className="flex gap-6">
          {OVERVIEW_STATUS_ORDER.map((status) => (
            <div key={status}>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: STATUS_COLORS[status] }}>{status}</div>
              <div className="mt-0.5 text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>{Number(summary[status] ?? 0)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-6" style={{ height: "calc(78vh - 100px)", minHeight: 0, overflow: "hidden" }}>
        <div className="flex flex-col gap-2" style={{ minHeight: 0 }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            {variant === "week" ? "Members this week" : "Class members"}
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {members.map((member) => {
              const email = String(member.email ?? "");
              const status = String(member.status ?? "") as Status;
              const active = email === String(selectedMember?.email ?? "");
              return (
                <button
                  key={email}
                  onClick={() => setSelectedEmail(email)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors"
                  style={{ background: active ? "var(--surface-3)" : "transparent" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-medium" style={{ color: active ? "var(--text)" : "var(--text-2)" }}>{String(member.display_name ?? email)}</span>
                      {!!status && <span className="shrink-0 text-[11px] font-semibold" style={{ color: STATUS_COLORS[status] }}>{status}</span>}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {String(member.class_label || "")}
                      {variant === "week"
                        ? ` · ${Number(member.hours ?? 0).toFixed(1)} hrs · ${Number(member.impacts ?? 0)} impacts`
                        : ` · ${Number(member.hours ?? 0).toFixed(1)} / ${Number(member.required ?? 0).toFixed(0)} hrs`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col" style={{ borderLeft: "1px solid var(--border)", paddingLeft: "1.5rem", minHeight: 0, overflow: "hidden" }}>
          {!selectedMember ? (
            <div className="flex flex-1 items-center justify-center text-[12px]" style={{ color: "var(--text-muted)" }}>
              Select a member to inspect their detail.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[20px] font-semibold" style={{ color: "var(--text)" }}>{String(selectedMember.display_name ?? "")}</div>
                  <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>
                    {String(selectedMember.class_label ?? "")}
                  </div>
                </div>
                {!!selectedStatus && (
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `${STATUS_COLORS[selectedStatus]}18`, color: STATUS_COLORS[selectedStatus] }}>
                    {selectedStatus}
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>
                {variant === "week" ? (
                  <>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>This week</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "#3498db" }}>{Number(selectedMember.hours ?? 0).toFixed(1)} hrs</div></div>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Impacts</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "var(--text)" }}>{String(selectedMember.impacts ?? 0)}</div></div>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Checkpoint</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: STATUS_COLORS[selectedStatus] ?? "var(--text)" }}>{Number(selectedMember.progress_pct ?? 0).toFixed(0)}%</div></div>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Pending</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "#f39c12" }}>{Number(selectedMember.pending_hours ?? 0).toFixed(1)} hrs</div></div>
                  </>
                ) : (
                  <>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Checkpoint hrs</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "#3498db" }}>{Number(selectedMember.hours ?? 0).toFixed(1)}</div></div>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Goal</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "var(--text)" }}>{Number(selectedMember.required ?? 0).toFixed(1)}</div></div>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Recent 2w</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "#27ae60" }}>{Number(selectedMember.recent_hours ?? 0).toFixed(1)} hrs</div></div>
                    <div><div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Pending</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: "#f39c12" }}>{Number(selectedMember.pending_hours ?? 0).toFixed(1)} hrs</div></div>
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-[1.2fr_0.8fr] gap-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                    {variant === "week" ? "Current checkpoint" : "Checkpoint snapshot"}
                  </div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {currentCheckpoint ? `${String(currentCheckpoint.name ?? activeCheckpoint)} · ${Number(currentCheckpoint.hours ?? 0).toFixed(1)} / ${Number(currentCheckpoint.required ?? 0).toFixed(1)} hrs` : "No checkpoint data"}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                    {currentCheckpoint
                      ? `${Number(currentCheckpoint.pct ?? 0).toFixed(0)}% of goal met`
                      : "No checkpoint progress yet."}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                    Partners
                  </div>
                  <div className="space-y-1">
                    {partnerBreakdown.length > 0 ? partnerBreakdown.map((partner) => (
                      <div key={String(partner.partner ?? "partner")} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px]" style={{ color: "var(--text-bright)" }}>{String(partner.partner ?? "—")}</span>
                        <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{Number(partner.hours ?? 0).toFixed(1)}h</span>
                      </div>
                    )) : (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No partner data.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_260px] gap-6">
                <div className="flex min-h-0 flex-col gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Recent impacts</div>

                  {profile.loading ? (
                    <div className="space-y-1">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="h-10 animate-pulse-soft rounded-lg" style={{ background: "var(--surface-3)", animationDelay: `${index * 60}ms` }} />
                      ))}
                    </div>
                  ) : impactHistory.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                      No impacts found for this member.
                    </div>
                  ) : (
                    <div className="min-h-0 overflow-y-auto overscroll-contain">
                      {impactHistory.map((impact, index) => {
                        const key = String(impact.impact_id ?? `idx-${index}`);
                        const active = key === String(selectedImpactId ?? "");
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedImpactId(key)}
                            className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors"
                            style={{ background: active ? "var(--surface-3)" : "transparent" }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px]" style={{ color: active ? "var(--text)" : "var(--text-2)" }}>
                                {String(impact.event_name || impact.group || "(Untitled Impact)")}
                              </div>
                              <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {String(impact.group || "(No Group Listed)")}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-[11px] font-semibold tabular-nums" style={{ color: active ? "var(--text)" : "var(--text-3)" }}>
                                {Number(impact.hours ?? 0).toFixed(1)} hrs
                              </div>
                              <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                                {String(impact.start_date || "—")}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <ImpactDetailCard impact={selectedImpact} emptyLabel="Select an impact to inspect it." />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactDetailCard({
  impact,
  emptyLabel,
}: {
  impact: RecordShape | null;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto" style={{ borderLeft: "1px solid var(--border)", paddingLeft: "1rem" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Impact detail</div>
      {impact ? (
        <>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              {String(impact.event_name || impact.partner || impact.group || "Impact")}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>
              {String(impact.member_name || "Member")}
            </div>
          </div>
          <div className="space-y-2.5">
            {([
              ["Partner", String(impact.partner || impact.group || "(No Group Listed)")],
              ["Date", String(impact.start_date || "—")],
              ["Hours", `${Number(impact.hours ?? 0).toFixed(1)} hrs`],
              ["Status", String(impact.verified || "—")],
              ["Organizer", String(impact.organizer || "—")],
              ["Reflection", impact.reflection ? "Filled" : "Blank"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="truncate text-right text-[11px]" style={{ color: "var(--text-bright)" }}>{value}</span>
              </div>
            ))}
          </div>
          {impact.reflection && (
            <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Reflection</div>
              <div className="whitespace-pre-wrap text-[12px] leading-5" style={{ color: "var(--text-2)" }}>
                {String(impact.reflection)}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{emptyLabel}</div>
      )}
    </div>
  );
}

function StatusStrip({ counts, total, loading }: { counts: Record<Status, number>; total: number; loading: boolean }) {
  if (loading) return <div className="h-12 animate-pulse-soft rounded-xl" style={{ background: "var(--surface)" }} />;
  if (!total) return null;
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: "var(--bg-1)" }}>
        {OVERVIEW_STATUS_ORDER.map((status) => {
          const val = counts[status] ?? 0;
          if (!val) return null;
          return <div key={status} style={{ width: `${(val / total) * 100}%`, background: STATUS_COLORS[status] }} />;
        })}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {OVERVIEW_STATUS_ORDER.map((status) => {
          const val = counts[status] ?? 0;
          return (
            <div key={status} className="rounded-lg px-2 py-2 text-center" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
              <div className="text-[15px] font-semibold tabular-nums" style={{ color: val > 0 ? "var(--text)" : "var(--text-faint)" }}>{val}</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: val > 0 ? STATUS_COLORS[status] : "var(--text-faint)" }}>
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AtRiskCard({ member, onOpen, variant = "risk" }: { member: InsightBucket; onOpen: () => void; variant?: "risk" | "pending" }) {
  const status = (member.status ?? "Exempt") as Status;
  const color = STATUS_COLORS[status];
  const pct = Math.min(100, (Number(member.hours ?? 0) / Math.max(Number(member.still_needed ?? 1) + Number(member.hours ?? 0), 1)) * 100);
  const isBlue = status === "Blue";
  const tint = isBlue || variant === "pending";
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition-all"
      style={{ background: tint ? `${color}08` : "var(--surface)", border: `1px solid ${tint ? `${color}25` : "var(--border)"}` }}
      aria-label={`${member.display_name}, status ${status}. Open profile.`}
    >
      <div className="shrink-0 rounded-lg px-2.5 py-1.5" style={{ background: `${color}18` }}>
        <span className="text-[11px] font-bold" style={{ color }}>{status}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>{member.display_name}</span>
          {!isBlue && <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>{Number(member.hours ?? 0).toFixed(1)} hrs</span>}
        </div>
        {variant === "pending" ? (
          <div className="mt-1 text-[11px]" style={{ color: "#f39c12" }}>
            {Number(member.pending_hours ?? 0).toFixed(1)} hrs awaiting partner verification
          </div>
        ) : isBlue ? (
          <div className="mt-1 text-[11px]" style={{ color: `${color}aa` }}>No hours logged this semester</div>
        ) : (
          <>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--hover)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              needs {Number(member.still_needed ?? 0).toFixed(1)} more hrs
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function AvgProgressModal({ series, members, loading, current }: { series: Array<RecordShape>; members: number; loading: boolean; current: number }) {
  const data = series.map((p) => ({
    label: String(p.label ?? ""),
    week: String(p.week ?? ""),
    avg_pct: Number(p.avg_pct ?? 0),
  }));
  // Thin the x-axis tick labels so they stay readable on narrow screens.
  const tickInterval = data.length > 10 ? Math.ceil(data.length / 8) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Average Progress Over Time</h2>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            Mean share of each member's final-goal hours, week by week across {members} active members.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "var(--text)" }}>{current.toFixed(0)}%</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>now</div>
        </div>
      </div>

      {loading ? (
        <div className="h-[320px] animate-pulse-soft rounded-xl" style={{ background: "var(--surface)" }} />
      ) : data.length === 0 ? (
        <div className="py-16 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No activity yet to chart.</div>
      ) : (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="avgProgressFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3498db" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3498db" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--hover)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
                minTickGap={16}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", borderRadius: 10 }}
                labelStyle={{ color: "var(--text-3)" }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Avg progress"]}
              />
              <Area type="monotone" dataKey="avg_pct" stroke="#3498db" strokeWidth={2} fill="url(#avgProgressFill)" name="Avg progress" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SectionHead({ icon, label, count }: { icon?: ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>{label}</span>
      {count != null && count > 0 && (
        <span className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>
          {count}
        </span>
      )}
    </div>
  );
}

function StatRow({ label, value, accent, onClick }: { label: string; value: string; accent?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: accent ?? "var(--text)" }}>{value}</span>
    </Tag>
  );
}


