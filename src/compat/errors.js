export class PortableCompatibilityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PortableCompatibilityError";
    this.code = code;
    this.details = details;
  }
}

export function compatibilityError(code, message, details = {}) {
  return new PortableCompatibilityError(code, message, details);
}
