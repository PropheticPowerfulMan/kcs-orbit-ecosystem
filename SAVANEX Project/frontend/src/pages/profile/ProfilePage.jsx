import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Save, UserRound } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const emptyIdentity = { first_name: '', middle_name: '', last_name: '', email: '', phone: '' };
const emptyPasswords = { oldPassword: '', newPassword: '', confirmPassword: '' };

const PasswordInput = ({ label, value, onChange, visible, onToggle, autoComplete }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    <span className="relative block">
      <input type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 pr-11 text-sm text-slate-100 focus:border-kcs-blue focus:outline-none focus:ring-2 focus:ring-kcs-blue/20" />
      <button type="button" onClick={onToggle} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-sky-200" aria-label={visible ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  </label>
);

const ProfilePage = () => {
  const storedUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [identity, setIdentity] = useState(emptyIdentity);
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [visible, setVisible] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [loading, setLoading] = useState(true);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    authService.getProfile().then((profile) => {
      setIdentity({ first_name: profile.first_name || '', middle_name: profile.middle_name || '', last_name: profile.last_name || '', email: profile.email || '', phone: profile.phone || '' });
      updateUser(profile);
    }).catch(() => setError('Impossible de charger le profil.')).finally(() => setLoading(false));
  }, [updateUser]);

  const updateIdentityField = (field) => (event) => setIdentity((current) => ({ ...current, [field]: event.target.value }));
  const updatePasswordField = (field) => (event) => setPasswords((current) => ({ ...current, [field]: event.target.value }));
  const toggleVisibility = (field) => setVisible((current) => ({ ...current, [field]: !current[field] }));

  const saveIdentity = async (event) => {
    event.preventDefault(); setSavingIdentity(true); setError(''); setIdentityMessage('');
    try { const profile = await authService.updateProfile(identity); updateUser(profile); setIdentityMessage('Identité enregistrée avec succès.'); }
    catch (requestError) { setError(requestError?.response?.data?.detail || 'Enregistrement impossible. Vérifiez les informations.'); }
    finally { setSavingIdentity(false); }
  };

  const savePassword = async (event) => {
    event.preventDefault(); setError(''); setPasswordMessage('');
    if (passwords.newPassword !== passwords.confirmPassword) { setError('Les nouveaux mots de passe ne correspondent pas.'); return; }
    setSavingPassword(true);
    try { await authService.changePassword(passwords.oldPassword, passwords.newPassword); setPasswords(emptyPasswords); updateUser({ ...storedUser, must_change_password: false, password_generated_by_system: false }); setPasswordMessage('Mot de passe modifié avec succès.'); }
    catch (requestError) { const data=requestError?.response?.data; setError(data?.old_password?.[0] || data?.new_password?.[0] || data?.detail || 'Modification du mot de passe impossible.'); }
    finally { setSavingPassword(false); }
  };

  return <DashboardLayout>
    <div className="mx-auto max-w-5xl space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Administration</p><h2 className="mt-2 font-display text-3xl font-bold text-slate-50">Mon profil</h2><p className="mt-2 text-sm text-slate-400">Renseignez votre identité et sécurisez votre compte.</p></div>
      {storedUser?.must_change_password && <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm text-amber-100">Votre mot de passe est temporaire. Modifiez-le maintenant.</div>}
      {error && <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
      {loading ? <div className="card p-6 text-slate-300">Chargement du profil...</div> : <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveIdentity} className="card space-y-4 p-6">
          <div className="flex items-center gap-3"><UserRound className="text-sky-300"/><div><h3 className="font-display text-xl font-bold text-slate-100">Identité</h3><p className="text-xs text-slate-400">Ces informations personnalisent votre accueil.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs text-slate-400">Nom</span><input value={identity.last_name} onChange={updateIdentityField('last_name')} required className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-slate-100"/></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-400">Postnom</span><input value={identity.middle_name} onChange={updateIdentityField('middle_name')} className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-slate-100"/></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-400">Prénom</span><input value={identity.first_name} onChange={updateIdentityField('first_name')} required className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-slate-100"/></label>
            <label className="block"><span className="mb-1 block text-xs text-slate-400">Téléphone</span><input value={identity.phone} onChange={updateIdentityField('phone')} type="tel" className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-slate-100"/></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs text-slate-400">Email</span><input value={identity.email} onChange={updateIdentityField('email')} type="email" required className="w-full rounded-xl border border-github-border bg-slate-950/55 px-3 py-2 text-slate-100"/></label>
          {identityMessage && <p className="text-sm text-emerald-300">{identityMessage}</p>}
          <button disabled={savingIdentity} className="flex w-full items-center justify-center gap-2 rounded-xl bg-kcs-blue px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"><Save size={16}/>{savingIdentity ? 'Enregistrement...' : 'Enregistrer mon identité'}</button>
        </form>
        <form onSubmit={savePassword} className="card space-y-4 p-6">
          <div className="flex items-center gap-3"><KeyRound className="text-emerald-300"/><div><h3 className="font-display text-xl font-bold text-slate-100">Mot de passe</h3><p className="text-xs text-slate-400">Utilisez au moins 8 caractères.</p></div></div>
          <PasswordInput label="Mot de passe actuel" value={passwords.oldPassword} onChange={updatePasswordField('oldPassword')} visible={visible.oldPassword} onToggle={() => toggleVisibility('oldPassword')} autoComplete="current-password" />
          <PasswordInput label="Nouveau mot de passe" value={passwords.newPassword} onChange={updatePasswordField('newPassword')} visible={visible.newPassword} onToggle={() => toggleVisibility('newPassword')} autoComplete="new-password" />
          <PasswordInput label="Confirmer le nouveau mot de passe" value={passwords.confirmPassword} onChange={updatePasswordField('confirmPassword')} visible={visible.confirmPassword} onToggle={() => toggleVisibility('confirmPassword')} autoComplete="new-password" />
          {passwordMessage && <p className="text-sm text-emerald-300">{passwordMessage}</p>}
          <button disabled={savingPassword} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"><KeyRound size={16}/>{savingPassword ? 'Modification...' : 'Changer le mot de passe'}</button>
        </form>
      </div>}
    </div>
  </DashboardLayout>;
};

export default ProfilePage;