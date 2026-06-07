import { useEffect, useState } from "react";
import {
  fetchLatest, fetchRules, submitConsent,
  type Decision, type JurisdictionRules,
} from "./api";

interface Props {
  userId: string;
  domain: string;
  jurisdiction: string;
  onSubmitted: () => void;
}

export default function ConsentBanner({ userId, domain, jurisdiction, onSubmitted }: Props) {
  const [rules, setRules] = useState<JurisdictionRules | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRules(jurisdiction), fetchLatest(userId, domain)])
      .then(([r, latest]) => {
        setRules(r);
        // Start from jurisdiction defaults
        const defaults: Record<string, boolean> = {};
        r.categories.forEach((c) => (defaults[c.name] = c.default_accepted));
        // Overlay with user's last saved preferences if they exist
        if (latest) {
          latest.decisions.forEach((d) => (defaults[d.category_name] = d.accepted));
        }
        setDecisions(defaults);
      })
      .catch(() => setError("Could not load preferences. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [userId, domain, jurisdiction]);

  function toggle(name: string) {
    setDecisions((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Decision[] = (rules?.categories ?? []).map((c) => ({
        category_name: c.name,
        accepted: decisions[c.name] ?? false,
      }));
      await submitConsent(userId, domain, jurisdiction, payload);
      await new Promise((resolve) => setTimeout(resolve, 500));
      onSubmitted();
    } catch {
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading consent options…</p>;
  if (!rules) return null;

  return (
    <div style={styles.banner}>
      <h2 style={styles.title}>{rules.banner_title}</h2>
      <p style={styles.subtitle}>{rules.banner_subtitle}</p>

      {!rules.requires_opt_in && (
        <p style={styles.optOutNotice}>
          All categories are enabled by default. Toggle off to opt out.
        </p>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.toggleList}>
        {rules.categories.map((cat) => (
          <div key={cat.name} style={styles.row}>
            <div style={styles.catInfo}>
              <strong style={styles.catName}>
                {cat.label ?? cat.name}
              </strong>
              {cat.locked && (
                <span style={styles.lockedBadge}>Always on</span>
              )}
              <p style={styles.catDesc}>{cat.description}</p>
            </div>
            <button
              onClick={() => !cat.locked && toggle(cat.name)}
              disabled={cat.locked}
              style={{
                ...styles.toggle,
                background: decisions[cat.name] ? "#16a34a" : "#d1d5db",
                opacity: cat.locked ? 0.6 : 1,
                cursor: cat.locked ? "not-allowed" : "pointer",
              }}
              aria-label={`Toggle ${cat.name}`}
            >
              <span
                style={{
                  ...styles.thumb,
                  transform: decisions[cat.name] ? "translateX(20px)" : "translateX(2px)",
                }}
              />
            </button>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={submitting} style={styles.submit}>
        {submitting ? "Saving…" : rules.button_label}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
    maxWidth: 520,
    background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  title: { margin: "0 0 4px", fontSize: 18 },
  subtitle: { margin: "0 0 8px", color: "#6b7280", fontSize: 14 },
  optOutNotice: {
    margin: "0 0 16px",
    padding: "8px 12px",
    background: "#fef9c3",
    border: "1px solid #fde68a",
    borderRadius: 6,
    fontSize: 13,
    color: "#92400e",
  },
  error: { color: "#dc2626", fontSize: 14, marginBottom: 12 },
  toggleList: { display: "flex", flexDirection: "column", gap: 16, marginBottom: 24, marginTop: 16 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, display: "inline" },
  lockedBadge: {
    marginLeft: 8,
    fontSize: 11,
    background: "#f3f4f6",
    color: "#6b7280",
    borderRadius: 4,
    padding: "1px 6px",
    fontWeight: 500,
  },
  catDesc: { margin: "2px 0 0", fontSize: 13, color: "#6b7280" },
  toggle: {
    position: "relative",
    width: 44,
    height: 24,
    borderRadius: 12,
    border: "none",
    flexShrink: 0,
    transition: "background 0.2s",
    padding: 0,
    marginTop: 2,
  },
  thumb: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.2s",
    display: "block",
  },
  submit: {
    width: "100%",
    padding: "10px 0",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    cursor: "pointer",
  },
};
