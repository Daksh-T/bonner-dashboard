import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AlertCircle, BarChart3, Database, ExternalLink, Loader2, Menu, RefreshCw, X } from "lucide-react";
import { api } from "./api/client";
import { Sidebar } from "./components/Sidebar";
import { applyTheme } from "./lib/theme";
import type { DataStatus } from "./types";

const MemberProfile = lazy(() => import("./components/MemberProfile").then((module) => ({ default: module.MemberProfile })));
const OverviewPage = lazy(() => import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const MembersPage = lazy(() => import("./pages/MembersPage").then((module) => ({ default: module.MembersPage })));
const PartnersPage = lazy(() => import("./pages/PartnersPage").then((module) => ({ default: module.PartnersPage })));
const ReflectionsPage = lazy(() => import("./pages/ReflectionsPage").then((module) => ({ default: module.ReflectionsPage })));
const SlackPage = lazy(() => import("./pages/SlackPage").then((module) => ({ default: module.SlackPage })));
const ExportPage = lazy(() => import("./pages/ExportPage").then((module) => ({ default: module.ExportPage })));
const CriticalPage = lazy(() => import("./pages/CriticalPage").then((module) => ({ default: module.CriticalPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const Onboarding = lazy(() => import("./components/Onboarding").then((module) => ({ default: module.Onboarding })));

export type Page = "overview" | "metrics" | "members" | "partners" | "reflections" | "slack" | "export" | "settings";

const NAV_TITLES: Record<Page, string> = {
  overview: "Follow-up",
  metrics: "Metrics",
  members: "Members",
  partners: "Partners",
  reflections: "Reflections",
  slack: "Communication",
  export: "Export",
  settings: "Settings",
};

type LoadState = "idle" | "loading" | "loaded" | "error";

const PROJECT_REPO_URL = "https://github.com/Daksh-T/bonner-dashboard";
const DEMO_POPUP_DISMISSED_KEY = "bonner-demo-popup-dismissed";

export default function App() {
  const [page, setPage]             = useState<Page>("overview");
  const [profileEmail, setProfile]  = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [loadState, setLoadState]   = useState<LoadState>("idle");
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [checkpointNames, setCheckpointNames] = useState<string[]>([]);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showDemoPopup, setShowDemoPopup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const demoMode = dataStatus?.demo_mode === true;

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

  useEffect(() => {
    if (!demoMode) return;
    setShowWalkthrough(false);
    let dismissed = false;
    try { dismissed = localStorage.getItem(DEMO_POPUP_DISMISSED_KEY) === "1"; } catch { /* private mode */ }
    if (!dismissed) setShowDemoPopup(true);
  }, [demoMode]);

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
            <Suspense fallback={<PageFallback />}>
              {page === "overview"    && <CriticalPage   onOpenProfile={setProfile} dataStatus={dataStatus} />}
              {page === "metrics"     && <OverviewPage   onOpenProfile={setProfile} onNavigate={setPage} dataStatus={dataStatus} />}
              {page === "members"     && <MembersPage    onOpenProfile={setProfile} dataStatus={dataStatus} />}
              {page === "partners"    && <PartnersPage   dataStatus={dataStatus} />}
              {page === "reflections" && <ReflectionsPage dataStatus={dataStatus} />}
              {page === "slack"       && <SlackPage       dataStatus={dataStatus} />}
              {page === "export"      && <ExportPage      dataStatus={dataStatus} checkpointNames={checkpointNames} />}
              {page === "settings"    && (
                <SettingsPage
                  dataStatus={dataStatus}
                  onDataStatusChange={setDataStatus}
                  onConfigChange={refreshCheckpoints}
                  onOpenWalkthrough={() => setShowWalkthrough(true)}
                />
              )}
            </Suspense>
          </div>
        </div>
      </main>

      {showWalkthrough && !demoMode && <Suspense fallback={null}><Onboarding onClose={closeWalkthrough} onComplete={onOnboardingDone} /></Suspense>}
      {showDemoPopup && demoMode && (
        <DemoPopup
          onClose={() => {
            setShowDemoPopup(false);
            try { localStorage.setItem(DEMO_POPUP_DISMISSED_KEY, "1"); } catch { /* private mode */ }
          }}
        />
      )}

      {profileEmail && (
        <Suspense fallback={null}>
          <MemberProfile
            email={profileEmail}
            activeCheckpoint={dataStatus?.active_checkpoint ?? "CP3"}
            onClose={() => setProfile(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function PageFallback() {
  return <div className="space-y-3"><div className="h-8 w-48 animate-pulse-soft rounded-lg" style={{ background: "var(--surface)" }} />{[0, 1, 2, 3].map((index) => <div key={index} className="h-20 animate-pulse-soft rounded-xl" style={{ background: "var(--surface)", animationDelay: `${index * 50}ms` }} />)}</div>;
}

function DemoPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay)" }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border-3)" }}>
        <div className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#3498db14", border: "1px solid #3498db33" }}>
            <BarChart3 size={20} style={{ color: "#3498db" }} />
          </span>
          <button onClick={onClose} aria-label="Dismiss" className="rounded-md p-1" style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>
        <h2 className="mt-4 text-[17px] font-semibold" style={{ color: "var(--text)" }}>You're viewing a live demo</h2>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Everything here runs on <strong>fabricated demo data</strong> — explore freely. To run the dashboard on your own
          program's GivePulse exports, grab the app from GitHub: it runs locally on your machine, with a guided setup and
          downloadable desktop builds.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <a
            href={PROJECT_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-medium"
            style={{ background: "#3498db", color: "#fff" }}
          >
            Get the app on GitHub <ExternalLink size={13} />
          </a>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium" style={{ background: "var(--surface-3)", border: "1px solid var(--border-3)", color: "var(--text-2)" }}>
            Keep exploring
          </button>
        </div>
      </div>
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
