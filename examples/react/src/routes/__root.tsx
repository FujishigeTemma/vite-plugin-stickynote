import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): React.ReactElement {
  return (
    <div className="app">
      <nav className="nav">
        <Link to="/" className="nav-link" activeProps={{ className: "nav-link active" }}>
          Home
        </Link>
        <Link to="/about" className="nav-link" activeProps={{ className: "nav-link active" }}>
          About
        </Link>
        <Link
          to="/services/$serviceId"
          params={{ serviceId: "001" }}
          className="nav-link"
          activeProps={{ className: "nav-link active" }}
        >
          Service 001
        </Link>
        <Link
          to="/services/$serviceId"
          params={{ serviceId: "002" }}
          className="nav-link"
          activeProps={{ className: "nav-link active" }}
        >
          Service 002
        </Link>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
