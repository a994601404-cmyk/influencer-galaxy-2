import { getDb } from "../api/queries/connection";
import { influencers, trendingTopics, campaigns, campaignInfluencers, scripts, storyboards, influencerMetrics } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // ─── Seed Influencers ───────────────────────────────────────
  console.log("Seeding influencers...");
  const influencerData = [
    {
      name: "Vivian Chen",
      handle: "@vivianbeauty",
      platform: "instagram" as const,
      avatar: "/avatars/kol-1-vivian.png",
      bio: "Beauty & skincare enthusiast sharing honest reviews and daily routines. 500K+ community of skincare lovers.",
      followers: 520000,
      engagementRate: "4.2",
      niche: "beauty",
      location: "Shanghai, China",
      gender: "female" as const,
      audienceGender: JSON.stringify({ male: 12, female: 88 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 42 },
        { range: "25-34", pct: 35 },
        { range: "35-44", pct: 18 },
        { range: "45+", pct: 5 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 82 },
        { type: "Desktop", pct: 12 },
        { type: "Tablet", pct: 6 },
      ]),
      topPosts: JSON.stringify([
        { title: "Morning Skincare Routine", views: 1200000, likes: 85000 },
        { title: "Product Review: Luxury Serum", views: 980000, likes: 72000 },
      ]),
    },
    {
      name: "Marcus Zhang",
      handle: "@marcusfit",
      platform: "tiktok" as const,
      avatar: "/avatars/kol-2-marcus.png",
      bio: "Fitness coach & wellness advocate. Transforming lives through movement and mindful living.",
      followers: 890000,
      engagementRate: "5.8",
      niche: "fitness",
      location: "Beijing, China",
      gender: "male" as const,
      audienceGender: JSON.stringify({ male: 55, female: 45 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 38 },
        { range: "25-34", pct: 40 },
        { range: "35-44", pct: 18 },
        { range: "45+", pct: 4 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 91 },
        { type: "Desktop", pct: 6 },
        { type: "Tablet", pct: 3 },
      ]),
      topPosts: JSON.stringify([
        { title: "5-Minute Home Workout", views: 3200000, likes: 210000 },
        { title: "Protein Shake Recipe", views: 1800000, likes: 145000 },
      ]),
    },
    {
      name: "Luna Priscilla",
      handle: "@luna.style",
      platform: "instagram" as const,
      avatar: "/avatars/kol-3-luna.png",
      bio: "Fashion creator & trend setter. Elevating everyday style with luxury and streetwear fusion.",
      followers: 310000,
      engagementRate: "3.9",
      niche: "fashion",
      location: "Jakarta, Indonesia",
      gender: "female" as const,
      audienceGender: JSON.stringify({ male: 18, female: 82 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 48 },
        { range: "25-34", pct: 32 },
        { range: "35-44", pct: 15 },
        { range: "45+", pct: 5 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 79 },
        { type: "Desktop", pct: 14 },
        { type: "Tablet", pct: 7 },
      ]),
      topPosts: JSON.stringify([
        { title: "Summer Lookbook 2025", views: 850000, likes: 62000 },
        { title: "Thrift Flip Challenge", views: 720000, likes: 54000 },
      ]),
    },
    {
      name: "Jake Morrison",
      handle: "@jaketech",
      platform: "tiktok" as const,
      avatar: "/avatars/kol-4-jake.png",
      bio: "Tech reviewer & gadget guru. Making technology accessible and fun for everyone.",
      followers: 1200000,
      engagementRate: "6.1",
      niche: "tech",
      location: "Los Angeles, USA",
      gender: "male" as const,
      audienceGender: JSON.stringify({ male: 72, female: 28 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 35 },
        { range: "25-34", pct: 38 },
        { range: "35-44", pct: 20 },
        { range: "45+", pct: 7 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 75 },
        { type: "Desktop", pct: 18 },
        { type: "Tablet", pct: 7 },
      ]),
      topPosts: JSON.stringify([
        { title: "iPhone 16 Pro Review", views: 5500000, likes: 380000 },
        { title: "Budget Earbuds Battle", views: 2800000, likes: 195000 },
      ]),
    },
    {
      name: "Mei Lin",
      handle: "@meicooks",
      platform: "xiaohongshu" as const,
      avatar: "/avatars/kol-5-mei.png",
      bio: "Home cook & food storyteller. Simple recipes with restaurant-level flavor. Follow for daily cooking inspiration.",
      followers: 680000,
      engagementRate: "5.3",
      niche: "food",
      location: "Guangzhou, China",
      gender: "female" as const,
      audienceGender: JSON.stringify({ male: 25, female: 75 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 30 },
        { range: "25-34", pct: 42 },
        { range: "35-44", pct: 22 },
        { range: "45+", pct: 6 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 88 },
        { type: "Desktop", pct: 8 },
        { type: "Tablet", pct: 4 },
      ]),
      topPosts: JSON.stringify([
        { title: "5-Minute Noodles Hack", views: 4200000, likes: 310000 },
        { title: "Weekend Brunch Ideas", views: 2100000, likes: 168000 },
      ]),
    },
    {
      name: "Leo Wagner",
      handle: "@leotravels",
      platform: "instagram" as const,
      avatar: "/avatars/kol-6-leo.png",
      bio: "Travel filmmaker & adventure seeker. Capturing the world one destination at a time.",
      followers: 450000,
      engagementRate: "4.7",
      niche: "travel",
      location: "Berlin, Germany",
      gender: "male" as const,
      audienceGender: JSON.stringify({ male: 42, female: 58 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 32 },
        { range: "25-34", pct: 38 },
        { range: "35-44", pct: 22 },
        { range: "45+", pct: 8 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 71 },
        { type: "Desktop", pct: 19 },
        { type: "Tablet", pct: 10 },
      ]),
      topPosts: JSON.stringify([
        { title: "Hidden Gems in Bali", views: 1800000, likes: 134000 },
        { title: "Solo Travel Guide Japan", views: 1200000, likes: 98000 },
      ]),
    },
    {
      name: "Sophie Wang",
      handle: "@sophielife",
      platform: "xiaohongshu" as const,
      avatar: "/avatars/kol-7-sophie.png",
      bio: "Lifestyle curator & wellness advocate. Sharing tips on mindful living, home decor, and self-care.",
      followers: 920000,
      engagementRate: "4.5",
      niche: "lifestyle",
      location: "Hangzhou, China",
      gender: "female" as const,
      audienceGender: JSON.stringify({ male: 15, female: 85 }),
      audienceAge: JSON.stringify([
        { range: "18-24", pct: 28 },
        { range: "25-34", pct: 40 },
        { range: "35-44", pct: 25 },
        { range: "45+", pct: 7 },
      ]),
      audienceDevices: JSON.stringify([
        { type: "Mobile", pct: 85 },
        { type: "Desktop", pct: 10 },
        { type: "Tablet", pct: 5 },
      ]),
      topPosts: JSON.stringify([
        { title: "Morning Routine 2025", views: 2500000, likes: 198000 },
        { title: "Home Office Makeover", views: 1800000, likes: 142000 },
      ]),
    },
  ];

  for (const inf of influencerData) {
    await db.insert(influencers).values(inf);
  }

  // ─── Seed Trending Topics ───────────────────────────────────
  console.log("Seeding trending topics...");
  const topicData = [
    { platform: "tiktok" as const, topic: "#GlowUp2025", category: "beauty", heat: 98 },
    { platform: "tiktok" as const, topic: "#MorningRoutine", category: "lifestyle", heat: 94 },
    { platform: "tiktok" as const, topic: "#WhatIEatInADay", category: "food", heat: 91 },
    { platform: "instagram" as const, topic: "#OOTD", category: "fashion", heat: 89 },
    { platform: "instagram" as const, topic: "#SkincareTok", category: "beauty", heat: 87 },
    { platform: "tiktok" as const, topic: "#TechUnboxing", category: "tech", heat: 85 },
    { platform: "xiaohongshu" as const, topic: "#早C晚A", category: "beauty", heat: 96 },
    { platform: "xiaohongshu" as const, topic: "#沉浸式护肤", category: "beauty", heat: 92 },
    { platform: "douyin" as const, topic: "#变装挑战", category: "fashion", heat: 90 },
    { platform: "instagram" as const, topic: "#HomeWorkout", category: "fitness", heat: 83 },
    { platform: "tiktok" as const, topic: "#ProductivityHacks", category: "lifestyle", heat: 81 },
    { platform: "xiaohongshu" as const, topic: "#一人食", category: "food", heat: 88 },
    { platform: "weibo" as const, topic: "#夏日防晒", category: "beauty", heat: 95 },
    { platform: "tiktok" as const, topic: "#GRWM", category: "beauty", heat: 86 },
    { platform: "instagram" as const, topic: "#CleanGirl", category: "beauty", heat: 93 },
    { platform: "tiktok" as const, topic: "#BookTok", category: "lifestyle", heat: 78 },
    { platform: "douyin" as const, topic: "#健身打卡", category: "fitness", heat: 84 },
    { platform: "xiaohongshu" as const, topic: "#租房改造", category: "lifestyle", heat: 80 },
    { platform: "instagram" as const, topic: "#SelfCareSunday", category: "wellness", heat: 82 },
    { platform: "tiktok" as const, topic: "#DayInMyLife", category: "lifestyle", heat: 79 },
  ];

  for (const t of topicData) {
    await db.insert(trendingTopics).values(t);
  }

  // ─── Seed Sample Script & Storyboard ────────────────────────
  console.log("Seeding sample scripts and storyboards...");

  // Create a sample script for Vivian (id=1)
  const scriptContent = JSON.stringify({
    segments: [
      {
        timestamp: "00:00",
        text: "Stop scrolling if you have dry, flaky skin! I found the holy grail serum that changed my life in just 7 days.",
        visual: "Close-up of product bottle held in hand, bright natural lighting",
        audio: "Upbeat trending sound, text overlay: 'Wait for it...'",
        type: "hook",
      },
      {
        timestamp: "00:03",
        text: "Last month my skin was SO dry. Nothing worked. Foundation would cake up within an hour. Sound familiar?",
        visual: "Before photo of dry skin texture, woman looking frustrated at mirror",
        audio: "Relatable sigh, dramatic music pause",
        type: "problem",
      },
      {
        timestamp: "00:08",
        text: "Then I discovered the Aurora Radiance Serum. 3 drops every morning and night. That's it. Look at my skin NOW.",
        visual: "Split screen before/after, smooth glowing skin, product application",
        audio: "Satisfying reveal sound, upbeat music resumes",
        type: "solution",
      },
      {
        timestamp: "00:15",
        text: "The key ingredient is Hyaluronic Acid + Vitamin C. It locks in moisture for 24 hours. My dermatologist actually recommended it!",
        visual: "Product ingredient close-up, text overlay of key ingredients",
        audio: "Informative but energetic tone",
        type: "education",
      },
      {
        timestamp: "00:22",
        text: "Link in bio for 30% off your first order! Trust me, your skin will thank you. Comment 'GLOW' and I'll DM you my full routine!",
        visual: "Product + discount badge, smiling face, finger pointing to bio link",
        audio: "Call-to-action music swell",
        type: "cta",
      },
    ],
  });

  await db.insert(scripts).values({
    userId: 1,
    influencerId: 1,
    productName: "Aurora Radiance Serum",
    productCategory: "beauty",
    sellingPoints: "Hyaluronic Acid + Vitamin C formula, 24-hour hydration, dermatologist recommended, visible results in 7 days",
    personaStyle: "koc_share",
    duration: 30,
    scriptContent,
    status: "completed",
  });

  // Storyboards for the sample script
  const storyboardData = [
    {
      scriptId: 1,
      sceneIndex: 0,
      timestamp: "00:00",
      visualDescription: "Close-up of product bottle held in hand, bright natural lighting from window, soft bokeh bathroom background",
      audioDescription: "Upbeat trending sound, text overlay: 'Wait for it...'",
      narration: "Stop scrolling if you have dry, flaky skin!",
      generatedImageUrl: "/storyboards/sb-opening.png",
      status: "completed" as const,
    },
    {
      scriptId: 1,
      sceneIndex: 1,
      timestamp: "00:03",
      visualDescription: "Woman examining her dry skin in bathroom mirror, concerned expression, product bottle visible on counter",
      audioDescription: "Relatable sigh, dramatic music pause",
      narration: "Last month my skin was SO dry. Nothing worked.",
      generatedImageUrl: "/storyboards/sb-problem.png",
      status: "completed" as const,
    },
    {
      scriptId: 1,
      sceneIndex: 2,
      timestamp: "00:08",
      visualDescription: "Happy woman holding up serum bottle to camera, bright white background, excited genuine smile",
      audioDescription: "Satisfying reveal sound, upbeat music resumes",
      narration: "Then I discovered the Aurora Radiance Serum!",
      generatedImageUrl: "/storyboards/sb-solution.png",
      status: "completed" as const,
    },
    {
      scriptId: 1,
      sceneIndex: 3,
      timestamp: "00:15",
      visualDescription: "Woman making heart gesture, colorful gradient background, CTA text overlay visible",
      audioDescription: "Call-to-action music swell",
      narration: "Link in bio for 30% off! Comment 'GLOW'!",
      generatedImageUrl: "/storyboards/sb-cta.png",
      status: "completed" as const,
    },
  ];

  for (const sb of storyboardData) {
    await db.insert(storyboards).values(sb);
  }

  // ─── Seed Campaigns ─────────────────────────────────────────
  console.log("Seeding campaigns...");
  await db.insert(campaigns).values({
    userId: 1,
    name: "Summer Beauty Launch 2025",
    description: "Multi-platform campaign for summer skincare line launch targeting beauty and lifestyle influencers",
    status: "active",
    budget: "50000",
    spent: "32500",
    impressions: 2800000,
    clicks: 156000,
    conversions: 4200,
    roi: "3.85",
    startDate: new Date("2025-05-01"),
    endDate: new Date("2025-07-31"),
  });

  await db.insert(campaigns).values({
    userId: 1,
    name: "Tech Gadget Review Series",
    description: "Product review collaboration with tech influencers for wireless earbuds launch",
    status: "completed",
    budget: "30000",
    spent: "28000",
    impressions: 4200000,
    clicks: 234000,
    conversions: 3800,
    roi: "4.21",
    startDate: new Date("2025-03-01"),
    endDate: new Date("2025-04-30"),
  });

  // Campaign-Influencer junction
  await db.insert(campaignInfluencers).values([
    {
      campaignId: 1,
      influencerId: 1,
      scriptId: 1,
      fee: "8000",
      status: "published",
      performanceData: JSON.stringify({ impressions: 890000, likes: 67000, comments: 3200, shares: 5400, saves: 12000 }),
    },
    {
      campaignId: 1,
      influencerId: 5,
      fee: "6000",
      status: "confirmed",
      performanceData: JSON.stringify({ impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 }),
    },
    {
      campaignId: 1,
      influencerId: 7,
      fee: "7500",
      status: "content_sent",
      performanceData: JSON.stringify({ impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 }),
    },
    {
      campaignId: 2,
      influencerId: 4,
      fee: "12000",
      status: "completed",
      performanceData: JSON.stringify({ impressions: 2100000, likes: 156000, comments: 8900, shares: 12300, saves: 8900 }),
    },
    {
      campaignId: 2,
      influencerId: 2,
      fee: "9000",
      status: "completed",
      performanceData: JSON.stringify({ impressions: 1800000, likes: 134000, comments: 7600, shares: 9800, saves: 7200 }),
    },
  ]);

  // ─── Seed Influencer Metrics (30 days tracking data) ────────
  console.log("Seeding influencer metrics...");

  const metricTypes = ["followers", "engagement_rate", "likes", "comments", "views"] as const;
  const baseValues: Record<string, number[]> = {
    "1": [520000, 4.2, 35000, 2800, 890000],   // Vivian
    "2": [890000, 5.8, 52000, 4100, 1500000],  // Marcus
    "3": [310000, 3.9, 18000, 1500, 520000],   // Luna
    "4": [1200000, 6.1, 78000, 6200, 2800000], // Jake
    "5": [680000, 5.3, 42000, 3500, 1200000],  // Mei
    "6": [450000, 4.7, 25000, 2100, 720000],   // Leo
    "7": [920000, 4.5, 58000, 4800, 1600000],  // Sophie
  };

  for (let day = 29; day >= 0; day--) {
    const recordedAt = new Date();
    recordedAt.setDate(recordedAt.getDate() - day);
    // Set time to midnight for consistent ordering
    recordedAt.setHours(0, 0, 0, 0);

    for (let infId = 1; infId <= 7; infId++) {
      const bases = baseValues[String(infId)];
      const dayProgress = (30 - day) / 30; // 0 to 1

      for (let mIdx = 0; mIdx < metricTypes.length; mIdx++) {
        const base = bases[mIdx];
        // Add organic growth trend + random fluctuation
        const growthFactor = metricTypes[mIdx] === "followers" || metricTypes[mIdx] === "views"
          ? 1 + dayProgress * (0.03 + Math.random() * 0.02) // 3-5% growth over 30 days
          : 1 + (Math.random() - 0.5) * 0.15; // ±7.5% fluctuation for rates
        const value = base * growthFactor * (0.98 + Math.random() * 0.04);

        await db.insert(influencerMetrics).values({
          influencerId: infId,
          metricType: metricTypes[mIdx],
          value: String(Math.round(value * 100) / 100),
          recordedAt,
        });
      }
    }
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
