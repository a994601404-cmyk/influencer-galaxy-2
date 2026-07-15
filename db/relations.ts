import { relations } from "drizzle-orm";
import { users, influencers, scripts, storyboards, campaigns, campaignInfluencers } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  scripts: many(scripts),
  campaigns: many(campaigns),
}));

export const influencersRelations = relations(influencers, ({ many }) => ({
  scripts: many(scripts),
  campaignInfluencers: many(campaignInfluencers),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  user: one(users, { fields: [scripts.userId], references: [users.id] }),
  influencer: one(influencers, { fields: [scripts.influencerId], references: [influencers.id] }),
  storyboards: many(storyboards),
}));

export const storyboardsRelations = relations(storyboards, ({ one }) => ({
  script: one(scripts, { fields: [storyboards.scriptId], references: [scripts.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
  campaignInfluencers: many(campaignInfluencers),
}));

export const campaignInfluencersRelations = relations(campaignInfluencers, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignInfluencers.campaignId], references: [campaigns.id] }),
  influencer: one(influencers, { fields: [campaignInfluencers.influencerId], references: [influencers.id] }),
}));
