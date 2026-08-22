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
  const { login, register, forgotPassword } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
    setMessage("");
    setBusy(true);
    try {
      if (mode === "recovery") {
        const result = await forgotPassword(form.email);
        setMessage(result.message);
        return;
      }
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
            <p className="eyebrow">{mode === "recovery" ? "Password recovery" : mode === "login" ? "Sign in" : "Create account"}</p>
            <h2>{mode === "recovery" ? "Recover access" : mode === "login" ? "Open the portal" : "Create access"}</h2>
          </div>
        </div>
        <p className="subtle">{mode === "recovery" ? "Enter the email attached to your school account." : "Use your school email or shared access code to open the dashboard."}</p>

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
          type="text"
          placeholder={mode === "recovery" ? "School email" : "School email or access code"}
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          required
        />
        {mode !== "recovery" && (
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            required
          />
        )}

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
        {message && <p className="success-text">{message}</p>}

        <button disabled={busy} type="submit">
          {busy ? "Processing..." : mode === "recovery" ? "Send reset link" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        {mode === "login" && (
          <button type="button" className="secondary" onClick={() => { setMode("recovery"); setError(""); setMessage(""); }}>
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={() => { setMode((prev) => (prev === "login" ? "register" : "login")); setError(""); setMessage(""); }}
        >
          {mode === "login" ? "Need an account? Register" : "Back to sign in"}
        </button>
      </form>
    </section>
  );
}
