import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { api } from "../api/client";
import { useAsyncData } from "../hooks/useDashboardData";
import { CHECKPOINT_LABEL, CHECKPOINTS } from "../lib/constants";
import type { DataStatus } from "../types";

type ExportTab = "checkpoint" | "banner" | "daterange";

export function ExportPage({ dataStatus, checkpointNames }: { dataStatus: DataStatus | null; checkpointNames?: string[] }) {
  const [tab, setTab] = useState<ExportTab>("checkpoint");
  const cp = dataStatus?.active_checkpoint ?? "CP3";
  const cpOptions = (checkpointNames && checkpointNames.length > 0 ? checkpointNames : [...CHECKPOINTS]).filter((c) => c !== "TODAY");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--text)" }}>Export</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Copy hour columns for spreadsheet paste-in, ordered by your roster (set in Settings → Roster export)
        </p>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {(["checkpoint", "banner", "daterange"] as ExportTab[]).map((t) => {
          const labels: Record<ExportTab, string> = { checkpoint: "Checkpoint", banner: "Roster (date range)", daterange: "Summary by member" };
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="rounded-lg px-4 py-2 text-[12px] font-medium transition-all"
              style={{
                background: active ? "var(--surface-3)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                border: active ? "1px solid var(--border-3)" : "1px solid transparent",
              }}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {tab === "checkpoint" && <CheckpointExport defaultCp={cp} loaded={!!dataStatus?.loaded} cpOptions={cpOptions} />}
      {tab === "banner"     && <BannerExport loaded={!!dataStatus?.loaded} />}
      {tab === "daterange"  && <DateRangeExport loaded={!!dataStatus?.loaded} />}
    </div>
  );
}

function CheckpointExport({ defaultCp, loaded, cpOptions }: { defaultCp: string; loaded: boolean; cpOptions: string[] }) {
  const fallbackCp = cpOptions[0] ?? "CP3";
  const [cp, setCp] = useState(defaultCp === "TODAY" ? fallbackCp : defaultCp);
  const [triggered, setTriggered] = useState(false);
  const result = useAsyncData(
    () => api.getCheckpointExport(cp),
    [cp, triggered],
    triggered
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCp(defaultCp === "TODAY" ? fallbackCp : defaultCp);
    setTriggered(false);
  }, [defaultCp, fallbackCp]);

  const copy = () => {
    if (!result.data?.clipboard) return;
    navigator.clipboard.writeText(result.data.clipboard).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
            Checkpoint
          </label>
          <select value={cp} onChange={(e) => { setCp(e.target.value); setTriggered(false); }} style={{ width: 140 }}>
            {cpOptions.map((c) => (
              <option key={c} value={c}>{CHECKPOINT_LABEL[c] ?? c}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setTriggered(true)}
          disabled={!loaded}
          className="rounded-lg px-4 py-2 text-[12px] font-medium transition-colors disabled:opacity-40"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}
        >
          Generate
        </button>
        {result.data && (
          <button
            onClick={copy}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium transition-colors"
            style={{ background: "#3498db18", border: "1px solid #3498db40", color: "#3498db" }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy for Excel"}
          </button>
        )}
      </div>

      {result.loading && <ExportSkeleton />}
      {result.data && !result.loading && (
        <ExportTable rows={result.data.rows} />
      )}
    </div>
  );
}

function BannerExport({ loaded }: { loaded: boolean }) {
  const [start, setStart] = useState("");
  const [end, setEnd]     = useState("");
  const [triggered, setTriggered] = useState(false);
  const result = useAsyncData(
    () => api.getBannerExport(start, end),
    [start, end, triggered],
    triggered && !!start && !!end
  );
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!result.data?.clipboard) return;
    navigator.clipboard.writeText(result.data.clipboard).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>Start</label>
          <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setTriggered(false); }} style={{ width: 140 }} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>End</label>
          <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setTriggered(false); }} style={{ width: 140 }} />
        </div>
        <button
          onClick={() => setTriggered(true)}
          disabled={!loaded || !start || !end}
          className="rounded-lg px-4 py-2 text-[12px] font-medium transition-colors disabled:opacity-40"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}
        >
          Generate
        </button>
        {result.data && (
          <button
            onClick={copy}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium"
            style={{ background: "#3498db18", border: "1px solid #3498db40", color: "#3498db" }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy for Excel"}
          </button>
        )}
      </div>

      {result.loading && <ExportSkeleton />}
      {result.data && !result.loading && <ExportTable rows={result.data.rows} />}
    </div>
  );
}

function DateRangeExport({ loaded }: { loaded: boolean }) {
  const [start, setStart] = useState("");
  const [end, setEnd]     = useState("");
  const [triggered, setTriggered] = useState(false);
  const result = useAsyncData(
    () => api.getDateRange(start, end),
    [start, end, triggered],
    triggered && !!start && !!end
  );

  const rows = result.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>Start</label>
          <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setTriggered(false); }} style={{ width: 140 }} />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>End</label>
          <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setTriggered(false); }} style={{ width: 140 }} />
        </div>
        <button
          onClick={() => setTriggered(true)}
          disabled={!loaded || !start || !end}
          className="rounded-lg px-4 py-2 text-[12px] font-medium transition-colors disabled:opacity-40"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}
        >
          Query
        </button>
      </div>

      {result.loading && <ExportSkeleton />}

      {!result.loading && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                {["Name", "Class", "Hours", "Impacts"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid var(--bg-1)", background: i % 2 === 0 ? "var(--surface)" : "var(--row-alt)" }}
                >
                  <td className="px-4 py-2.5" style={{ color: "var(--text)" }}>{String(r.display_name ?? "—")}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-3)" }}>{String(r.class_label ?? "—")}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--text)" }}>
                    {Number(r.hours ?? 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--text-3)" }}>{String(r.impacts ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!result.loading && triggered && rows.length === 0 && (
        <div className="py-10 text-center text-[12px]" style={{ color: "var(--text-faint)" }}>
          No hours logged in this date range
        </div>
      )}
    </div>
  );
}

type ExportRow = { row: number; name: string | null; email: string | null; hours: number | null; is_blank: boolean };

function ExportTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            {["Row", "Name", "Hours"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const row = r as unknown as ExportRow;
            if (row.is_blank) {
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--bg-1)", background: "var(--bg)" }}>
                  <td className="px-4 py-1.5 tabular-nums text-[11px]" style={{ color: "var(--border-3)" }}>{row.row}</td>
                  <td colSpan={2} className="px-4 py-1.5" style={{ borderTop: "1px solid var(--border)" }} />
                </tr>
              );
            }
            return (
              <tr key={i} style={{ borderBottom: "1px solid var(--bg-1)", background: i % 2 === 0 ? "var(--surface)" : "var(--row-alt)" }}>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--text-faint)" }}>{row.row}</td>
                <td className="px-4 py-2.5" style={{ color: row.hours != null ? "var(--text)" : "var(--text-muted)" }}>
                  {row.name ?? "—"}
                </td>
                <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: row.hours != null ? "var(--text)" : "var(--text-faint)" }}>
                  {row.hours != null ? Number(row.hours).toFixed(1) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExportSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <div className="h-10" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }} />
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse-soft"
          style={{ height: 38, background: i % 2 === 0 ? "var(--surface)" : "var(--row-alt)", animationDelay: `${i * 30}ms`, borderBottom: "1px solid var(--bg-1)" }}
        />
      ))}
    </div>
  );
}
