import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { useAsyncData } from "../hooks/useDashboardData";
import type { DataStatus } from "../types";

type PendingPartner = {
  partner: string;
  pending_impacts: number;
  pending_hours: number;
  member_count: number;
  members: string[];
  oldest_pending: string;
  days_waiting: number;
};

type PartnerPendingDetail = {
  partner: string;
  summary: {
    pending_impacts: number;
    pending_hours: number;
    blank_pending_impacts: number;
    member_count: number;
    oldest_pending: string;
    days_waiting: number;
  };
  weekly: Array<Record<string, unknown>>;
  impacts: Array<Record<string, unknown>>;
};

export function PartnersPage({ dataStatus }: { dataStatus: DataStatus | null }) {
  const loaded = !!dataStatus?.loaded;
  const activeCheckpoint = dataStatus?.active_checkpoint ?? "CP3";
  const pending = useAsyncData(() => api.getPartnersPending(), [loaded, activeCheckpoint], loaded);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const detail = useAsyncData(
    () => (selectedPartner ? api.getPartnerPendingDetail(selectedPartner) : Promise.resolve(null)),
    [selectedPartner],
    selectedPartner != null,
  );
  const [selectedImpactIndex, setSelectedImpactIndex] = useState(0);

  const pendingRows = (pending.data ?? []) as PendingPartner[];
  const detailData = detail.data as PartnerPendingDetail | null;
  const impacts = detailData?.impacts ?? [];
  const selectedImpact = impacts[selectedImpactIndex] ?? null;

  const topSummary = useMemo(() => {
    const uniqueMembers = new Set<string>();
    const totals = pendingRows.reduce(
      (acc, row) => {
        acc.hours += Number(row.pending_hours ?? 0);
        acc.impacts += Number(row.pending_impacts ?? 0);
        row.members.forEach((member) => uniqueMembers.add(member));
        return acc;
      },
      { hours: 0, impacts: 0 },
    );
    return { ...totals, members: uniqueMembers.size };
  }, [pendingRows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>Partners</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Track pending partner approvals and inspect the affected impacts
        </p>
      </div>

      {pending.loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse-soft rounded-xl" style={{ background: "var(--surface)", animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Partners waiting" value={String(pendingRows.length)} accent="#f39c12" />
            <MetricCard label="Pending hours" value={topSummary.hours.toFixed(1)} accent="#3498db" />
            <MetricCard label="Pending impacts" value={String(topSummary.impacts)} accent="#e74c3c" />
            <MetricCard label="Affected members" value={String(topSummary.members)} accent="var(--text-2)" />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: "#f39c12" }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "#f39c12" }}>Pending approval</span>
              <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{pendingRows.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pendingRows.map((partner) => (
                <button
                  key={partner.partner}
                  onClick={() => {
                    setSelectedPartner(partner.partner);
                    setSelectedImpactIndex(0);
                  }}
                  className="rounded-xl p-4 text-left transition-all"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-3)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>{partner.partner}</div>
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {partner.member_count} members · oldest {partner.days_waiting}d
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{partner.pending_hours.toFixed(1)}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>{partner.pending_impacts} impacts</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {partner.members.slice(0, 5).map((member) => (
                      <span key={member} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>
                        {member}
                      </span>
                    ))}
                    {partner.members.length > 5 && (
                      <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                        +{partner.members.length - 5}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <Dialog
        label="Partner pending detail"
        open={selectedPartner != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPartner(null);
            setSelectedImpactIndex(0);
          }
        }}
      >
        <DialogContent>
          <div className="animate-fade-up">
            {!detailData ? (
              <div className="py-12 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Loading partner detail…</div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div className="min-w-0">
                    <h2 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>{detailData.partner}</h2>
                    <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Pending impacts, blank-reflection count, and weekly aging pattern
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Pending impacts" value={String(detailData.summary.pending_impacts)} accent="#e74c3c" />
                    <MiniStat label="Of which blank impacts" value={String(detailData.summary.blank_pending_impacts)} accent="#f39c12" />
                    <MiniStat label="Hours" value={detailData.summary.pending_hours.toFixed(1)} accent="#3498db" />
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                    Pending By Week
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={detailData.weekly} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--hover)" vertical={false} />
                      <XAxis dataKey="week_label" tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", borderRadius: 10 }}
                        labelStyle={{ color: "var(--text-3)" }}
                      />
                      <Bar dataKey="pending_impacts" fill="#3498db" radius={[4, 4, 0, 0]} name="Pending impacts" />
                      <Bar dataKey="blank_impacts" fill="#f39c12" radius={[4, 4, 0, 0]} name="Of which blank impacts" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_320px]">
                  <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                      Affected Impacts ({impacts.length})
                    </div>
                    <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                      {impacts.map((impact, index) => {
                        const active = index === selectedImpactIndex;
                        return (
                          <button
                            key={String(impact.impact_id ?? `${impact.email}-${index}`)}
                            onClick={() => setSelectedImpactIndex(index)}
                            className="w-full rounded-lg px-3 py-2 text-left transition-all"
                            style={{
                              background: active ? "var(--surface-3)" : "transparent",
                              border: `1px solid ${active ? "var(--border-3)" : "var(--border)"}`,
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-medium" style={{ color: "var(--text)" }}>
                                  {String(impact.member_name || impact.email || "Member")}
                                </div>
                                <div className="mt-1 truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                                  {String(impact.start_date || "—")} · {Number(impact.hours ?? 0).toFixed(1)} hrs
                                </div>
                              </div>
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  background: impact.is_blank_reflection ? "#e74c3c18" : "#27ae6018",
                                  color: impact.is_blank_reflection ? "#e74c3c" : "#27ae60",
                                }}
                              >
                                {impact.is_blank_reflection ? "Blank" : "Filled"}
                              </span>
                            </div>
                            <div className="mt-2 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {String(impact.reflection || "[Blank]")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                      Impact Detail
                    </div>
                    {selectedImpact ? (
                      <div className="space-y-4">
                        <div>
                          <div className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                            {String(selectedImpact.event_name || selectedImpact.member_name || "Impact")}
                          </div>
                          <div className="mt-1 text-[12px]" style={{ color: "var(--text-3)" }}>
                            {String(selectedImpact.member_name || selectedImpact.email || "—")}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <MiniStat label="Date" value={String(selectedImpact.start_date || "—")} />
                          <MiniStat label="Week" value={String(selectedImpact.week_label || "—")} />
                          <MiniStat label="Hours" value={`${Number(selectedImpact.hours ?? 0).toFixed(1)} hrs`} />
                          <MiniStat label="Organizer" value={String(selectedImpact.organizer || "—")} />
                        </div>
                        <div className="rounded-xl p-4" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                            Reflection / Review
                          </div>
                          <div className="whitespace-pre-wrap text-[13px] leading-6" style={{ color: "var(--text-bright)" }}>
                            {String(selectedImpact.reflection || "[Blank]")}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Select an impact to inspect it.</div>
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

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-[24px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: accent }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold" style={{ color: accent ?? "var(--text)" }}>{value}</div>
    </div>
  );
}
