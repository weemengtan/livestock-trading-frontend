/**
 * The API returns fixed-scale decimals ("14.0000000000"); show them the way a
 * person writes them ("14"). Empty string for null/undefined so it can seed a
 * form input directly.
 */
export function tidyDecimal(value: string | null | undefined): string {
  if (!value) return "";
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

/** True for a plain positive decimal a person typed ("0.83", "22"), false for "", "abc", "-1", "1e3". */
export function isPositiveDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim()) && Number(value) > 0;
}

/** True for a plain non-negative decimal — zero allowed (the CIF buffer may be 0). */
export function isNonNegativeDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}
