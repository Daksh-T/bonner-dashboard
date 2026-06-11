import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api/client";
import { useAsyncData } from "../hooks/useDashboardData";
import { STATUS_COLORS, STATUS_ORDER, STATUS_LABEL } from "../lib/constants";
import type { DataStatus, MemberRow, Status } from "../types";

const CLASS_ORDER = ["Senior", "Junior", "Sophomore", "First-year", "Other"];

export function MembersPage({
  onOpenProfile,
  dataStatus,
}: {
  onOpenProfile: (email: string) => void;
  dataStatus: DataStatus | null;
}) {
  const activeCheckpoint = dataStatus?.active_checkpoint ?? "CP3";
  const members = useAsyncData(() => api.getMembers(), [activeCheckpoint], true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [classFilter, setClassFilter] = useState("All");
  const [insightFilter, setInsightFilter] = useState<"All" | "Behind pace" | "No recent activity" | "Pending heavy" | "On pace">("All");
  const [sort, setSort] = useState<"name" | "hours" | "pct">("pct");

  const rows = members.data ?? [];

  const classes = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => seen.add(r.class_label));
    return ["All", ...CLASS_ORDER.filter((c) => seen.has(c)), ...[...seen].filter((c) => !CLASS_ORDER.includes(c))];
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== "All") out = out.filter((r) => r.status === statusFilter);
    if (classFilter !== "All") out = out.filter((r) => r.class_label === classFilter);
    if (insightFilter === "Behind pace") out = out.filter((r) => r.pace_needed > 0 && r.pace_gap > 0.5);
    if (insightFilter === "No recent activity") out = out.filter((r) => r.hours > 0 && r.recent_hours === 0);
    if (insightFilter === "Pending heavy") out = out.filter((r) => r.pending_hours >= 5);
    if (insightFilter === "On pace") out = out.filter((r) => r.pace_needed === 0 || r.pace_gap <= 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.display_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    }
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.display_name.localeCompare(b.display_name);
      if (sort === "hours") return b.hours - a.hours;
      return b.progress_pct - a.progress_pct;
    });
    return out;
  }, [rows, statusFilter, classFilter, insightFilter, search, sort]);

  const grouped = useMemo(() => {
    const map = new Map<Status, MemberRow[]>();
    STATUS_ORDER.forEach((s) => map.set(s, []));
    filtered.forEach((r) => {
      if (!map.has(r.status)) map.set(r.status, []);
      map.get(r.status)!.push(r);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>Members</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {members.loading ? "Loading…" : `${filtered.length} of ${rows.length} members`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={{ paddingLeft: 30, width: 180 }}
          />
        </div>

        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {(["All", ...STATUS_ORDER] as const).map((s) => {
            const active = statusFilter === s;
            const color = s === "All" ? "var(--text-3)" : STATUS_COLORS[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
                style={{
                  background: active ? `${color}18` : "transparent",
                  color: active ? color : "var(--text-muted)",
                  border: active ? `1px solid ${color}30` : "1px solid transparent",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          style={{ width: "auto", flex: "0 0 auto" }}
        >
          {classes.map((c) => <option key={c}>{c}</option>)}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "hours" | "pct")}
          style={{ width: "auto", flex: "0 0 auto" }}
        >
          <option value="pct">Sort: Progress</option>
          <option value="hours">Sort: Hours</option>
          <option value="name">Sort: Name</option>
        </select>

        <select
          value={insightFilter}
          onChange={(e) => setInsightFilter(e.target.value as typeof insightFilter)}
          style={{ width: "auto", flex: "0 0 auto" }}
        >
          <option value="All">All pace views</option>
          <option value="Behind pace">Behind pace</option>
          <option value="No recent activity">No recent activity</option>
          <option value="Pending heavy">Pending heavy</option>
          <option value="On pace">On pace</option>
        </select>
      </div>

      {/* Content */}
      {members.loading && <MembersSkeleton />}

      {!members.loading && (
        <div className="space-y-4">
          {STATUS_ORDER.map((status) => {
            const items = grouped.get(status) ?? [];
            if (!items.length) return null;
            const color = STATUS_COLORS[status];
            return (
              <div key={status}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
                    {status}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{items.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((member) => (
                    <MemberCard key={member.email} member={member} onOpenProfile={onOpenProfile} />
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
              No members match these filters
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member, onOpenProfile }: { member: MemberRow; onOpenProfile: (email: string) => void }) {
  const color = STATUS_COLORS[member.status];
  const pct = Math.min(100, member.progress_pct);

  return (
    <button
      onClick={() => onOpenProfile(member.email)}
      className="rounded-xl p-4 text-left transition-all"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}` }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${color}60`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.borderLeftColor = color; }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>{member.display_name}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{member.class_label}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {member.hours.toFixed(1)}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>/ {member.required.toFixed(1)}</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--hover)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] font-semibold tabular-nums" style={{ color }}>
          {pct.toFixed(0)}%
        </div>
      </div>
    </button>
  );
}

function MembersSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="mb-2 h-4 w-24 animate-pulse-soft rounded" style={{ background: "var(--border-3)" }} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse-soft rounded-xl"
                style={{ background: "var(--surface)", animationDelay: `${(g * 6 + i) * 40}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
