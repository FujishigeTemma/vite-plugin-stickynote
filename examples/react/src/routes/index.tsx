import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import Counter from "../components/Counter.tsx";
import HeroCard from "../components/HeroCard.tsx";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage(): React.ReactElement {
  const [items] = useState(["First note", "Second note", "Third note"]);

  return (
    <section className="home">
      <HeroCard title="stickynote react demo" subtitle="Press ⌘/Ctrl + . to toggle the overlay." />
      <Counter />
      <ul className="notes">
        {items.map((item) => (
          <li key={item} className="note">
            {item}
          </li>
        ))}
      </ul>
      <style>{`
        .home { display: flex; flex-direction: column; gap: 24px; }
        .notes { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
        .note { padding: 12px 16px; background: var(--code-bg); border-radius: 8px; }
      `}</style>
    </section>
  );
}
