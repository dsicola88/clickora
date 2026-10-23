/**
 * E2E atribuição multi-rede (sem DB): hoplink → params → postback com
 * parâmetro primário corrompido (path id / lixo) → UUID no backup.
 * Opcional live MaxWeb: E2E_LIVE=1
 *
 *   node --import tsx scripts/e2e-affiliate-clickid-resilience.ts
 *   E2E_LIVE=1 node --import tsx scripts/e2e-affiliate-clickid-resilience.ts
 */
import { appendClickIdToAffiliateUrl } from "../src/lib/appendClickIdToUrl";
import { parseAffiliatePostback } from "../src/lib/affiliatePlatforms/parseAffiliatePostback";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const results: { name: string; ok: boolean; detail: string }[] = [];

function rec(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

type Case = {
  name: string;
  offerUrl: string;
  platform?: string;
  expectKeys: Record<string, string>;
  postback: { platform: string; flat: Record<string, string> };
};

const cases: Case[] = [
  {
    name: "MaxWeb: subid+subid2; postback com subid=3986",
    offerUrl: "https://mwebkivo.com/12679/3986/2/?",
    expectKeys: { subid: UUID, subid2: UUID, clickora_click_id: UUID },
    postback: {
      platform: "MaxWeb",
      flat: {
        subid: "3986",
        subid2: UUID,
        orderid: "MW1",
        COMMISSION_AMOUNT: "10",
      },
    },
  },
  {
    name: "BuyGoods: subid+subid2; postback SUBID lixo",
    offerUrl: "https://www.buygoods.com/aff/x?",
    expectKeys: { subid: UUID, subid2: UUID },
    postback: {
      platform: "BuyGoods",
      flat: {
        SUBID: "aff_path_99",
        SUBID2: UUID,
        orderid: "BG1",
        COMMISSION_AMOUNT: "11",
      },
    },
  },
  {
    name: "Digistore: cid+sid1; cid=outro UUID → sid1",
    offerUrl: "https://www.digistore24.com/redir/1/2/camp?",
    expectKeys: { cid: UUID, sid1: UUID },
    postback: {
      platform: "Digistore24",
      flat: {
        cid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        sid1: UUID,
        billing_status: "completed",
        transaction_type: "payment",
        transaction_id: "DS1",
        amount_affiliate: "7",
      },
    },
  },
  {
    name: "Digistore: cid existente preservado; sid1=UUID",
    offerUrl: "https://www.checkout-ds24.com/redir/1/2/?cid=facebook_camp",
    expectKeys: { cid: "facebook_camp", sid1: UUID },
    postback: {
      platform: "Digistore24",
      flat: {
        cid: "facebook_camp",
        sid1: UUID,
        billing_status: "completed",
        transaction_type: "payment",
        transaction_id: "DS2",
        amount_affiliate: "7",
      },
    },
  },
  {
    name: "SmartAdv: sub3",
    offerUrl: "https://go.smartadv.example/offer/x?",
    platform: "SmartAdv",
    expectKeys: { sub3: UUID },
    postback: {
      platform: "SmartAdv",
      flat: { sub3: UUID, transaction_id: "SA1", payout: "5", status: "approved" },
    },
  },
  {
    name: "Hotmart: src+sck; src lixo no postback",
    offerUrl: "https://pay.hotmart.com/ABC?",
    expectKeys: { src: UUID, sck: UUID },
    postback: {
      platform: "Hotmart",
      flat: {
        src: "origin_label",
        sck: UUID,
        event: "PURCHASE_APPROVED",
        transaction: "HM1",
        commission: "15",
        currency: "BRL",
      },
    },
  },
  {
    name: "ClickBank: tid",
    offerUrl: "https://hop.clickbank.net/?vendor=x&tid=camp_name",
    expectKeys: { tid: UUID },
    postback: {
      platform: "ClickBank",
      flat: {
        transactionType: "SALE",
        receipt: "CB1",
        totalAccountAmount: "20",
        tid: UUID,
      },
    },
  },
  {
    name: "JVZoo: tid",
    offerUrl: "https://www.jvzoo.com/c/1/2?",
    expectKeys: { tid: UUID },
    postback: {
      platform: "JVZoo",
      flat: {
        ctransaction: "SALE",
        ctransreceipt: "JV1",
        ctransamount: "9",
        tid: UUID,
      },
    },
  },
  {
    name: "WarriorPlus: tid",
    offerUrl: "https://warriorplus.com/o2/a/x/y?",
    expectKeys: { tid: UUID },
    postback: {
      platform: "WarriorPlus",
      flat: {
        WP_ACTION: "sale",
        WP_SALEID: "WP1",
        WP_COMMISSION: "8",
        WP_TID: UUID,
      },
    },
  },
  {
    name: "CPA genérico: subid+subid1+subid2",
    offerUrl: "https://cpa.unknown-network.test/go?",
    expectKeys: { subid: UUID, subid1: UUID, subid2: UUID },
    postback: {
      platform: "postback",
      flat: {
        subid: "not-uuid",
        subid1: UUID,
        orderid: "G1",
        amount: "3",
        status: "approved",
        cy: "USD",
      },
    },
  },
];

async function liveMaxWeb() {
  const API = "https://clickora-production.up.railway.app/api";
  const PAGE = "c516c2c8-ff36-493e-ba07-dc747d8e4dea";
  const CHROME =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  const headers: HeadersInit = {
    "user-agent": CHROME,
    accept: "application/json",
    "x-vercel-id": "e2e-clickid",
    "x-vercel-forwarded-for": "63.124.68.69",
    "x-vercel-forwarded-host": "fastbuyzone.sbs",
  };
  const page = await fetch(`${API}/public/presells/id/${PAGE}`, { headers });
  const body = (await page.json()) as { content?: { affiliateLink?: string }; cloak_safe?: boolean };
  const offer = body?.content?.affiliateLink || "";
  rec("LIVE presell Visivra", page.ok && !body.cloak_safe && /^https?:\/\//i.test(offer), offer.slice(0, 60));
  if (!offer) return;

  const click = await fetch(`${API}/track/r/${PAGE}?to=${encodeURIComponent(offer)}`, {
    headers,
    redirect: "manual",
  });
  const loc = click.headers.get("location") || "";
  let ok = false;
  let detail = `status=${click.status}`;
  try {
    const u = new URL(loc);
    const subid = u.searchParams.get("subid") || "";
    const subid2 = u.searchParams.get("subid2") || "";
    const cid = u.searchParams.get("clickora_click_id") || "";
    ok =
      click.status === 302 &&
      /^[0-9a-f-]{36}$/i.test(cid) &&
      subid === cid &&
      subid2 === cid;
    detail = `subid=${subid.slice(0, 8)}… subid2=${subid2.slice(0, 8)}… same=${subid === subid2 && subid === cid}`;
  } catch {
    detail = `bad loc ${loc.slice(0, 80)}`;
  }
  rec("LIVE MaxWeb track envia subid+subid2=UUID", ok, detail);
}

async function main() {
  for (const c of cases) {
    const out = appendClickIdToAffiliateUrl(c.offerUrl, UUID, c.platform);
    let keysOk = true;
    const missing: string[] = [];
    try {
      const u = new URL(out);
      for (const [k, v] of Object.entries(c.expectKeys)) {
        if (u.searchParams.get(k) !== v) {
          keysOk = false;
          missing.push(`${k}=${u.searchParams.get(k)}`);
        }
      }
    } catch {
      keysOk = false;
      missing.push("url");
    }
    rec(`${c.name} · hoplink`, keysOk, missing.join(" ") || "ok");

    const parsed = parseAffiliatePostback(c.postback);
    const attrOk = parsed.clickId === UUID && (parsed.outcome.kind === "approved" || parsed.outcome.kind === "pending");
    rec(
      `${c.name} · postback`,
      attrOk,
      `clickId=${parsed.clickId?.slice(0, 8) || "null"} outcome=${parsed.outcome.kind}`,
    );
  }

  if (process.env.E2E_LIVE === "1") {
    await liveMaxWeb();
  } else {
    console.log("(skip live — defina E2E_LIVE=1)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks`);
  if (failed.length) {
    console.log("E2E_CLICKID_FAILED");
    process.exitCode = 1;
  } else {
    console.log("ALL_PLATFORMS_CLICKID_OK");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
