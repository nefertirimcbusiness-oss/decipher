// Public base URL of the Decipher API. `NEXT_PUBLIC_API_URL` is inlined at build
// time (it is a Vercel project env var); the fallback below is what a build uses
// when that var is missing, so it must always name the backend that is actually
// serving requests. A retired hostname here is not a build error — it silently
// breaks every call at runtime, which is exactly how the app was down for weeks
// on a dead `...-dev.ctonew.app` host. `scripts/deploy.sh` now proves this
// fallback answers `/health` before a deploy is allowed to pass.
const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "https://eb044699c4cc4dada8cc7727a5002ea2-dev.cto.site/api"
).replace(/\/+$/, "");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("decipher_token");
}

function setToken(token: string) {
  localStorage.setItem("decipher_token", token);
}

function clearToken() {
  localStorage.removeItem("decipher_token");
  localStorage.removeItem("decipher_userId");
  localStorage.removeItem("decipher_email");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (let browser set it)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// --- Auth API ---

export const auth = {
  signup(email: string, password: string, name: string) {
    return request<{ token: string; userId: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },

  login(email: string, password: string) {
    return request<{ token: string; userId: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  saveSession(token: string, userId: string, email?: string) {
    setToken(token);
    localStorage.setItem("decipher_userId", userId);
    if (email) localStorage.setItem("decipher_email", email);
  },

  logout() {
    clearToken();
  },

  getToken,
  getUserId: () => typeof window !== "undefined" ? localStorage.getItem("decipher_userId") : null,
  isAuthenticated: () => !!getToken(),
};

// --- Entries API ---

export interface Entry {
  id: string;
  title: string;
  content: string;
  date: string;
  emotion?: string;
  evidence?: { name: string; type: string; url: string }[];
  savidConversation?: { role: string; message: string }[];
  editHistory?: { date: string; reason: string; isOriginal: boolean }[];
}

export const entries = {
  list() {
    return request<Entry[]>("/entries");
  },

  get(id: string) {
    return request<Entry>(`/entries/${id}`);
  },

  create(data: { title: string; content: string; files?: File[] }) {
    if (data.files && data.files.length > 0) {
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("content", data.content);
      // The field name is the API's contract: multer reads `upload.array("evidence")`.
      // Anything else is an unexpected field, which multer reports as a 500 — every
      // entry created with a file attached failed until this matched.
      data.files.forEach((f) => formData.append("evidence", f));
      return request<Entry>("/entries", { method: "POST", body: formData });
    }
    return request<Entry>("/entries", {
      method: "POST",
      body: JSON.stringify({ title: data.title, content: data.content }),
    });
  },

  // The API defines `PUT /entries/:id` (and only PUT). A PATCH here hit no route at
  // all, so every edit made from the app 404'd — and with it the promise that an
  // edit is only allowed with a logged reason, because the reason never arrived.
  update(id: string, data: { title?: string; content?: string; reason: string }) {
    return request<Entry>(`/entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// --- Export API ("Save my scrapbook") ---
//
// The privacy policy promises a portable copy of a user's data, so this is the
// mechanism behind that promise: one JSON file with the account, every entry,
// the evidence files themselves (base64, with a sha256 of each), the edit log
// with its reasons, and the Savid conversations. The server decides whose data
// this is from the bearer token alone — there is no user id to pass.

export interface ExportResult {
  filename: string;
  bytes: number;
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}

export const exportData = {
  async download(): Promise<ExportResult> {
    const token = getToken();
    if (!token) throw new Error("Please sign in again to save your scrapbook.");

    const res = await fetch(`${API_BASE}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `Request failed: ${res.status}`);
    }

    const blob = await res.blob();
    const filename =
      filenameFromDisposition(res.headers.get("Content-Disposition")) ||
      `decipher-scrapbook-${new Date().toISOString().slice(0, 10)}.json`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before the blob goes away.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { filename, bytes: blob.size };
  },
};

// --- Savid API ---

export const savid = {
  chat(entryId: string, message: string) {
    return request<{ reply: string }>("/savid/chat", {
      method: "POST",
      body: JSON.stringify({ entryId, message }),
    });
  },
};

// --- Subscription API ---

export interface SubscriptionStatus {
  plan: string;
  status: string;
  nextBilling: string;
  trialEnd: string;
}

export const subscription = {
  getStatus(): Promise<SubscriptionStatus> {
    // Backend returns a raw subscription row (plan_id, current_period_end,
    // trial_end) or `{ status: "inactive" }` — normalize to a stable shape.
    return request<Record<string, any>>("/subscriptions/status").then((s) => ({
      plan: s.plan_id || s.plan || "Decipher Monthly",
      status: s.status || "inactive",
      nextBilling: s.current_period_end || s.nextBilling || "",
      trialEnd: s.trial_end || s.trialEnd || "",
    }));
  },

  createCheckout() {
    return request<{ checkoutUrl: string }>("/subscriptions/create", {
      method: "POST",
    });
  },

  cancel() {
    return request<{ success: boolean }>("/subscriptions/cancel", {
      method: "POST",
    });
  },
};