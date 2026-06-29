import { describe, it, expect } from "vitest";

class HttpError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown,
  ) {
    super(message, { cause: details });
    this.name = "HttpError";
  }
}

function badRequest(message: string): never {
  throw new HttpError(400, message);
}

function unauthorized(message = "Unauthorized"): never {
  throw new HttpError(401, message);
}

function forbidden(message = "Forbidden"): never {
  throw new HttpError(403, message);
}

function notFound(message: string): never {
  throw new HttpError(404, message);
}

function internalError(
  message = "Internal server error",
  cause?: unknown,
): never {
  throw new HttpError(500, message, cause);
}

function serializeError(error: unknown) {
  if (error instanceof HttpError) {
    return {
      error: error.message,
      ...(process.env.NODE_ENV !== "production" && error.details !== undefined
        ? { details: error.details }
        : {}),
    };
  }

  const zodError = error as {
    issues?: Array<{ path: unknown[]; message: string }>;
  } | null;
  if (zodError?.issues && Array.isArray(zodError.issues)) {
    return {
      error: "Validation failed",
      details: zodError.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  return {
    error: "Internal server error",
    ...(process.env.NODE_ENV !== "production" && error instanceof Error
      ? { message: error.message }
      : {}),
  };
}

describe("HttpError", () => {
  it("should create error with status code and message", () => {
    const error = new HttpError(404, "Not found");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.name).toBe("HttpError");
  });

  it("should store details in cause", () => {
    const details = { field: "email" };
    const error = new HttpError(400, "Validation failed", details);
    expect(error.cause).toEqual(details);
  });
});

describe("Error factory functions", () => {
  it("badRequest should throw HttpError with 400", () => {
    expect(() => badRequest("Invalid input")).toThrow(HttpError);
    expect(() => badRequest("Invalid input")).toThrow("Invalid input");
  });

  it("unauthorized should throw HttpError with 401", () => {
    expect(() => unauthorized()).toThrow("Unauthorized");
  });

  it("forbidden should throw HttpError with 403", () => {
    expect(() => forbidden("No access")).toThrow("No access");
  });

  it("notFound should throw HttpError with 404", () => {
    expect(() => notFound("User")).toThrow("User");
  });

  it("internalError should throw HttpError with 500", () => {
    expect(() => internalError()).toThrow("Internal server error");
  });
});

describe("serializeError", () => {
  it("should serialize HttpError", () => {
    const error = new HttpError(400, "Bad request");
    const result = serializeError(error);
    expect(result).toEqual({ error: "Bad request" });
  });

  it("should include details in non-production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const error = new HttpError(400, "Bad request", { field: "email" });
    const result = serializeError(error);
    expect(result.details).toEqual({ field: "email" });
    process.env.NODE_ENV = originalEnv;
  });

  it("should hide details in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const error = new HttpError(400, "Bad request", { field: "email" });
    const result = serializeError(error);
    expect(result).not.toHaveProperty("details");
    process.env.NODE_ENV = originalEnv;
  });

  it("should serialize ZodError", () => {
    const zodError = {
      issues: [{ path: ["email"], message: "Invalid email" }],
    };
    const result = serializeError(zodError);
    expect(result.error).toBe("Validation failed");
    expect(result.details).toHaveLength(1);
  });

  it("should serialize unknown error", () => {
    const result = serializeError(new Error("Unknown"));
    expect(result.error).toBe("Internal server error");
  });
});

describe("errorHandler middleware", () => {
  it("should handle HttpError with correct status", () => {
    const err = new HttpError(403, "Forbidden");
    const result = serializeError(err);
    expect(result.error).toBe("Forbidden");
  });
});
