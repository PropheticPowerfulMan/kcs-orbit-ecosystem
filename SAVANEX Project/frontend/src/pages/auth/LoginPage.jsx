import React, { useState } from 'react';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            <p className="font-semibold text-sky-200">Mode demo</p>
            <p className="mt-1">Identifiant: <span className="font-mono text-slate-100">admin</span></p>
            <p>Mot de passe: <span className="font-mono text-slate-100">admin123</span></p>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">{t('auth.username')}</label>
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-sm text-slate-100 backdrop-blur focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20"
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
            onClick={enterDemo}
            disabled={loading}
            className="w-full rounded-xl border border-github-border bg-slate-900/55 px-4 py-2 font-semibold text-slate-100 transition hover:border-kcs-blue/50 hover:text-sky-200 disabled:opacity-50"
          >
            Entrer en demo
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
