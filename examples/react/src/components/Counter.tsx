import { useState } from "react";

export default function Counter(): React.ReactElement {
  const [count, setCount] = useState(0);
  return (
    <button className="counter" type="button" onClick={() => setCount((n) => n + 1)}>
      Count is {count}
      <style>{`
        .counter {
          align-self: flex-start;
          padding: 10px 18px;
          font-family: var(--mono);
          font-size: 16px;
          border-radius: 8px;
          border: 1px solid var(--accent-border);
          background: transparent;
          color: var(--accent);
          cursor: pointer;
        }
        .counter:hover { background: var(--accent-bg); }
      `}</style>
    </button>
  );
}
