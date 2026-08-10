import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

export type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
