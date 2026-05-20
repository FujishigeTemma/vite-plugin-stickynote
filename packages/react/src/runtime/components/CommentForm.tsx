import { useRef, useState } from "react";

type Props = {
  initialBody?: string;
  submitLabel?: string;
  cancelable?: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
};

export default function CommentForm(props: Props): React.ReactElement {
  const [body, setBody] = useState(props.initialBody ?? "");
  const formRef = useRef<HTMLFormElement | null>(null);

  const submit = (): void => {
    const text = body.trim();
    if (!text) return;
    props.onSubmit(text);
    setBody("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form
      ref={formRef}
      className="sn-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={body}
        placeholder="Write a comment…"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="sn-form-actions">
        {props.cancelable ? (
          <button type="button" onClick={() => props.onCancel?.()}>
            cancel
          </button>
        ) : null}
        <button type="submit" className="sn-primary" disabled={!body.trim()}>
          {props.submitLabel ?? "Reply"}
        </button>
      </div>
    </form>
  );
}
