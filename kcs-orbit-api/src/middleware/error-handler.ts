import type { NextFunction, Request, Response } from "express";

type JsonBodySyntaxError = SyntaxError & {
  body?: unknown;
  type?: string;
  status?: number;
};

function isJsonBodySyntaxError(error: unknown): error is JsonBodySyntaxError {
  return error instanceof SyntaxError && (error as JsonBodySyntaxError).type === "entity.parse.failed";
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(error);
  }

  if (isJsonBodySyntaxError(error)) {
    return res.status(400).json({
      message: "Invalid JSON payload.",
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  const isCorsError = message === "Not allowed by CORS";
  const statusCode = isCorsError ? 403 : 500;

  console.error(`[Orbit API] ${req.method} ${req.originalUrl} failed`, error);

  return res.status(statusCode).json({
    message: isCorsError ? message : "Internal server error.",
    ...(process.env.NODE_ENV !== "production" && !isCorsError ? { details: message } : {}),
  });
}