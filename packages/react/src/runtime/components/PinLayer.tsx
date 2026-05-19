import { useThreadsList } from "../hooks/useThreadsList.ts";
import Pin from "./Pin.tsx";

export default function PinLayer(): React.ReactElement {
  const { visible } = useThreadsList();
  return (
    <>
      {visible.map((thread) => (
        <Pin key={thread.id} thread={thread} />
      ))}
    </>
  );
}
