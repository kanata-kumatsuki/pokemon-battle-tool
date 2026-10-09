import { useId } from "react";
import { type Pokemon } from "./data";
import { itemOptions } from "./item-options";
import { useBattleUsage } from "./useBattleUsage";

export function ItemSelect({
  pokemon,
  value,
  onChange,
  label,
}: {
  pokemon: Pokemon;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const hintId = useId();
  const orderId = useId();
  const data = useBattleUsage(pokemon.mega ? undefined : pokemon.speciesId);
  const { options, hasUsage, usePercent } = itemOptions(
    pokemon,
    data.entry?.data,
    data.index?.data,
  );
  const unavailable = !options.some((item) => item.name === value);
  const hint = unavailable
    ? "保存済みのもちものは対象外です。選び直してください。"
    : pokemon.mega
      ? "メガフォームは進化後として計算するため、追加のもちものは選べません。"
      : undefined;
  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={data.refresh}
        aria-label={label ?? "もちもの"}
        aria-describedby={
          [hint && hintId, !pokemon.mega && orderId]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {unavailable && (
          <option value={value} disabled>
            {value}（対象外）
          </option>
        )}
        {options.map(({ name, usage }) => (
          <option key={name} value={name}>
            {name}
            {usage
              ? usage.percent !== null
                ? `（${usage.percent}%）`
                : `（採用${usage.rank}位）`
              : ""}
          </option>
        ))}
      </select>
      {hint && <small id={hintId}>{hint}</small>}
      {!pokemon.mega && (
        <small id={orderId}>
          {hasUsage
            ? `${usePercent ? "採用率順" : "採用順位順"} · ${data.entry?.data?.date}${data.entry?.error ? "（前回データ）" : ""}`
            : data.loading
              ? "採用データ取得中…"
              : "採用データなし：五十音順"}
        </small>
      )}
    </>
  );
}
