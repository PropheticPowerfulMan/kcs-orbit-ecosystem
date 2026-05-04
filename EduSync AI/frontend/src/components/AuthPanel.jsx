import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { schoolLogo } from "../assets";

const roles = ["admin", "teacher", "staff"];
const demoCredentials = {
  email: "admin@school.edu",
  password: "Admin@123",
};

export default function AuthPanel() {
  const { login, register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "teacher",
    department: "Academics",
  });

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const fillDemoCredentials = () => {
    setMode("login");
    setForm((prev) => ({
      ...prev,
      email: demoCredentials.email,
      password: demoCredentials.password,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await register(form);
      }
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-shell">
      <button type="button" className="theme-toggle auth-theme-toggle" onClick={toggleTheme}>
        {isDark ? "Light mode" : "Dark mode"}
      </button>
      <div className="auth-hero">
        <img src={schoolLogo} alt="Kinshasa Christian School" className="school-logo large" />
        <p className="eyebrow">Kinshasa Christian School</p>
        <h1>EduSync AI</h1>
        <p>
          School communication platform for announcements, workflows,
          notifications, and administration reports.
        </p>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-head">
          <img src={schoolLogo} alt="" className="school-logo" />
          <div>
            <p className="eyebrow">{mode === "login" ? "Sign in" : "Create account"}</p>
            <h2>{mode === "login" ? "Open the portal" : "Create access"}</h2>
          </div>
        </div>
        <p className="subtle">Use your KCS credentials to open the dashboard.</p>

        {mode === "login" && (
          <button type="button" className="credential-chip" onClick={fillDemoCredentials}>
            Fill admin@school.edu / Admin@123
          </button>
        )}

        {mode === "register" && (
          <input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            required
          />
        )}

        <input
          type="email"
          placeholder="School email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => updateField("password", e.target.value)}
          required
        />

        {mode === "register" && (
          <>
            <select value={form.role} onChange={(e) => updateField("role", e.target.value)}>
              {roles.map((role) => (
                <option value={role} key={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              placeholder="Department"
              value={form.department}
              onChange={(e) => updateField("department", e.target.value)}
              required
            />
          </>
        )}

        {error && <p className="error-text">{error}</p>}

        <button disabled={busy} type="submit">
          {busy ? "Processing..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </form>
    </section>
  );
}
