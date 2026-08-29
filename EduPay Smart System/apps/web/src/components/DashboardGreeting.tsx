import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuthStore } from "../store/auth";
import { buildTimeGreeting } from "../utils/userGreeting";

const DASHBOARD_PATHS = new Set(["/", "/parent", "/employee"]);

export function DashboardGreeting() {
  const location = useLocation();
  const { lang } = useI18n();
  const { fullName, role } = useAuthStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (role === "FINANCIAL_MANAGER" || !DASHBOARD_PATHS.has(location.pathname)) {
    return null;
  }

  return (
    <section className="mb-4 rounded-2xl border border-brand-300/20 bg-gradient-to-r from-brand-500/10 to-cyan-400/5 px-5 py-4 shadow-lg">
      <p className="font-display text-xl font-bold text-white sm:text-2xl">
        {buildTimeGreeting(fullName, lang, now)}
      </p>
    </section>
  );
}
