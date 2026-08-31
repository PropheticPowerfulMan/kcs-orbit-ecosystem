import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { schoolLogo } from "../assets";

export default function AuthPanel() {
  const { login, forgotPassword } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryChannel, setRecoveryChannel] = useState("email");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "recovery") {
        const result = await forgotPassword(identifier.trim(), recoveryChannel);
        setMessage(result.message);
      } else {
        await login(identifier.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete this request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="edusync-login">
      <button type="button" className="edusync-login-theme" onClick={toggleTheme} aria-label={isDark ? "Use light theme" : "Use dark theme"}>
        <span aria-hidden="true">{isDark ? "Light" : "Dark"}</span>
      </button>

      <section className="edusync-login-brand" aria-label="EduSync introduction">
        <div className="edusync-login-brandmark">
          <img src={schoolLogo} alt="Kinshasa Christian School" />
          <div><span>Kinshasa Christian School</span><strong>EduSync</strong></div>
        </div>
        <div className="edusync-login-copy">
          <p className="edusync-login-kicker">Connected school operations</p>
          <h1>One secure space for your school day.</h1>
          <p>Access communications, workflows, notifications and institutional reports with your official KCS account.</p>
        </div>
        <div className="edusync-login-trust">
          <span>Secure institutional access</span>
          <span>Authorized users only</span>
        </div>
      </section>

      <section className="edusync-login-access">
        <form className="edusync-login-card" onSubmit={handleSubmit} autoComplete="off">
          <div className="edusync-login-mobile-brand">
            <img src={schoolLogo} alt="" />
            <span>EduSync</span>
          </div>
          <header>
            <div className="edusync-login-secure"><span aria-hidden="true">✓</span> KCS verified workspace</div>
            <p>{mode === "login" ? "Welcome back" : "Account recovery"}</p>
            <h2>{mode === "login" ? "Sign in to EduSync" : "Recover your access"}</h2>
            <span>{mode === "login" ? "Enter the credentials issued by Kinshasa Christian School." : "Choose a recovery channel and enter your institutional email."}</span>
          </header>

          <label className="edusync-login-field">
            <span>{mode === "login" ? "Institutional identifier" : "Institutional email"}</span>
            <input name="edusync-institutional-identifier" type={mode === "recovery" ? "email" : "text"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={mode === "login" ? "Email or access code" : "name@ourkcs.org"} autoComplete="off" data-lpignore="true" data-1p-ignore="true" autoCapitalize="none" spellCheck="false" required autoFocus />
          </label>

          {mode === "login" ? (
            <label className="edusync-login-field">
              <span>Password</span>
              <div className="edusync-login-password">
                <input name="edusync-secure-access-key" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" required />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </div>
            </label>
          ) : (
            <div className="edusync-login-channels" role="group" aria-label="Recovery channel">
              <button type="button" className={recoveryChannel === "email" ? "active" : ""} onClick={() => setRecoveryChannel("email")}>Email</button>
              <button type="button" className={recoveryChannel === "sms" ? "active" : ""} onClick={() => setRecoveryChannel("sms")}>SMS</button>
            </div>
          )}

          {error && <p className="edusync-login-alert error" role="alert">{error}</p>}
          {message && <p className="edusync-login-alert success" role="status">{message}</p>}
          <button className="edusync-login-submit" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "login" ? "Sign in securely" : "Send temporary password"}</button>
          <button type="button" className="edusync-login-link" onClick={() => changeMode(mode === "login" ? "recovery" : "login")}>{mode === "login" ? "Forgot your password?" : "Back to sign in"}</button>
          <footer>Need help? Contact the KCS administration. Accounts are created and managed by authorized school personnel.</footer>
        </form>
      </section>
    </main>
  );
}
