/**
 * E2E: multi-workspace switch (membership → JWT → tenant → /me-style resolve → guard).
 *
 *   cd backend && npx tsx scripts/e2e-workspace-switch.ts
 */
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { signToken, verifyToken } from "../src/lib/jwt";
import {
  resolveWorkspaceSessionForSwitch,
  resolveWorkspaceSessionFromRequest,
  resolveWorkspaceSessionForLogin,
} from "../src/lib/workspaceSession";
import { resolveLiveWorkspaceClaims } from "../src/lib/workspaceSessionGuard";
import { authenticate } from "../src/middleware/authenticate";
import { tenantIsolation } from "../src/middleware/tenantIsolation";
import { getTenantContext } from "../src/lib/tenantContext";

const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

type MockRes = Response & { statusCode: number; body: unknown };

function mockReq(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
    path: "/workspaces/x/switch",
    method: "POST",
  } as unknown as Request;
}

function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as MockRes;
}

function runMw(
  mw: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: MockRes,
): Promise<"next" | "ended"> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const next: NextFunction = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve("next");
    };
    const origJson = res.json.bind(res);
    res.json = ((payload: unknown) => {
      const out = origJson(payload);
      if (!settled) {
        settled = true;
        resolve("ended");
      }
      return out;
    }) as MockRes["json"];
    void Promise.resolve(mw(req, res, next)).catch(reject);
  });
}

