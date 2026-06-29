import express from "../apps/api-server/node_modules/express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { vi } from "vitest";

export function createMockDrizzleDb() {
  const query = {
    select: vi.fn(() => query),
    from: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve([])),
    returning: vi.fn(() => Promise.resolve([])),
    set: vi.fn(() => query),
    values: vi.fn(() => query),
    onConflictDoNothing: vi.fn(() => query),
  };

  const db = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    insert: vi.fn(() => ({ values: vi.fn(() => query) })),
    delete: vi.fn(() => query),
  };

  return { db, query };
}

export function createRequestContext(
  overrides: Partial<Request> & {
    user?: { userId: string };
    org?: { id: string };
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  return {
    id: "req-test",
    method: "GET",
    url: "/test",
    path: "/test",
    params: {},
    query: {},
    body: {},
    user: undefined,
    org: undefined,
    ...overrides,
  } as Request;
}

export function createResponseMock() {
  const res = {
    statusCode: 200,
    body: undefined,
    status: vi.fn(function status(
      this: { statusCode: number },
      statusCode: number,
    ) {
      this.statusCode = statusCode;
      return this;
    }),
    json: vi.fn(function json(this: { body: unknown }, body: unknown) {
      this.body = body;
      return this;
    }),
    send: vi.fn(function send(this: { body: unknown }, body?: unknown) {
      this.body = body;
      return this;
    }),
  };

  return res as unknown as Response;
}

export async function createExpressHarness(
  handler: Parameters<Express["use"]>[0],
) {
  const app = express();
  app.use(express.json());
  app.use(handler);
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: (err?: unknown) => void,
    ) => {
      res
        .status(500)
        .json({
          error: "Internal server error",
          details: err instanceof Error ? err.message : undefined,
        });
    },
  );

  const server = await new Promise<Server>((resolve) => {
    const running = app.listen(0, () => resolve(running));
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    app,
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}

export async function request(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
) {
  const url = new URL(path, baseUrl);
  const headers = init.headers as Record<string, string> | undefined;

  return new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: unknown;
  }>((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: init.method ?? "GET",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const bodyBuffer = Buffer.concat(chunks);
          let body: unknown;
          try {
            body =
              bodyBuffer.length > 0
                ? JSON.parse(bodyBuffer.toString("utf8"))
                : undefined;
          } catch {
            body = bodyBuffer.toString("utf8");
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body,
          });
        });
      },
    );

    req.on("error", reject);
    if (init.body) {
      req.write(init.body);
    }
    req.end();
  });
}
