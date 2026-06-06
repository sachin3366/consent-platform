import { useState } from "react";
import ConsentBanner from "./ConsentBanner";
import ConsentHistory from "./ConsentHistory";
import "./App.css";

// Hard-coded for local dev — in a real app these come from the session/cookie
const USER_ID = "user-demo-001";
const DOMAIN = "demo.local";

export default function App() {
  const [view, setView] = useState<"banner" | "history">("banner");
  // incrementing this tells ConsentHistory to re-fetch after a new submission
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSubmitted() {
    setRefreshKey((k) => k + 1);
    setView("history");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.appTitle}>Consent Platform</h1>
        <nav style={styles.nav}>
          <button
            onClick={() => setView("banner")}
            style={{ ...styles.navBtn, ...(view === "banner" ? styles.navBtnActive : {}) }}
          >
            Banner
          </button>
          <button
            onClick={() => setView("history")}
            style={{ ...styles.navBtn, ...(view === "history" ? styles.navBtnActive : {}) }}
          >
            History
          </button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={styles.meta}>
          <span style={styles.metaLabel}>User:</span> {USER_ID} &nbsp;|&nbsp;
          <span style={styles.metaLabel}>Domain:</span> {DOMAIN}
        </div>

        {view === "banner" && (
          <ConsentBanner
            userId={USER_ID}
            domain={DOMAIN}
            onSubmitted={handleSubmitted}
          />
        )}
        {view === "history" && (
          <ConsentHistory
            userId={USER_ID}
            domain={DOMAIN}
            refreshKey={refreshKey}
          />
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 32px",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  appTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  nav: { display: "flex", gap: 8 },
  navBtn: {
    padding: "6px 16px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
  },
  navBtnActive: {
    background: "#2563eb",
    color: "#fff",
    border: "1px solid #2563eb",
  },
  main: { padding: 32 },
  meta: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  metaLabel: { fontWeight: 600, color: "#374151" },
};
