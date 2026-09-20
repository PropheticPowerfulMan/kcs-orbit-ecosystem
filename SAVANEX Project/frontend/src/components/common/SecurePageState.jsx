import React, { Component } from 'react';

export const SecurePageLoader = () => (
  <div className='flex min-h-[42vh] items-center justify-center px-4' role='status' aria-live='polite'>
    <section className='w-full max-w-sm rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-6 py-5 text-center shadow-2xl backdrop-blur-xl'>
      <div className='mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-100/20 border-t-cyan-300' />
      <p className='mt-4 text-sm font-black uppercase tracking-[0.16em] text-cyan-100'>Chargement sécurisé de la page…</p>
      <p className='mt-2 text-xs text-slate-300'>Vérification de la session et des données officielles KCS.</p>
    </section>
  </div>
);

export class SecurePageBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Savanex page render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className='flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100'>
        <section className='w-full max-w-xl rounded-2xl border border-red-400/30 bg-slate-900 p-6 text-center shadow-2xl'>
          <p className='text-xs font-black uppercase tracking-[0.18em] text-red-300'>Protection anti-écran vide</p>
          <h1 className='mt-3 text-2xl font-black'>Cette page n’a pas pu être affichée correctement.</h1>
          <p className='mt-3 text-sm text-slate-300'>Vos données ne sont pas supprimées. Rechargez la version sécurisée de l’application.</p>
          <button type='button' className='mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950' onClick={() => window.location.reload()}>
            Recharger en toute sécurité
          </button>
        </section>
      </main>
    );
  }
}
