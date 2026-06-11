/** Render helpers for the comma/Arabic-comma joined `requestedServices` string. */

/**
 * Split a stored `requestedServices` value into individual service names.
 *
 * The portal joins selected services with an Arabic comma ("، "), but older or
 * partner-supplied values may use Latin commas, semicolons, or newlines — so we
 * split on any of them and trim the result.
 */
export function parseServices(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[،,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
