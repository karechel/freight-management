import { BadRequestException, ValidationError } from '@nestjs/common';

export interface FieldProblem {
  field: string;
  messages: string[];
}

function flatten(errors: ValidationError[], parent = ''): FieldProblem[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function validationFailed(details: FieldProblem[]): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    details,
  });
}

export function validationException(
  errors: ValidationError[],
): BadRequestException {
  return validationFailed(flatten(errors));
}
