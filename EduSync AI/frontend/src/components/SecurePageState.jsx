import { Component } from 'react';

export function SecurePageLoader() {
  return (
    <main className='edusync-secure-page-state' role='status' aria-live='polite'>
      <section className='edusync-secure-page-card'>
        <span className='edusync-secure-page-spinner' aria-hidden='true' />
        <strong>Chargement sécurisé de la page…</strong>
        <small>Secure KCS workspace verification in progress.</small>
      </section>
    </main>
  );
}

export class SecurePageBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('EduSync page render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className='edusync-secure-page-state'>
        <section className='edusync-secure-page-card edusync-secure-page-error'>
          <strong>Affichage sécurisé interrompu</strong>
          <small>Les données sont intactes. Rechargez la version vérifiée de la page.</small>
          <button type='button' onClick={() => window.location.reload()}>Recharger en toute sécurité</button>
        </section>
      </main>
    );
  }
}
