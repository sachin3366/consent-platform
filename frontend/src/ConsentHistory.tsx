import { useEffect, useState } from "react";
import { fetchHistory, type ConsentRecord } from "./api";

interface Props {
  userId: string;
  domain: string;
  // bump this to re-fetch after a new submission
  refreshKey: number;
}

export default function ConsentHistory({ userId, domain, refreshKey }: Props) {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchHistory(userId, domain)
      .then(setRecords)
      .catch(() => setError("Could not load history."))
      .finally(() => setLoading(false));
  }, [userId, domain, refreshKey]);

  if (loading) return <p>Loading history…</p>;
  if (error) return <p style={{ color: "#dc2626" }}>{error}</p>;
  if (records.length === 0) return <p style={{ color: "#6b7280" }}>No consent history yet.</p>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Consent History</h2>
      <p style={styles.subtitle}>
        Newest first — each record links back to the previous one (immutable event chain).
      </p>
      <div style={styles.chain}>
        {records.map((record, i) => (
          <div key={record.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.recordId}>Record #{record.id}</span>
              {record.previous_record_id !== null && (
                <span style={styles.link}>
                  ← links to #{record.previous_record_id}
                </span>
              )}
              {record.previous_record_id === null && (
                <span style={styles.root}>origin</span>
              )}
            </div>
            <div style={styles.timestamp}>
              {new Date(record.created_at).toLocaleString()}
              {i === 0 && <span style={styles.latestBadge}>latest</span>}
            </div>
            <div style={styles.decisions}>
              {record.decisions.map((d) => (
                <span
                  key={d.category_name}
                  style={{
                    ...styles.badge,
                    background: d.accepted ? "#dcfce7" : "#fee2e2",
                    color: d.accepted ? "#166534" : "#991b1b",
                  }}
                >
                  {d.category_name}: {d.accepted ? "✓" : "✗"}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 480 },
  title: { margin: "0 0 4px", fontSize: 18 },
  subtitle: { margin: "0 0 20px", color: "#6b7280", fontSize: 13 },
  chain: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  recordId: { fontWeight: 600, fontSize: 14 },
  link: { fontSize: 12, color: "#6b7280" },
  root: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  timestamp: { fontSize: 12, color: "#6b7280", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" },
  latestBadge: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 11,
  },
  decisions: { display: "flex", flexWrap: "wrap", gap: 6 },
  badge: {
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 500,
  },
};
