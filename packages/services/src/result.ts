/**
 * Result Pattern for Error Handling
 * Provides type-safe success/failure handling
 */

export type Result<T, E = Error> = Success<T> | Failure<E>;

export interface Success<T> {
  isSuccess: true;
  isFailure: false;
  value: T;
}

export interface Failure<E> {
  isSuccess: false;
  isFailure: true;
  error: E;
}

export class Ok<T> implements Success<T> {
  readonly isSuccess = true as const;
  readonly isFailure = false as const;

  constructor(readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U> {
    return new Ok(fn(this.value));
  }

  flatMap<U>(fn: (value: T) => Result<U>): Result<U> {
    return fn(this.value);
  }

  getOrElse(): T {
    return this.value;
  }
}

export class Err<E> implements Failure<E> {
  readonly isSuccess = false as const;
  readonly isFailure = true as const;

  constructor(readonly error: E) {}

  map<U>(): Result<U, E> {
    return this as any;
  }

  flatMap<U>(): Result<U, E> {
    return this as any;
  }

  getOrElse<U>(defaultValue: U): U {
    return defaultValue;
  }
}

export function ok<T>(value: T): Result<T> {
  return new Ok(value);
}

export function err<E>(error: E): Result<never, E> {
  return new Err(error);
}

export function combine<T, E>(
  results: Result<T, E>[]
): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (result.isFailure) {
      return result;
    }
    values.push(result.value);
  }

  return ok(values);
}
