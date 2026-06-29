import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequestContext, createResponseMock } from "../../test-utils";

const mocks = vi.hoisted(() => {
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

  return {
    db,
    query,
    clerkMiddleware: vi.fn(),
    requireAuth: vi.fn(
      () => (_req: unknown, _res: unknown, next: (err?: unknown) => void) =>
        next(),
    ),
  };
});

vi.mock("@clerk/express", () => ({
  clerkMiddleware: mocks.clerkMiddleware,
  requireAuth: mocks.requireAuth,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
}));

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  organizationsTable: { ownerId: "organizations.ownerId" },
  agentsTable: { ownerId: "agents.ownerId", id: "agents.id" },
  callsTable: { id: "calls.id", agentId: "calls.agentId" },
}));

vi.mock("../../../libs/db/src/index.ts", () => ({
  db: mocks.db,
  organizationsTable: { ownerId: "organizations.ownerId" },
  agentsTable: { ownerId: "agents.ownerId", id: "agents.id" },
  callsTable: { id: "calls.id", agentId: "calls.agentId" },
}));

vi.mock("../../../apps/api-server/src/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  requireOrganization,
  requireOrgResource,
} from "../../../apps/api-server/src/middlewares/errorHandler";

describe("Auth and organization middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.limit.mockResolvedValue([]);
  });

  it("loads the current organization and attaches org context", async () => {
    mocks.query.limit.mockResolvedValue([{ id: "org-1", ownerId: "user-1" }]);
    const req = createRequestContext({ user: { userId: "user-1" } });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrganization(req, res, next);

    expect(mocks.db.select).toHaveBeenCalled();
    expect(req.org).toEqual({ id: "org-1", ownerId: "user-1" });
    expect(req.userId).toBe("user-1");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects missing organization context", async () => {
    const req = createRequestContext({ user: { userId: "user-1" } });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("agents")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("allows agent access when the authenticated user owns the agent", async () => {
    mocks.query.limit.mockResolvedValue([{ ownerId: "user-1" }]);
    const req = createRequestContext({
      user: { userId: "user-1" },
      org: { id: "org-1" },
      params: { id: "agent-1" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("agents", "id")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.db.select).toHaveBeenCalled();
    expect(mocks.query.where).toHaveBeenCalled();
  });

  it("allows call access through the owning agent", async () => {
    mocks.query.limit.mockResolvedValue([{ agentOwnerId: "user-1" }]);
    const req = createRequestContext({
      user: { userId: "user-1" },
      org: { id: "org-1" },
      params: { id: "call-1" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("calls", "id")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.query.leftJoin).toHaveBeenCalled();
    expect(mocks.query.where).toHaveBeenCalled();
  });

  it("rejects agent access for another organization owner", async () => {
    mocks.query.limit.mockResolvedValue([{ ownerId: "user-2" }]);
    const req = createRequestContext({
      user: { userId: "user-1" },
      org: { id: "org-1" },
      params: { id: "agent-1" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("agents", "id")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns not found when the requested agent does not exist", async () => {
    mocks.query.limit.mockResolvedValue([]);
    const req = createRequestContext({
      user: { userId: "user-1" },
      org: { id: "org-1" },
      params: { id: "missing-agent" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("agents", "id")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("requires an id parameter for resource ownership checks", async () => {
    const req = createRequestContext({
      user: { userId: "user-1" },
      org: { id: "org-1" },
      params: {},
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("agents", "id")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("isolates agents between different organization owners", async () => {
    mocks.query.limit.mockResolvedValue([{ ownerId: "owner-a" }]);
    const req = createRequestContext({
      user: { userId: "owner-b" },
      org: { id: "org-b" },
      params: { id: "agent-x" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("agents", "id")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("prevents cross-organization call access via agent join", async () => {
    mocks.query.limit.mockResolvedValue([{ agentOwnerId: "owner-a" }]);
    const req = createRequestContext({
      user: { userId: "owner-b" },
      org: { id: "org-b" },
      params: { id: "call-1" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("calls", "id")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects unsupported resource types for ownership checks", async () => {
    const req = createRequestContext({
      user: { userId: "user-1" },
      org: { id: "org-1" },
      params: { id: "res-1" },
    });
    const res = createResponseMock();
    const next = vi.fn();

    await requireOrgResource("unsupported", "id")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
