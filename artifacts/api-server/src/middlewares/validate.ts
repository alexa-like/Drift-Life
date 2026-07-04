import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Validates req.body against a Zod schema before the route handler runs.
 * On failure, responds 400 with a structured list of field errors instead
 * of letting ad hoc `typeof` checks (or nothing at all) silently accept
 * malformed input deeper in the handler.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid request body",
        code: "VALIDATION_ERROR",
        errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        code: "VALIDATION_ERROR",
        errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid route parameters",
        code: "VALIDATION_ERROR",
        errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    next();
  };
}
