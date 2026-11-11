/**
 * Screenshot values are rounded display totals, never instantaneous DPS.
 * Keep original text and compute estimates using integer arithmetic to avoid
 * floating-point precision loss with billion-scale leaderboard numbers.
 */
export function parseDamageDisplay(raw: string): { normalized: string; approximate: boolean } | null {
  const text = raw.trim().toUpperCase();
  if (text.length > 32) return null;
  const grouped = /^(?:\d{1,3}(?:,\d{3})+|\d{1,15})(?:\.\d{1,3})?\s*[KMBT]?$/;
  if (!grouped.test(text)) return null;
  const clean = text.replaceAll(',', '').replace(/\s+/g, '');
  const match = /^(\d{1,15})(?:\.(\d{1,3}))?([KMBT]?)$/.exec(clean);
  if (!match) return null;
  const [, whole, decimal = '', suffix] = match;
  const order: Record<string, number> = { '': 0, K: 3, M: 6, B: 9, T: 12 };
  const exponent = order[suffix];
  if (decimal.length > exponent) return null;
  const normalized = BigInt(whole) * 10n ** BigInt(exponent) +
    (decimal ? BigInt(decimal) * 10n ** BigInt(exponent - decimal.length) : 0n);
  if (normalized >= 10n ** 24n) return null; // NUMERIC(24,0)
  return { normalized: normalized.toString(), approximate: suffix !== '' };
}

export function estimateAverageDps(damage: string, durationSeconds: number): string {
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Invalid event duration');
  }
  const damageUnits = BigInt(damage);
  const seconds = BigInt(durationSeconds);
  // Return a rounded, 2-decimal estimate as text; avoid unsafe Number conversion.
  const hundredths = (damageUnits * 100n + seconds / 2n) / seconds;
  const whole = hundredths / 100n;
  const frac = (hundredths % 100n).toString().padStart(2, '0');
  return `${whole}.${frac}`;
}
