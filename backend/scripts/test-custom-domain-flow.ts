/**
 * Testes do fluxo de domínio personalizado (sem servidor HTTP).
 * 1) Funções DNS / normalização (sempre).
 * 2) Se a BD responder: migração aplicada + operações mínimas em `custom_domains`.
 *
 * Uso: `npx tsx scripts/test-custom-domain-flow.ts`
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { systemPrisma } from "../src/lib/prisma";
import {
  dnsTxtContainsVerification,
  normalizeHostname,
  newVerificationToken,
  validateHostnameOrThrow,
  verificationTxtRecordName,
  verificationTxtValue,
} from "../src/lib/customDomainDns";
import {
  getVerifiedOwnerIdForHostname,
  isVerifiedCustomDomainOrigin,
  refreshCustomDomainCache,
} from "../src/lib/customDomainCache";

function testPureHelpers() {
  assert.equal(normalizeHostname("  HTTPS://WWW.FOO.COM/bar  "), "www.foo.com");
  assert.equal(normalizeHostname("example.org"), "example.org");
  assert.throws(() => validateHostnameOrThrow("dclickora.com"));
  assert.throws(() => validateHostnameOrThrow("x"));
  validateHostnameOrThrow("www.cliente-teste.local");

  const host = "www.cliente-teste.local";
  const token = newVerificationToken();
  assert.match(token, /^[a-f0-9]{48}$/);
  assert.equal(verificationTxtRecordName(host), `_dclickora-verify.${host}`);
  assert.equal(verificationTxtValue(token), `dclickora-verification=${token}`);
}

async function testDatabaseIfAvailable() {
  try {
    await systemPrisma.$queryRaw`SELECT 1`;
  } catch {
    console.warn(
      "[skip BD] PostgreSQL indisponível. Inicie o Docker (`docker compose up -d` na raiz) e corra `npx prisma migrate deploy`.",
    );
    return;
  }

  const tableCheck = await systemPrisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'custom_domains'
    ) AS exists
  `;
  if (!tableCheck[0]?.exists) {
    console.warn("[skip BD] Tabela custom_domains não existe — execute `npx prisma migrate deploy`.");
    return;
  }

  const email = "custom-domain-flow-test@dclickora.local";
  const password = await bcrypt.hash("test-flow-123", 8);

  const user = await systemPrisma.user.upsert({
    where: { email },
    create: {
      email,
      password,
      fullName: "Custom domain flow test",
    },
    update: { password },
    select: { id: true },
  });

  await systemPrisma.customDomain.deleteMany({ where: { userId: user.id } });

  const hostname = `flow-test-${user.id.slice(0, 8)}.local`;
  const token = newVerificationToken();

  const row = await systemPrisma.customDomain.create({
    data: {
      userId: user.id,
      hostname,
      verificationToken: token,
      status: "pending",
      isDefault: true,
    },
  });
  assert.equal(row.status, "pending");

  await systemPrisma.customDomain.update({
    where: { id: row.id },
    data: { status: "verified", verifiedAt: new Date() },
  });

  await refreshCustomDomainCache();
  const origin = `https://${hostname}`;
  assert.equal(isVerifiedCustomDomainOrigin(origin), true);
  assert.equal(getVerifiedOwnerIdForHostname(hostname), user.id);

  await systemPrisma.customDomain.delete({ where: { id: row.id } });
  await refreshCustomDomainCache();
  assert.equal(isVerifiedCustomDomainOrigin(origin), false);

  console.log("[BD] Fluxo create → verify → cache CORS → delete OK.");

  await systemPrisma.user.delete({ where: { id: user.id } }).catch(() => {});
}

async function testDnsLookupOptional() {
  try {
    const ok = await dnsTxtContainsVerification("example.com", "impossible-token-xyz");
    assert.equal(typeof ok, "boolean");
    console.log("[DNS] resolveTxt acessível (exemplo: example.com).");
  } catch (e) {
    console.warn("[DNS] Lookup opcional falhou (rede/firewall):", String(e));
  }
}

async function main() {
  console.log("— Testes helpers (normalização / TXT) —");
  testPureHelpers();
  console.log("OK.");

  console.log("— Testes BD (se disponível) —");
  await testDatabaseIfAvailable();

  console.log("— DNS público (opcional) —");
  await testDnsLookupOptional();

  console.log("\nTodos os testes locais concluídos.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
