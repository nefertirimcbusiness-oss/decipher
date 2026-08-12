const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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

  saveSession(token: string, userId: string) {
    setToken(token);
    localStorage.setItem("decipher_userId", userId);
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
      data.files.forEach((f) => formData.append("files", f));
      return request<Entry>("/entries", { method: "POST", body: formData });
    }
    return request<Entry>("/entries", {
      method: "POST",
      body: JSON.stringify({ title: data.title, content: data.content }),
    });
  },

  update(id: string, data: { title?: string; content?: string; reason: string }) {
    return request<Entry>(`/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
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

export const subscription = {
  getStatus() {
    return request<{ plan: string; status: string; nextBilling: string; trialEnd: string }>("/subscriptions");
  },

  createPaymentMethod(paymentMethodId: string) {
    return request<{ success: boolean }>("/subscriptions/payment-method", {
      method: "POST",
      body: JSON.stringify({ paymentMethodId }),
    });
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