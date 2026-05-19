import { createFileRoute } from "@tanstack/react-router";

import HeroCard from "../../components/HeroCard.tsx";

export const Route = createFileRoute("/services/$serviceId")({
  component: ServicePage,
});

function ServicePage(): React.ReactElement {
  const { serviceId } = Route.useParams();

  return (
    <section className="service">
      <HeroCard
        title={`Service ${serviceId}`}
        subtitle="Pins dropped here are shared across every service id (route: /services/$serviceId)."
      />
      <article className="card">
        <h2 className="card-title">Overview</h2>
        <p>
          This page demonstrates dynamic-route comment sharing. The URL is{" "}
          <code>/services/{serviceId}</code>, but the underlying route pattern is{" "}
          <code>/services/$serviceId</code>. Threads created on any service id show up on every
          other service id because the runtime stores the route pattern, not the literal URL.
        </p>
      </article>
      <ul className="features">
        <li className="feature">Provisioning</li>
        <li className="feature">Billing</li>
        <li className="feature">Audit log</li>
      </ul>
      <style>{`
        .service { display: flex; flex-direction: column; gap: 24px; }
        .card { padding: 16px 20px; border: 1px solid var(--border); border-radius: 12px; background: var(--code-bg); }
        .card-title { margin: 0 0 8px; color: var(--text-h); }
        .features { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
        .feature { padding: 12px 16px; background: var(--code-bg); border-radius: 8px; }
      `}</style>
    </section>
  );
}
