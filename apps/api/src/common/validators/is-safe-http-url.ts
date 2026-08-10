import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

/**
 * Accepts null/undefined/empty when combined with @IsOptional.
 * Otherwise requires a parseable http(s) URL (rejects javascript:, data:, file:).
 */
export function isSafeHttpUrlValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function IsSafeHttpUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeHttpUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isSafeHttpUrlValue(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid http(s) URL`;
        },
      },
    });
  };
}
