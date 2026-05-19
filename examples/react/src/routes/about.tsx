import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage(): React.ReactElement {
  return (
    <section className="about">
      <h1>About</h1>
      <p>
        This page is just here to exercise route-aware threads. Drop pins on any element and they
        will only show on this route.
      </p>
      <style>{`.about { display: flex; flex-direction: column; gap: 12px; }`}</style>
    </section>
  );
}
