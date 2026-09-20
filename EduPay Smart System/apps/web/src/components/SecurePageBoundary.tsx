import { Component, type ErrorInfo, type ReactNode } from 'react';

export class SecurePageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('EduPay page render failed', error, info); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className='flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white'>
        <section className='glass w-full max-w-xl rounded-2xl border border-red-400/30 p-7 text-center shadow-2xl'>
          <p className='text-xs font-black uppercase tracking-[0.18em] text-red-300'>Protection anti-écran vide</p>
          <h1 className='mt-3 font-display text-2xl font-bold'>Cette page EduPay n’a pas pu être affichée.</h1>
          <p className='mt-3 text-sm text-ink-dim'>Aucune opération financière n’est modifiée. Rechargez la version sécurisée.</p>
          <button type='button' className='btn-primary mt-6 px-5 py-3 font-bold' onClick={() => window.location.reload()}>Recharger en toute sécurité</button>
        </section>
      </main>
    );
  }
}
