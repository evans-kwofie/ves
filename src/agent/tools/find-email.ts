export interface FindEmailResult {
  email: string | null;
  confidence: number;
  status: "verified" | "accept_all" | "not_found";
}

/** Verifies an existing address before sending. Returns null when Hunter is unavailable or still resolving. */
export async function verifyEmail(email: string): Promise<Pick<FindEmailResult, "status" | "confidence"> | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({ email: email.trim(), api_key: apiKey });
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`);
    if (!res.ok) return null;
    const json = await res.json() as { data?: { status?: string; score?: number } };
    const status = json.data?.status;
    const confidence = Number(json.data?.score ?? 0);
    if (status === "valid" || status === "webmail") return { status: "verified", confidence };
    if (status === "accept_all") return { status: "accept_all", confidence };
    if (status === "invalid" || status === "disposable") return { status: "not_found", confidence };
    return null;
  } catch {
    return null;
  }
}

/**
 * Uses Hunter.io to find a verified email for a person at a given domain.
 * Falls back to null rather than guessing — a missing email is better than a wrong one.
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string,
): Promise<FindEmailResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    return { email: null, confidence: 0, status: "not_found" };
  }

  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "");

  if (!cleanDomain || cleanDomain.includes("placeholder") || cleanDomain.includes("reddit.com")) {
    return { email: null, confidence: 0, status: "not_found" };
  }

  try {
    const params = new URLSearchParams({
      domain: cleanDomain,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      api_key: apiKey,
    });

    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    if (!res.ok) return { email: null, confidence: 0, status: "not_found" };

    const json = (await res.json()) as {
      data?: { email?: string | null; score?: number; confidence?: string };
    };

    const email = json.data?.email ?? null;
    const score = json.data?.score ?? 0;
    const confidence = json.data?.confidence;

    if (!email) return { email: null, confidence: 0, status: "not_found" };

    return {
      email,
      confidence: score,
      status: confidence === "accept_all" ? "accept_all" : "verified",
    };
  } catch {
    return { email: null, confidence: 0, status: "not_found" };
  }
}

/** Split a full name into first/last for Hunter queries. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
}
