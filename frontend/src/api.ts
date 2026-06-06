const BASE_URL = "http://localhost:8000";

export interface Category {
  id: number;
  name: string;
  description: string;
}

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

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/consent/categories`);
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export async function submitConsent(
  user_identifier: string,
  domain: string,
  decisions: Decision[]
): Promise<ConsentRecord> {
  const res = await fetch(`${BASE_URL}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_identifier, domain, decisions }),
  });
  if (!res.ok) throw new Error("Failed to submit consent");
  return res.json();
}

export async function fetchLatest(
  user_identifier: string,
  domain: string
): Promise<ConsentRecord | null> {
  const res = await fetch(
    `${BASE_URL}/consent/latest?user_identifier=${encodeURIComponent(user_identifier)}&domain=${encodeURIComponent(domain)}`
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
    `${BASE_URL}/consent/history?user_identifier=${encodeURIComponent(user_identifier)}&domain=${encodeURIComponent(domain)}`
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}
