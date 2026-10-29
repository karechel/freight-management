// Shared validation types.

/** Error message per form field; a missing key means the field is valid. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;
