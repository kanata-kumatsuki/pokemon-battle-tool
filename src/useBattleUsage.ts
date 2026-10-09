import { useEffect, useState, useRef } from "react";
import {
  loadUsage,
  loadUsageIndex,
  japanDay,
  type CacheEntry,
  type UsageIndex,
  type UsageSnapshot,
} from "./usage";

export function useBattleUsage(speciesId: string | undefined) {
  const [index, setIndex] = useState<CacheEntry<UsageIndex>>();
  const [snapshot, setSnapshot] = useState<{
    id: string;
    entry: CacheEntry<UsageSnapshot>;
  }>();
  const force = useRef(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [day, setDay] = useState(japanDay());
  useEffect(() => {
    const check = () => setDay(japanDay());
    window.addEventListener("focus", check);
    window.addEventListener("pointerdown", check);
    window.addEventListener("keydown", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("pointerdown", check);
      window.removeEventListener("keydown", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  useEffect(() => {
    if (!speciesId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const forced = force.current;
    force.current = false;
    Promise.all([loadUsageIndex(forced), loadUsage(speciesId, forced)]).then(
      ([i, e]) => {
        if (active) {
          setIndex(i);
          setSnapshot({ id: speciesId, entry: e });
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [speciesId, reload, day]);
  return {
    index,
    entry: snapshot && snapshot.id === speciesId ? snapshot.entry : undefined,
    loading,
    refresh: () => setReload((n) => n + 1),
    retry: () => {
      force.current = true;
      setReload((n) => n + 1);
    },
  };
}
