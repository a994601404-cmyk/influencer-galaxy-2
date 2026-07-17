import { authRouter } from "./auth-router.js";
import { createRouter, publicQuery } from "./middleware.js";
import { influencerRouter } from "./influencer-router.js";
import { negotiationRouter } from "./negotiation-router.js";
import { scriptReviewRouter } from "./script-review-router.js";
import { videoReviewRouter } from "./video-review-router.js";
import { notificationRouter } from "./notification-router.js";
import { trendingRouter } from "./trending-router.js";
import { scriptRouter } from "./script-router.js";
import { storyboardRouter } from "./storyboard-router.js";
import { campaignRouter } from "./campaign-router.js";
import { analyticsRouter } from "./analytics-router.js";
import { metricsRouter } from "./metrics-router.js";
import { instagramRouter } from "./instagram-router.js";
import { socialRouter } from "./social-router.js";
import { configRouter } from "./config-router.js";
import { invitationRouter } from "./invitation-router.js";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  influencer: influencerRouter,
  negotiation: negotiationRouter,
  scriptReview: scriptReviewRouter,
  videoReview: videoReviewRouter,
  notification: notificationRouter,
  trending: trendingRouter,
  script: scriptRouter,
  storyboard: storyboardRouter,
  campaign: campaignRouter,
  analytics: analyticsRouter,
  metrics: metricsRouter,
  instagram: instagramRouter,
  social: socialRouter,
  config: configRouter,
  invitation: invitationRouter,
});

export type AppRouter = typeof appRouter;
