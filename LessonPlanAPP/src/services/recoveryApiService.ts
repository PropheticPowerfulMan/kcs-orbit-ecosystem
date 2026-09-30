const configuredApiUrl = (import.meta.env.VITE_RECOVERY_API_URL as string | undefined)?.replace(/\/$/, "");

export const recoveryApiService = {
  enabled: Boolean(configuredApiUrl),
  async send(email: string) {
    if (!configuredApiUrl) throw new Error("The recovery mail service is not configured.");
    const response = await fetch(configuredApiUrl + "/auth/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });
    const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to send the recovery email.");
    return data.message || "If this account exists, a recovery email has been sent.";
  }
};