import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { campaigns, campaignInfluencers, influencers, scripts } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const analyticsRouter = createRouter({
  dashboard: publicQuery.query(async () => {
    const db = getDb();

    const campaignStats = await db
      .select({
        totalCampaigns: sql<number>`count(*)`,
        activeCampaigns: sql<number>`sum(case when status = 'active' then 1 else 0 end)`,
        totalBudget: sql<number>`coalesce(sum(budget), 0)`,
        totalSpent: sql<number>`coalesce(sum(spent), 0)`,
        totalImpressions: sql<number>`coalesce(sum(impressions), 0)`,
        totalClicks: sql<number>`coalesce(sum(clicks), 0)`,
        totalConversions: sql<number>`coalesce(sum(conversions), 0)`,
        avgRoi: sql<number>`coalesce(avg(roi), 0)`,
      })
      .from(campaigns);

    const influencerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(influencers);

    const scriptCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(scripts);

    const recentCampaigns = await db
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt))
      .limit(5);

    return {
      campaigns: campaignStats[0] || {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        avgRoi: 0,
      },
      totalInfluencers: influencerCount[0]?.count || 0,
      totalScripts: scriptCount[0]?.count || 0,
      recentCampaigns,
    };
  }),

  campaignPerformance: publicQuery
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const campaign = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);

      if (!campaign[0]) return null;

      const ci = await db
        .select()
        .from(campaignInfluencers)
        .where(eq(campaignInfluencers.campaignId, input.campaignId));

      // Aggregate performance data
      let totalImpressions = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalSaves = 0;

      for (const item of ci) {
        if (item.performanceData) {
          try {
            const pd = JSON.parse(item.performanceData);
            totalImpressions += pd.impressions || 0;
            totalLikes += pd.likes || 0;
            totalComments += pd.comments || 0;
            totalShares += pd.shares || 0;
            totalSaves += pd.saves || 0;
          } catch {
            // skip invalid json
          }
        }
      }

      return {
        campaign: campaign[0],
        performance: {
          impressions: totalImpressions,
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          saves: totalSaves,
          engagement: totalImpressions > 0 ? ((totalLikes + totalComments + totalShares + totalSaves) / totalImpressions * 100).toFixed(2) : "0",
        },
        influencers: ci.length,
      };
    }),

  platformBreakdown: publicQuery.query(async () => {
    const db = getDb();

    const result = await db
      .select({
        platform: influencers.platform,
        count: sql<number>`count(*)`,
        totalFollowers: sql<number>`coalesce(sum(followers), 0)`,
        avgEngagement: sql<number>`coalesce(avg(${influencers.engagementRate}), 0)`,
      })
      .from(influencers)
      .groupBy(influencers.platform);

    return result;
  }),

  nicheBreakdown: publicQuery.query(async () => {
    const db = getDb();

    const result = await db
      .select({
        niche: influencers.niche,
        count: sql<number>`count(*)`,
        totalFollowers: sql<number>`coalesce(sum(followers), 0)`,
        avgEngagement: sql<number>`coalesce(avg(${influencers.engagementRate}), 0)`,
      })
      .from(influencers)
      .where(sql`${influencers.niche} IS NOT NULL`)
      .groupBy(influencers.niche);

    return result;
  }),

  influencerROI: publicQuery
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const ci = await db
        .select()
        .from(campaignInfluencers)
        .where(eq(campaignInfluencers.campaignId, input.campaignId));

      const influencerIds = ci.map((c) => c.influencerId);
      const infData = influencerIds.length > 0
        ? await db.select().from(influencers).where(sql`${influencers.id} IN (${influencerIds.join(",")})`)
        : [];

      return ci.map((c) => {
        const inf = infData.find((i) => i.id === c.influencerId);
        let perf = { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
        try {
          if (c.performanceData) perf = JSON.parse(c.performanceData);
        } catch {
          // skip
        }
        const fee = parseFloat(c.fee?.toString() || "0");
        const roi = fee > 0 ? ((perf.impressions || 0) / fee / 100).toFixed(2) : "0";

        return {
          ...c,
          influencer: inf,
          performance: perf,
          roi,
        };
      });
    }),
});
