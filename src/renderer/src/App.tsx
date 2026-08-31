import LogoMark from './components/LogoMark';

export default function App() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-ink-900 text-champagne">
      <LogoMark size={64} />
      <p className="font-serif text-2xl">Saint Daily</p>
    </div>
  );
}
