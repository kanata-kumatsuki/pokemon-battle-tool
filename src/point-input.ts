// Japanese IME/full-width digits are accepted; other text is not a number.
export function parsePointInput(text: string, max: number): number | null {
  const normalized = text.normalize("NFKC").trim();
  if (!/^\d*$/.test(normalized)) return null;
  return Math.min(max, Math.max(0, Number(normalized)));
}
