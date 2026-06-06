/**
 * Zod-free catalog: locale helpers, bilingual label maps and enums only.
 *
 * This entry exists so dependency-light consumers (notably the SDK, which bundles
 * it) can use the taxonomy + labels without pulling in zod via the schemas.
 */

export * from "./locale.js";
export {
  GOVERNORATES,
  GOVERNORATE_LABELS,
  type Governorate,
  governorateFromArabic,
  normalizeArabic,
} from "./governorates.js";
export * from "./service-type.js";
export * from "./provider-types.js";
export * from "./specialties.js";
export * from "./member.js";