async function main() {
  const stamp = Date.now().toString(36);
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const member = randomUUID();
  const wsA = randomUUID();
  const wsB = randomUUID();
  const memberPersonal = randomUUID();

  const hash = await bcrypt.hash("e2e-ws-switch", 4);

  await prisma.user.createMany({
    data: [
      {
        id: ownerA,
        email: `e2e-wsa-${stamp}@clickora.test`,
        password: hash,
        fullName: "Owner A",
        workspaceId: wsA,
      },
      {
        id: ownerB,
        email: `e2e-wsb-${stamp}@clickora.test`,
        password: hash,
        fullName: "Owner B",
        workspaceId: wsB,
      },
      {
        id: member,
        email: `e2e-wsm-${stamp}@clickora.test`,
        password: hash,
        fullName: "Member Shared",
        workspaceId: memberPersonal,
      },
    ],
  });

  try {
    await prisma.workspace.create({
      data: { id: wsA, name: "Agency A", ownerUserId: ownerA },
    });
    await prisma.workspace.create({
      data: { id: wsB, name: "Agency B", ownerUserId: ownerB },
    });
    await prisma.workspace.create({
      data: { id: memberPersonal, name: "Member Personal", ownerUserId: member },
    });

    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: wsA, userId: ownerA, role: "owner" },
        { workspaceId: wsB, userId: ownerB, role: "owner" },
        { workspaceId: memberPersonal, userId: member, role: "owner" },
        { workspaceId: wsA, userId: member, role: "member" },
        { workspaceId: wsB, userId: member, role: "admin" },
      ],
    });

    // --- resolve switch ---
    const toA = await resolveWorkspaceSessionForSwitch(member, wsA);
    const toB = await resolveWorkspaceSessionForSwitch(member, wsB);
    const toPersonal = await resolveWorkspaceSessionForSwitch(member, memberPersonal);
    const forbidden = await resolveWorkspaceSessionForSwitch(member, randomUUID());

    record(
      "switch A: tenant=ownerA role=member",
      !!toA && toA.tenantUserId === ownerA && toA.workspaceRole === "member",
      `tenant=${toA?.tenantUserId} role=${toA?.workspaceRole}`,
    );
    record(
      "switch B: tenant=ownerB role=admin",
      !!toB && toB.tenantUserId === ownerB && toB.workspaceRole === "admin",
      `tenant=${toB?.tenantUserId} role=${toB?.workspaceRole}`,
    );
    record(
      "switch pessoal: tenant=member",
      !!toPersonal && toPersonal.tenantUserId === member,
      `tenant=${toPersonal?.tenantUserId}`,
    );
    record("switch workspace inexistente → null", forbidden == null, "ok");

    // --- JWT + /me-style ---
    const tokenB = signToken({
      userId: member,
      email: `e2e-wsm-${stamp}@clickora.test`,
      tenantUserId: toB!.tenantUserId,
      workspaceId: toB!.workspaceId,
      workspaceRole: toB!.workspaceRole,
      workspacePermissions: toB!.workspacePermissions,
      purpose: "session",
    });
    const claims = verifyToken(tokenB);
    record(
      "JWT após switch B contém workspace B",
      claims.workspaceId === wsB && claims.tenantUserId === ownerB,
      `wid=${claims.workspaceId}`,
    );

    const fromReq = await resolveWorkspaceSessionFromRequest(member, wsB);
    record(
      "/me-style resolve respeita JWT workspace B",
      fromReq.workspaceId === wsB &&
        fromReq.tenantUserId === ownerB &&
        fromReq.workspaceName === "Agency B",
      `wid=${fromReq.workspaceId} name=${fromReq.workspaceName}`,
    );

    const loginFirst = await resolveWorkspaceSessionForLogin(member);
    record(
      "login: 1.º membership (ordem createdAt)",
      loginFirst.workspaceId === wsA ||
        loginFirst.workspaceId === wsB ||
        loginFirst.workspaceId === memberPersonal,
      `wid=${loginFirst.workspaceId}`,
    );

    // Preferência JWT sobre login default
    const stickB = await resolveWorkspaceSessionFromRequest(member, wsB);
    const stickA = await resolveWorkspaceSessionFromRequest(member, wsA);
    record(
      "FromRequest A≠B (não desalinha)",
      stickA.workspaceId === wsA && stickB.workspaceId === wsB,
      `A=${stickA.workspaceId.slice(0, 8)} B=${stickB.workspaceId.slice(0, 8)}`,
    );

    // --- authenticate + tenantIsolation ---
    const req = mockReq(`Bearer ${tokenB}`);
    const res = mockRes();
    const authEnded = await runMw(authenticate, req, res);
    record(
      "authenticate aceita JWT switch B",
      authEnded === "next" &&
        req.user?.workspaceId === wsB &&
        req.user?.tenantUserId === ownerB &&
        req.user?.workspaceRole === "admin",
      `authEnded=${authEnded} wid=${req.user?.workspaceId} role=${req.user?.workspaceRole}`,
    );

    let tenantSeen: string | undefined;
    if (authEnded === "next") {
      // ALS só existe dentro do `next` do tenantIsolation — capturar aí.
      await new Promise<"next" | "ended">((resolve, reject) => {
        const next: NextFunction = (err?: unknown) => {
          if (err) reject(err);
          else {
            tenantSeen = getTenantContext()?.tenantId;
            resolve("next");
          }
        };
        try {
          tenantIsolation(req, res, next);
        } catch (e) {
          reject(e);
        }
      });
      record(
        "tenantIsolation → owner B (dados da agência)",
        tenantSeen === ownerB,
        `tenantId=${tenantSeen}`,
      );
    } else {
      record("tenantIsolation → owner B (dados da agência)", false, "auth falhou");
    }

    // listMine is_active semantics
    const activeId = req.user?.workspaceId ?? null;
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: member },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const listed = memberships.map((r) => ({
      id: r.workspace.id,
      is_active: activeId != null && r.workspace.id === activeId,
    }));
    record(
      "listMine is_active só em B",
      listed.filter((x) => x.is_active).length === 1 &&
        listed.find((x) => x.is_active)?.id === wsB,
      JSON.stringify(listed.map((x) => ({ id: x.id.slice(0, 8), a: x.is_active }))),
    );

    // --- guard: membership revogada ---
    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: wsB, userId: member } },
    });
    const liveAfterRevoke = await resolveLiveWorkspaceClaims({
      userId: member,
      email: `e2e-wsm-${stamp}@clickora.test`,
      tenantUserId: ownerB,
      workspaceId: wsB,
      workspaceRole: "admin",
      purpose: "session",
    });
    record(
      "guard: removido de B → cai no próprio tenant",
      liveAfterRevoke.tenantUserId === member,
      `tenant=${liveAfterRevoke.tenantUserId}`,
    );

    const switchAfterRevoke = await resolveWorkspaceSessionForSwitch(member, wsB);
    record("switch B após remoção → null", switchAfterRevoke == null, "ok");
  } finally {
    await prisma.workspaceAuditLog
      .deleteMany({ where: { workspaceId: { in: [wsA, wsB, memberPersonal] } } })
      .catch(() => undefined);
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: [wsA, wsB, memberPersonal] } },
    });
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsA, wsB, memberPersonal] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [ownerA, ownerB, member] } } });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
