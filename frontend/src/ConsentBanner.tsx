import { useEffect, useState } from "react";
import { fetchCategories, fetchLatest, submitConsent, type Category, type Decision } from "./api";

interface Props {
  userId: string;
  domain: string;
  onSubmitted: () => void;
}

export default function ConsentBanner({ userId, domain, onSubmitted }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchLatest(userId, domain)])
      .then(([cats, latest]) => {
        setCategories(cats);
        const defaults: Record<string, boolean> = {};
        cats.forEach((c) => (defaults[c.name] = false));
        if (latest) {
          latest.decisions.forEach((d) => (defaults[d.category_name] = d.accepted));
        }
        setDecisions(defaults);
      })
      .catch(() => setError("Could not load categories. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [userId, domain]);

  function toggle(name: string) {
    setDecisions((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Decision[] = categories.map((c) => ({
        category_name: c.name,
        accepted: decisions[c.name] ?? false,
      }));
      await submitConsent(userId, domain, payload);
      onSubmitted();
    } catch {
      setError("Failed to save consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading consent options…</p>;

  return (
    <div style={styles.banner}>
      <h2 style={styles.title}>Cookie Preferences</h2>
      <p style={styles.subtitle}>
        Choose which categories of cookies you allow on <strong>{domain}</strong>.
      </p>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.toggleList}>
        {categories.map((cat) => (
          <div key={cat.id} style={styles.row}>
            <div>
              <strong style={styles.catName}>{cat.name}</strong>
              {cat.description && (
                <p style={styles.catDesc}>{cat.description}</p>
              )}
            </div>
            <button
              onClick={() => toggle(cat.name)}
              style={{
                ...styles.toggle,
                background: decisions[cat.name] ? "#16a34a" : "#d1d5db",
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
        {submitting ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
    maxWidth: 480,
    background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  title: { margin: "0 0 4px", fontSize: 18 },
  subtitle: { margin: "0 0 20px", color: "#6b7280", fontSize: 14 },
  error: { color: "#dc2626", fontSize: 14, marginBottom: 12 },
  toggleList: { display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  catName: { fontSize: 15 },
  catDesc: { margin: "2px 0 0", fontSize: 13, color: "#6b7280" },
  toggle: {
    position: "relative",
    width: 44,
    height: 24,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.2s",
    padding: 0,
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
