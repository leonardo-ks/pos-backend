export function asString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} wajib diisi.`);
  }
  return value.trim();
}

export function asOptionalString(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new ValidationError("Nilai harus berupa teks.");
  }
  return value.trim();
}

export function asNumber(value: unknown, field: string, min = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw new ValidationError(`${field} harus berupa angka minimal ${min}.`);
  }
  return number;
}

export function asInteger(value: unknown, field: string, min = 0) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) {
    throw new ValidationError(
      `${field} harus berupa bilangan bulat minimal ${min}.`,
    );
  }
  return number;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
