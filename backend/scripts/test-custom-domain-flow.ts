/**
 * Testes do fluxo de domínio personalizado (sem servidor HTTP).
 * 1) Funções DNS / normalização (sempre).
 * 2) Se a BD responder: migração aplicada + operações mínimas em `custom_domains`.
 *
 * Uso: `npx tsx scripts/test-custom-domain-flow.ts`
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
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
import { buildPendingDnsPayload } from "../src/lib/customDomainDnsPayload";

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

/**
 * Garante que a API pode devolver ao afiliado dados copiáveis para Hostinger / Cloudflare / etc.
 * Alinhado com `CustomDomainPendingDns` no frontend.
 */
function testAffiliateDnsPayloadForRegistrar() {
  const token = "a".repeat(48);

  // Modo só Clickora (sem registo Vercel no create): 1× TXT de prova
  const dclickora = buildPendingDnsPayload("loja.afiliado.com", token, {
    vercel: false,
    vercelVerification: [],
    vercelVerifiedImmediately: false,
  });
  assert.equal(dclickora.mode, "dclickora");
  if (dclickora.mode !== "dclickora") throw new Error("unexpected");
  assert.equal(dclickora.txt_name, "_dclickora-verify.loja.afiliado.com");
  assert.equal(dclickora.txt_value, `dclickora-verification=${token}`);
  assert.ok(dclickora.note.length > 20);
  assert.ok(dclickora.txt_name.includes("loja.afiliado.com"));

  // Apex: mesmo formato TXT (nome FQDN completo do registo)
  const apex = buildPendingDnsPayload("afiliado.com", token, {
    vercel: false,
    vercelVerification: [],
    vercelVerifiedImmediately: false,
  });
  assert.equal(apex.mode, "dclickora");
  if (apex.mode !== "dclickora") throw new Error("unexpected");
  assert.equal(apex.txt_name, "_dclickora-verify.afiliado.com");

  // Modo Vercel: CNAME/A sugerido + TXT(s) vindos da Vercel (simulados)
  const vercelSim = buildPendingDnsPayload("www.marca.com", token, {
    vercel: true,
    vercelVerification: [
      {
        type: "TXT",
        domain: "_vercel.marca.com",
        value: "vc-domain-verify=xxxx",
        reason: "pending_domain_verification",
      },
    ],
    vercelVerifiedImmediately: false,
  });
  assert.equal(vercelSim.mode, "vercel");
  if (vercelSim.mode !== "vercel") throw new Error("unexpected");
  assert.equal(vercelSim.cname.host, "www");
  assert.equal(vercelSim.cname.target, "cname.vercel-dns.com");
  assert.ok(vercelSim.cname.note.toLowerCase().includes("cname"));
  assert.equal(vercelSim.vercel_txt.length, 1);
  assert.equal(vercelSim.vercel_txt[0].name, "_vercel.marca.com");
  assert.equal(vercelSim.vercel_txt[0].value, "vc-domain-verify=xxxx");
  assert.equal(vercelSim.vercel_txt[0].type, "TXT");
  assert.equal(vercelSim.vercel_verified_immediately, false);
  assert.ok(vercelSim.note.includes("CNAME"));

  const apexVercel = buildPendingDnsPayload("marca.com", token, {
    vercel: true,
    vercelVerification: [],
    vercelVerifiedImmediately: false,
  });
  assert.equal(apexVercel.mode, "vercel");
  if (apexVercel.mode !== "vercel") throw new Error("unexpected");
  assert.equal(apexVercel.cname.host, "@");
  assert.equal(apexVercel.cname.target, "76.76.21.21");

  console.log(
    "[Afiliado → DNS] Modo dclickora: txt_name + txt_value preenchíveis no painel Hostinger (tipo TXT).",
  );
  console.log(
    "[Afiliado → DNS] Modo vercel: cname (host/target) + linhas vercel_txt (nome/valor por linha).",
  );
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

  try {
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
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      console.warn("[skip BD] Esquema desatualizado — execute `npx prisma migrate deploy` na pasta backend.");
      return;
    }
    throw e;
  }
}

async function testDnsLookupOptional() {
  try {
    const dnsR = await dnsTxtContainsVerification("example.com", "impossible-token-xyz");
    assert.ok(dnsR === "match" || dnsR === "no_match" || dnsR === "timeout");
    console.log("[DNS] resolveTxt acessível (exemplo: example.com).");
  } catch (e) {
    console.warn("[DNS] Lookup opcional falhou (rede/firewall):", String(e));
  }
}

async function main() {
  console.log("— Testes helpers (normalização / TXT) —");
  testPureHelpers();
  console.log("OK.");

  console.log("— Payload DNS para afiliado (Hostinger / etc.) —");
  testAffiliateDnsPayloadForRegistrar();
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
