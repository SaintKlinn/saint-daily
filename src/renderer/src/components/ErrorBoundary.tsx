import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Filet de sécurité : une erreur non rattrapée dans le rendu ou un effet
// d'un composant enfant (ex: variables d'env Supabase manquantes, pont IPC
// absent) faisait auparavant disparaître toute l'app — écran noir vide,
// aucun message. Affiche un message exploitable à la place.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non rattrapée :', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-ink-900 p-8 text-center text-champagne">
          <p className="font-serif text-xl">Une erreur est survenue</p>
          <p className="max-w-md text-sm text-muted">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
