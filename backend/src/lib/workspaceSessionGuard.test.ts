import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isTokenIssuedBeforeRevocation,
  resolveLiveWorkspaceClaims,
  SessionRevokedError,
  SessionUserGoneError,
  type SessionGuardDb,
} from "./workspaceSessionGuard";
import { signToken, verifyToken } from "./jwt";

type FakeUser = { id: string; sessionsRevokedAt?: Date | null };

function fakeDb(opts: {
  user: FakeUser | null;
  member?: { workspaceId: string; role: string; permissions: unknown } | null;
  missingRevocationColumn?: boolean;
}) {
  const calls = { user: 0, member: 0 };
  const db = {
    user: {
      findUnique: async (args: { select?: Record<string, boolean> }) => {
        calls.user += 1;
        if (opts.missingRevocationColumn && args.select?.sessionsRevokedAt) {
          throw Object.assign(new Error("The column `users.sessions_revoked_at` does not exist"), { code: "P2022" });
        }
        if (!opts.user) return null;
        return args.select?.sessionsRevokedAt
          ? { id: opts.user.id, sessionsRevokedAt: opts.user.sessionsRevokedAt ?? null }
          : { id: opts.user.id };
      },
    },
    workspaceMember: {
      findFirst: async () => {
        calls.member += 1;
        return opts.member ?? null;
      },
    },
  } as unknown as SessionGuardDb;
  return { db, calls };
}

const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("resolveLiveWorkspaceClaims — conta do actor", () => {
  it("rejeita JWT válido de uma conta apagada", async () => {
    const { db } = fakeDb({ user: null });
    await assert.rejects(
      resolveLiveWorkspaceClaims({ userId: "gone-user", email: "gone@example.com" }, db),
      SessionUserGoneError,
    );
  });

  it("rejeita payload sem userId sem consultar a BD", async () => {
    const { db, calls } = fakeDb({ user: { id: "x" } });
    await assert.rejects(resolveLiveWorkspaceClaims({ userId: "", email: "x@example.com" }, db), SessionUserGoneError);
    assert.equal(calls.user, 0);
  });

  it("mantém claims do próprio dono quando a conta existe", async () => {
    const { db } = fakeDb({ user: { id: "owner-1" } });
    const live = await resolveLiveWorkspaceClaims({ userId: "owner-1", email: "o@example.com" }, db);
    assert.equal(live.tenantUserId, "owner-1");
    assert.equal(live.workspaceRole, "owner");
  });

  it("membro removido do workspace cai no próprio userId", async () => {
    const { db } = fakeDb({ user: { id: "member-1" }, member: null });
    const live = await resolveLiveWorkspaceClaims(
      { userId: "member-1", email: "m@example.com", tenantUserId: "owner-1", workspaceId: "ws-1", workspaceRole: "admin" },
      db,
    );
    assert.equal(live.tenantUserId, "member-1");
    assert.equal(live.workspaceId, undefined);
  });

  it("membro ativo mantém o tenant do dono", async () => {
    const { db } = fakeDb({
      user: { id: "member-1" },
      member: { workspaceId: "ws-1", role: "member", permissions: ["rotators:write"] },
    });
    const live = await resolveLiveWorkspaceClaims(
      { userId: "member-1", email: "m@example.com", tenantUserId: "owner-1", workspaceId: "ws-1" },
      db,
    );
    assert.equal(live.tenantUserId, "owner-1");
    assert.deepEqual(live.workspacePermissions, ["rotators:write"]);
  });
});

describe("revogação de sessões (sessionsRevokedAt)", () => {
  const revokedAt = new Date("2026-11-28T12:00:00.700Z");

  it("token emitido antes da revogação é recusado", async () => {
    const { db } = fakeDb({ user: { id: "u1", sessionsRevokedAt: revokedAt } });
    await assert.rejects(
      resolveLiveWorkspaceClaims({ userId: "u1", email: "u@example.com", iat: sec("2026-11-28T11:59:59Z") }, db),
      SessionRevokedError,
    );
  });

  it("token reemitido no mesmo segundo da revogação continua válido", async () => {
    const { db } = fakeDb({ user: { id: "u1", sessionsRevokedAt: revokedAt } });
    const live = await resolveLiveWorkspaceClaims(
      { userId: "u1", email: "u@example.com", iat: sec("2026-11-28T12:00:00Z") },
      db,
    );
    assert.equal(live.tenantUserId, "u1");
  });

  it("com iatMs, token do mesmo segundo mas anterior à revogação é recusado", async () => {
    const { db } = fakeDb({ user: { id: "u1", sessionsRevokedAt: revokedAt } });
    await assert.rejects(
      resolveLiveWorkspaceClaims(
        {
          userId: "u1",
          email: "u@example.com",
          iat: sec("2026-11-28T12:00:00Z"),
          iatMs: Date.parse("2026-11-28T12:00:00.300Z"),
        },
        db,
      ),
      SessionRevokedError,
    );
  });

  it("com iatMs, token emitido depois da revogação no mesmo segundo continua válido", async () => {
    const { db } = fakeDb({ user: { id: "u1", sessionsRevokedAt: revokedAt } });
    const live = await resolveLiveWorkspaceClaims(
      {
        userId: "u1",
        email: "u@example.com",
        iat: sec("2026-11-28T12:00:00Z"),
        iatMs: Date.parse("2026-11-28T12:00:00.701Z"),
      },
      db,
    );
    assert.equal(live.tenantUserId, "u1");
  });

  it("signToken grava iatMs para a comparação ao milissegundo", () => {
    const before = Date.now();
    const payload = verifyToken(signToken({ userId: "u1", email: "u@example.com", purpose: "session" }));
    assert.equal(typeof payload.iatMs, "number");
    assert.ok(payload.iatMs! >= before && payload.iatMs! <= Date.now());
  });

  it("token sem iat é recusado quando a conta tem revogação", () => {
    assert.equal(isTokenIssuedBeforeRevocation(undefined, revokedAt), true);
  });

  it("conta sem revogação aceita qualquer iat", () => {
    assert.equal(isTokenIssuedBeforeRevocation(1, null), false);
    assert.equal(isTokenIssuedBeforeRevocation(undefined, undefined), false);
  });

  it("BD sem a coluna (migration pendente) autentica em vez de derrubar a sessão", async () => {
    const { db, calls } = fakeDb({ user: { id: "u1" }, missingRevocationColumn: true });
    const live = await resolveLiveWorkspaceClaims({ userId: "u1", email: "u@example.com", iat: 1 }, db);
    assert.equal(live.tenantUserId, "u1");
    assert.equal(calls.user, 2);
  });

  it("BD sem a coluna continua a recusar conta apagada", async () => {
    const { db } = fakeDb({ user: null, missingRevocationColumn: true });
    await assert.rejects(
      resolveLiveWorkspaceClaims({ userId: "gone", email: "g@example.com" }, db),
      SessionUserGoneError,
    );
  });
});
