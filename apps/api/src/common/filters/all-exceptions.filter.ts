import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { writeStructuredLog } from '../../observability/structured-logger';
import {
  attemptedCodeFromRequestBody,
  attemptedNameFromRequestBody,
  duplicateOrgUniqueMessage,
} from '../prisma/duplicate-company-code';

type RequestWithId = Request & { requestId?: string };

function isMulterError(exception: unknown): boolean {
  return Boolean(
    exception &&
    typeof exception === 'object' &&
    (exception as { name?: string }).name === 'MulterError',
  );
}

function isMulterFileTooLarge(exception: unknown): boolean {
  return (
    isMulterError(exception) &&
    (exception as { code?: string }).code === 'LIMIT_FILE_SIZE'
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly isProduction: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (
        response &&
        typeof response === 'object' &&
        'message' in response
      ) {
        message = (response as { message: string | string[] }).message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message =
          duplicateOrgUniqueMessage(exception, {
            code: attemptedCodeFromRequestBody(request.body),
            name: attemptedNameFromRequestBody(request.body),
          }) ?? 'Ya existe un registro con esos datos.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database request failed';
      }
      writeStructuredLog({
        level: 'warn',
        message: 'prisma_error',
        requestId,
        errorName: exception.code,
        context: AllExceptionsFilter.name,
      });
    } else if (isMulterFileTooLarge(exception)) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'El archivo supera el tamaño máximo permitido.';
    } else if (isMulterError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid multipart upload.';
    } else if (
      exception &&
      typeof exception === 'object' &&
      'status' in exception &&
      (exception as { status?: number }).status === 413
    ) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'El archivo supera el tamaño máximo permitido.';
    } else if (exception instanceof Error) {
      writeStructuredLog({
        level: 'error',
        message: exception.message,
        requestId,
        errorName: exception.name,
        context: AllExceptionsFilter.name,
        // Stack only in server logs; never in client body.
        stack: this.isProduction ? undefined : exception.stack,
      });
      if (!this.isProduction) {
        message = exception.message;
      }
    } else {
      writeStructuredLog({
        level: 'error',
        message: 'Unknown exception',
        requestId,
        context: AllExceptionsFilter.name,
      });
    }

    const body: {
      statusCode: number;
      message: string | string[];
      requestId?: string;
    } = {
      statusCode: status,
      message,
    };
    if (requestId) {
      body.requestId = requestId;
    }

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
