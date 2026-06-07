const BASE_URL = "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY as string;

export interface Decision {
  category_name: string;
  accepted: boolean;
}

export interface ConsentRecord {
  id: number;
  user_identifier: string;
  domain: string;
  created_at: string;
  previous_record_id: number | null;
  decisions: Decision[];
}

export interface JurisdictionCategoryRule {
  name: string;
  description: string;
  default_accepted: boolean;
  locked: boolean;
  label: string | null;
}

export interface JurisdictionRules {
  jurisdiction: string;
  banner_title: string;
  banner_subtitle: string;
  requires_opt_in: boolean;
  button_label: string;
  categories: JurisdictionCategoryRule[];
}

const AUTH_HEADER = { "X-API-Key": API_KEY };

export async function fetchRules(jurisdiction: string): Promise<JurisdictionRules> {
  const res = await fetch(`${BASE_URL}/consent/rules/${encodeURIComponent(jurisdiction)}`);
  if (!res.ok) throw new Error("Failed to load jurisdiction rules");
  return res.json();
}

export async function submitConsent(
  user_identifier: string,
  domain: string,
  jurisdiction: string,
  decisions: Decision[]
): Promise<void> {
  const res = await fetch(`${BASE_URL}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: JSON.stringify({ user_identifier, domain, jurisdiction, decisions }),
  });
  if (!res.ok) throw new Error("Failed to submit consent");
}

export async function fetchLatest(
  user_identifier: string,
  domain: string
): Promise<ConsentRecord | null> {
  const res = await fetch(
    `${BASE_URL}/consent/latest?user_identifier=${encodeURIComponent(user_identifier)}&domain=${encodeURIComponent(domain)}`,
    { headers: AUTH_HEADER }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load latest consent");
  return res.json();
}

export async function fetchHistory(
  user_identifier: string,
  domain: string
): Promise<ConsentRecord[]> {
  const res = await fetch(
    `${BASE_URL}/consent/history?user_identifier=${encodeURIComponent(user_identifier)}&domain=${encodeURIComponent(domain)}`,
    { headers: AUTH_HEADER }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}
