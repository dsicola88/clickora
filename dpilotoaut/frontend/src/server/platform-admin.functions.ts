import { createServerFn } from "@tanstack/react-start";

import { requirePlatformAdmin } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";

const DAYS = 30;

function dayKeysLast(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function bucketByDay<T extends { createdAt: Date }>(rows: T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function sumPaymentsByDay(
  rows: { createdAt: Date; priceCents: number | null }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.priceCents == null) continue;
    const k = r.createdAt.toISOString().slice(0, 10);
    m.set(k, (m.get(k) ?? 0) + r.priceCents);
  }
  return m;
}

export const getPlatformAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requirePlatformAdmin])
  .handler(async () => {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - DAYS);
    since.setUTCHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalOrgs,
      totalProjects,
      usersInRange,
      paymentsInRange,
      revenueAllAgg,
      buyerGroups,
      subscriberGroups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.project.count(),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.commercePayment.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, priceCents: true, buyerEmail: true, appUserId: true },
      }),
      prisma.commercePayment.aggregate({ _sum: { priceCents: true } }),
      prisma.commercePayment.groupBy({
        by: ["buyerEmail"],
        where: {
          AND: [
            { buyerEmail: { not: { equals: null } } },
            { buyerEmail: { not: { equals: "" } } },
          ],
        },
        _count: { id: true },
      }),
      prisma.commercePayment.groupBy({
        by: ["appUserId"],
        where: { appUserId: { not: null } },
        _count: { id: true },
      }),
    ]);

    const keys = dayKeysLast(DAYS);
    const signupsByDay = bucketByDay(usersInRange);
    const payWithValue = paymentsInRange.filter((p) => p.priceCents != null);
    const revenueByDay = sumPaymentsByDay(payWithValue);
    const revenue30dCents = paymentsInRange.reduce((acc, p) => acc + (p.priceCents ?? 0), 0);

    const signupsSeries = keys.map((d) => ({ date: d, count: signupsByDay.get(d) ?? 0 }));
    const revenueSeries = keys.map((d) => ({
      date: d,
      revenueCents: revenueByDay.get(d) ?? 0,
    }));

    return {
      totals: {
        users: totalUsers,
        organizations: totalOrgs,
        projects: totalProjects,
        payments30d: paymentsInRange.length,
        revenue30dCents,
        revenueAllTimeCents: revenueAllAgg._sum.priceCents ?? 0,
        uniqueBuyerEmails: buyerGroups.length,
        appAccountsWithPurchase: subscriberGroups.length,
      },
      series: { signups: signupsSeries, revenue: revenueSeries },
      recentPayments: await prisma.commercePayment.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          source: true,
          eventType: true,
          buyerEmail: true,
          productName: true,
          priceCents: true,
          currency: true,
          status: true,
          createdAt: true,
          appUserId: true,
        },
      }),
    };
  });
