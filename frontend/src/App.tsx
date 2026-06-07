import { useState } from "react";
import ConsentBanner from "./ConsentBanner";
import ConsentHistory from "./ConsentHistory";
import "./App.css";

const USER_ID = "user-demo-001";
const DOMAIN = "demo.local";
const JURISDICTIONS = ["GDPR", "CCPA"] as const;
type Jurisdiction = typeof JURISDICTIONS[number];

export default function App() {
  const [view, setView] = useState<"banner" | "history">("banner");
  const [refreshKey, setRefreshKey] = useState(0);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("GDPR");

  function handleSubmitted() {
    setRefreshKey((k) => k + 1);
    setView("history");
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.appTitle}>Consent Platform</h1>
        <div style={styles.headerRight}>
          <div style={styles.jurisdictionSelector}>
            <label style={styles.jurisdictionLabel}>Jurisdiction:</label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
              style={styles.select}
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
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
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.meta}>
          <span style={styles.metaLabel}>User:</span> {USER_ID} &nbsp;|&nbsp;
          <span style={styles.metaLabel}>Domain:</span> {DOMAIN} &nbsp;|&nbsp;
          <span style={styles.metaLabel}>Jurisdiction:</span>{" "}
          <span style={{
            ...styles.jurisdictionBadge,
            background: jurisdiction === "GDPR" ? "#dbeafe" : "#fef9c3",
            color: jurisdiction === "GDPR" ? "#1d4ed8" : "#92400e",
          }}>
            {jurisdiction}
          </span>
        </div>

        {view === "banner" && (
          <ConsentBanner
            userId={USER_ID}
            domain={DOMAIN}
            jurisdiction={jurisdiction}
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
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  appTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  jurisdictionSelector: { display: "flex", alignItems: "center", gap: 8 },
  jurisdictionLabel: { fontSize: 13, color: "#6b7280", fontWeight: 500 },
  select: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    fontSize: 13,
    background: "#fff",
    cursor: "pointer",
  },
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
  jurisdictionBadge: {
    fontWeight: 600,
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 12,
  },
};
