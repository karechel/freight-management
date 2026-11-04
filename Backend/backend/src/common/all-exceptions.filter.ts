import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Response } from 'express';

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details: unknown[];
}

const SQL_UNIQUE_VIOLATION = '23505';
const SQL_FOREIGN_KEY_VIOLATION = '23503';

function sqlStateOf(exception: unknown): string | undefined {
  let current: unknown = exception;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== 'object') return undefined;
    const { sqlState, cause } = current as {
      sqlState?: unknown;
      cause?: unknown;
    };
    if (typeof sqlState === 'string') return sqlState;
    current = cause;
  }
  return undefined;
}

function body(
  statusCode: number,
  message: string,
  details: unknown[] = [],
): ErrorBody {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    details,
  };
}

/** Maps any thrown value to the API's single error format. Internal details never reach clients. */
export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    if (typeof response === 'string') return body(status, response);
    const { message, details } = response as {
      message?: unknown;
      details?: unknown;
    };
    return body(
      status,
      Array.isArray(message)
        ? message.join('; ')
        : typeof message === 'string'
          ? message
          : exception.message,
      Array.isArray(details) ? details : [],
    );
  }

  const sqlState = sqlStateOf(exception);
  if (sqlState === SQL_UNIQUE_VIOLATION) {
    return body(
      HttpStatus.CONFLICT,
      'A record with the same unique value already exists.',
    );
  }
  if (sqlState === SQL_FOREIGN_KEY_VIOLATION) {
    return body(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'A linked record is missing or still in use.',
    );
  }
  return body(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const errorBody = toErrorBody(exception);
    if (errorBody.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(errorBody.statusCode)
      .json(errorBody);
  }
}
