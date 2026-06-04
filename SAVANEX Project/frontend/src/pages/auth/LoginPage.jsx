import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import SchoolLogo from '../../components/ui/SchoolLogo';

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ username: '', password: '' });
  const [resetForm, setResetForm] = useState({ email: '', uid: '', token: '', password: '' });
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const token = params.get('resetToken');
    if (uid && token) {
      setResetForm((prev) => ({ ...prev, uid, token }));
      setResetOpen(true);
    }
  }, []);

  const enterDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.demoLogin();
      setAuth({ access: data.access, refresh: data.refresh, user: data.user });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.login(form.username, form.password);
      setAuth({ access: data.access, refresh: data.refresh, user: data.user });
      navigate('/dashboard');
    } catch (err) {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const onResetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      if (resetForm.uid && resetForm.token) {
        await authService.resetPassword(resetForm.uid, resetForm.token, resetForm.password);
        setResetMessage('Mot de passe reinitialise. Vous pouvez vous connecter.');
        setResetForm({ email: resetForm.email, uid: '', token: '', password: '' });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        await authService.forgotPassword(resetForm.email || form.username);
        setResetMessage('Si ce compte existe, un lien securise a ete envoye.');
      }
    } catch (err) {
      setResetError(err?.response?.data?.detail || 'Recuperation temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 page-enter">
        <div className="flex flex-col items-center text-center">
          <SchoolLogo size="lg" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-kcs-blue">Kinshasa Christian School</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-slate-50">{t('app.title')}</h1>
          <p className="mt-2 text-sm text-slate-400">{t('auth.signInSubtitle')}</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="rounded-xl border border-kcs-blue/25 bg-kcs-blue/10 px-3 py-2 text-left text-xs text-slate-300">
            <p className="font-semibold text-sky-200">Connexion réelle locale</p>
            <p className="mt-1">Identifiant: <span className="font-mono text-slate-100">admin</span></p>
            <p>Mot de passe: <span className="font-mono text-slate-100">admin123</span></p>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Identifiant ou code d'accès</label>
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 backdrop-blur focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
              placeholder="Nom d'utilisateur, email ou code d'accès"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">{t('auth.password')}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 backdrop-blur focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
              required
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-kcs-blue/40 bg-kcs-blue px-4 py-2 font-semibold text-slate-950 shadow-glass transition hover:bg-sky-300 disabled:opacity-50"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetForm((prev) => ({ ...prev, email: form.username }));
              setResetOpen((current) => !current);
              setResetError('');
              setResetMessage('');
            }}
            className="w-full text-sm font-semibold text-sky-200 transition hover:text-sky-100"
          >
            Mot de passe oublie ?
          </button>

          {resetOpen && (
            <div className="rounded-xl border border-github-border bg-slate-950/55 p-4 text-left">
              <form className="space-y-3" onSubmit={onResetSubmit}>
                <input
                  value={resetForm.email}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
                  placeholder="Email du compte"
                />
                <input
                  value={resetForm.uid}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, uid: e.target.value }))}
                  className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
                  placeholder="UID du lien de reset"
                />
                <input
                  value={resetForm.token}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, token: e.target.value }))}
                  className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
                  placeholder="Token du lien de reset"
                />
                <input
                  type="password"
                  value={resetForm.password}
                  onChange={(e) => setResetForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
                  placeholder="Nouveau mot de passe"
                />
                {resetMessage && <p className="text-sm text-emerald-300">{resetMessage}</p>}
                {resetError && <p className="text-sm text-rose-400">{resetError}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl border border-kcs-blue/40 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-kcs-blue/70 disabled:opacity-50"
                >
                  Continuer la recuperation
                </button>
              </form>
            </div>
          )}

          <button
            type="button"
            onClick={enterDemo}
            disabled={loading}
            className="w-full rounded-xl border border-github-border bg-slate-900/55 px-4 py-2 font-semibold text-slate-100 transition hover:border-kcs-blue/50 hover:text-sky-200 disabled:opacity-50"
          >
            Entrer en démo sans enregistrement
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
