import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validationFailed } from './validation-exception.js';
import { toErrorBody } from './all-exceptions.filter.js';

describe('toErrorBody', () => {
  it('keeps the status and message of HTTP exceptions', () => {
    expect(toErrorBody(new NotFoundException('No such record'))).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'No such record',
      details: [],
    });
    expect(toErrorBody(new ForbiddenException()).statusCode).toBe(403);
  });

  it('carries field-level validation details', () => {
    const details = [{ field: 'email', messages: ['email must be an email'] }];
    expect(toErrorBody(validationFailed(details))).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details,
    });
  });

  it('maps unique violations to 409, also when wrapped', () => {
    expect(toErrorBody({ sqlState: '23505' }).statusCode).toBe(409);
    expect(
      toErrorBody(new Error('wrapped', { cause: { sqlState: '23505' } }))
        .statusCode,
    ).toBe(409);
  });

  it('maps foreign-key violations to 422', () => {
    expect(toErrorBody({ sqlState: '23503' }).statusCode).toBe(422);
  });

  it('hides the details of unexpected errors', () => {
    expect(toErrorBody(new Error('password=secret'))).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      details: [],
    });
  });
});
