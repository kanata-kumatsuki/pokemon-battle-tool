import { useRef, useState } from "react";
import { parsePointInput } from "./point-input";

export function PointInput({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<{ text: string; value: number } | null>(
    null,
  );
  const composing = useRef(false);
  const text = draft?.value === value ? draft.text : String(value);
  const accept = (raw: string) => {
    const next = parsePointInput(raw, max);
    if (next === null) {
      setDraft(null);
      return;
    }
    setDraft({ text: raw.trim() === "" ? "" : String(next), value: next });
    onChange(next);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      role="spinbutton"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      autoComplete="off"
      value={text}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        if (composing.current) {
          setDraft({ text: event.currentTarget.value, value });
        } else {
          accept(event.currentTarget.value);
        }
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        accept(event.currentTarget.value);
      }}
      onBlur={(event) => {
        composing.current = false;
        const next = parsePointInput(event.currentTarget.value, max);
        setDraft(null);
        if (next !== null) onChange(next);
      }}
      onKeyDown={(event) => {
        if (composing.current || event.nativeEvent.isComposing) return;
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          accept(
            String(Math.max(0, value + (event.key === "ArrowUp" ? 1 : -1))),
          );
        }
      }}
    />
  );
}
