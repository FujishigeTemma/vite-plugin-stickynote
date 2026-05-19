type Props = { title: string; subtitle: string };

export default function HeroCard(props: Props): React.ReactElement {
  return (
    <header className="hero">
      <h1 className="title">{props.title}</h1>
      <p className="subtitle">{props.subtitle}</p>
      <style>{`
        .hero { padding: 24px; border: 1px solid var(--border); border-radius: 12px; background: var(--accent-bg); }
        .title { margin: 0 0 8px; color: var(--text-h); }
        .subtitle { margin: 0; }
      `}</style>
    </header>
  );
}
