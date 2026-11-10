import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';
import type { Logger } from '../utils/logger.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { formatZodIssues } from '../utils/validate.js';

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.path}`);
};

function pgErrorCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; cause?: { code?: unknown } };
  const code = e?.cause?.code ?? e?.code;
  return typeof code === 'string' ? code : undefined;
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
      return;
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: formatZodIssues(error),
        },
      });
      return;
    }

    const bodyError = error as { type?: string; status?: number };
    if (bodyError?.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
      return;
    }
    if (bodyError?.type === 'entity.too.large') {
      res
        .status(413)
        .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
      return;
    }

    const pgCode = pgErrorCode(error);
    if (pgCode === '23505') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'This record already exists' } });
      return;
    }
    if (pgCode === '22P02') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed identifier' } });
      return;
    }

    (req.log ?? logger).error({ err: error }, 'Unhandled error');
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  };
}
