import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Database, Loader2, Menu, RefreshCw } from "lucide-react";
import { api } from "./api/client";
import { Sidebar } from "./components/Sidebar";
import { MemberProfile } from "./components/MemberProfile";
import { OverviewPage } from "./pages/OverviewPage";
import { MembersPage } from "./pages/MembersPage";
import { PartnersPage } from "./pages/PartnersPage";
import { ReflectionsPage } from "./pages/ReflectionsPage";
import { SlackPage } from "./pages/SlackPage";
import { ExportPage } from "./pages/ExportPage";
import { CriticalPage } from "./pages/CriticalPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Onboarding } from "./components/Onboarding";
import { applyTheme } from "./lib/theme";
import type { DataStatus } from "./types";

export type Page = "overview" | "members" | "partners" | "reflections" | "slack" | "export" | "critical" | "settings";

const NAV_TITLES: Record<Page, string> = {
  overview: "Overview",
  members: "Members",
  partners: "Partners",
  reflections: "Reflections",
  slack: "Slack",
  export: "Export",
  critical: "Critical",
  settings: "Settings",
};

type LoadState = "idle" | "loading" | "loaded" | "error";

export default function App() {
  const [page, setPage]             = useState<Page>("overview");
  const [profileEmail, setProfile]  = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [loadState, setLoadState]   = useState<LoadState>("idle");
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [checkpointNames, setCheckpointNames] = useState<string[]>([]);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const doLoad = useCallback(async (reload = false) => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const s = reload ? await api.reloadData() : await api.loadData();
      setDataStatus(s);
      setLoadState("loaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      setLoadState("error");
    }
  }, []);

  const refreshCheckpoints = useCallback(() => {
    api.getCheckpoints()
      .then((cp) => setCheckpointNames([...cp.items.map((i) => i.name), "TODAY"]))
      .catch(() => setCheckpointNames(["TODAY"]));
  }, []);

  useEffect(() => {
    api.getStatus()
      .then((s) => {
        if (s.loaded) {
          setDataStatus(s);
          setLoadState("loaded");
        } else {
          doLoad();
        }
      })
      .catch(() => doLoad());
    refreshCheckpoints();
    api.getConfig()
      .then((c) => {
        applyTheme(c.theme === "light" ? "light" : "dark");
        if (!c.onboarding_complete) setShowWalkthrough(true);
      })
      .catch(() => {});
  }, [doLoad, refreshCheckpoints]);

  const closeWalkthrough = useCallback(() => {
    setShowWalkthrough(false);
    api.completeOnboarding().catch(() => {});
  }, []);

  const onOnboardingDone = useCallback((s?: DataStatus) => {
    setShowWalkthrough(false);
    if (s) setDataStatus(s);
    refreshCheckpoints();
    api.completeOnboarding().catch(() => {});
  }, [refreshCheckpoints]);

  const setCheckpoint = useCallback(async (cp: string) => {
    setLoadState("loading");
    setLoadError(null);
    try {
      setDataStatus(await api.setCheckpoint(cp));
      setLoadState("loaded");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setLoadState("error");
    }
  }, []);

  const navigate = useCallback((p: Page) => {
    setPage(p);
    setProfile(null);
    setSidebarOpen(false);
  }, []);

  const pageTitle = NAV_TITLES[page] ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <Sidebar
        page={page}
        onNavigate={navigate}
        dataStatus={dataStatus}
        loadState={loadState}
        onReload={() => doLoad(true)}
        onSetCheckpoint={setCheckpoint}
        checkpointNames={checkpointNames}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile backdrop when the drawer is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main id="main-content" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div
          className="flex shrink-0 items-center gap-3 px-4 py-3 md:hidden"
          style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--border-2)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-md p-1.5"
            style={{ color: "var(--text-2)" }}
          >
            <Menu size={20} />
          </button>
          <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{pageTitle}</span>
        </div>

        {/* Status bar — shown when loading or error */}
        {(loadState === "loading" || loadState === "error" || loadState === "idle") && (
          <StatusBar
            loadState={loadState}
            error={loadError}
            onRetry={() => doLoad()}
          />
        )}

        <div className="flex-1 overflow-y-auto">
          <div
            key={page === "settings" ? "settings" : `${page}:${dataStatus?.last_loaded_at ?? ""}`}
            className="animate-fade-up min-h-full p-4 md:p-8"
          >
            {page === "overview"    && <OverviewPage   onOpenProfile={setProfile} onNavigate={setPage} dataStatus={dataStatus} />}
            {page === "members"     && <MembersPage    onOpenProfile={setProfile} dataStatus={dataStatus} />}
            {page === "partners"    && <PartnersPage   dataStatus={dataStatus} />}
            {page === "reflections" && <ReflectionsPage dataStatus={dataStatus} />}
            {page === "slack"       && <SlackPage       dataStatus={dataStatus} />}
            {page === "export"      && <ExportPage      dataStatus={dataStatus} checkpointNames={checkpointNames} />}
            {page === "critical"    && <CriticalPage    onOpenProfile={setProfile} dataStatus={dataStatus} />}
            {page === "settings"    && (
              <SettingsPage
                dataStatus={dataStatus}
                onDataStatusChange={setDataStatus}
                onConfigChange={refreshCheckpoints}
                onOpenWalkthrough={() => setShowWalkthrough(true)}
              />
            )}
          </div>
        </div>
      </main>

      {showWalkthrough && <Onboarding onClose={closeWalkthrough} onComplete={onOnboardingDone} />}

      {profileEmail && (
        <MemberProfile
          email={profileEmail}
          activeCheckpoint={dataStatus?.active_checkpoint ?? "CP3"}
          onClose={() => setProfile(null)}
        />
      )}
    </div>
  );
}

function StatusBar({ loadState, error, onRetry }: { loadState: LoadState; error: string | null; onRetry: () => void }) {
  if (loadState === "loading") {
    return (
      <div className="flex shrink-0 items-center gap-2.5 px-6 py-2.5 text-[12px]" style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--border-2)", color: "var(--text-3)" }}>
        <Loader2 size={12} className="animate-spin" style={{ color: "#3498db" }} />
        <span>Loading data…</span>
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className="flex shrink-0 items-center gap-2.5 px-6 py-2.5 text-[12px]" style={{ background: "#e74c3c0a", borderBottom: "1px solid #e74c3c20", color: "#e74c3c" }}>
        <AlertCircle size={12} />
        <span className="flex-1 truncate">{error ?? "Failed to load data"}</span>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] transition-colors"
          style={{ background: "#e74c3c18", border: "1px solid #e74c3c30", color: "#e74c3c" }}
        >
          <RefreshCw size={10} />
          Retry
        </button>
        <span style={{ color: "#e74c3c60" }}>·</span>
        <span className="text-[11px]" style={{ color: "#e74c3c80" }}>
          Upload your users & impacts CSVs in Settings → Data
        </span>
      </div>
    );
  }
  if (loadState === "idle") {
    return (
      <div className="flex shrink-0 items-center gap-2.5 px-6 py-2.5 text-[12px]" style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--border-2)", color: "var(--text-3)" }}>
        <Database size={12} />
        <span>No data loaded</span>
        <button
          onClick={onRetry}
          className="rounded px-2 py-0.5 text-[11px] transition-colors"
          style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}
        >
          Load now
        </button>
      </div>
    );
  }
  return null;
}
