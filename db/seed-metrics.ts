import { getDb } from "../server/queries/connection.js";
import { influencerMetrics } from "./schema.js";

async function seedMetrics() {
  const db = getDb();
  console.log("Checking influencerMetrics table...");

  try {
    // Check if table exists and has data
    const result = await db.select().from(influencerMetrics).limit(1);
    console.log("Table exists. Sample row:", result[0] || "none");

    // Count existing rows
    const all = await db.select().from(influencerMetrics);
    console.log("Existing rows:", all.length);

    if (all.length > 0) {
      console.log("Metrics data already seeded, skipping.");
      return;
    }
  } catch (e: any) {
    if (e.message?.includes("doesn't exist") || e.message?.includes("not found")) {
      console.log("Table does not exist. Please run db:push first.");
      return;
    }
    console.log("Query error:", e.message);
  }

  console.log("Seeding metrics data...");

  const metricTypes = ["followers", "engagement_rate", "likes", "comments", "views"] as const;
  const baseValues: Record<number, number[]> = {
    1: [520000, 4.2, 35000, 2800, 890000],
    2: [890000, 5.8, 52000, 4100, 1500000],
    3: [310000, 3.9, 18000, 1500, 520000],
    4: [1200000, 6.1, 78000, 6200, 2800000],
    5: [680000, 5.3, 42000, 3500, 1200000],
    6: [450000, 4.7, 25000, 2100, 720000],
    7: [920000, 4.5, 58000, 4800, 1600000],
  };

  const batchSize = 50;
  let batch: any[] = [];
  let total = 0;

  for (let day = 29; day >= 0; day--) {
    const recordedAt = new Date();
    recordedAt.setDate(recordedAt.getDate() - day);
    recordedAt.setHours(0, 0, 0, 0);

    for (let infId = 1; infId <= 7; infId++) {
      const bases = baseValues[infId];
      const dayProgress = (30 - day) / 30;

      for (let mIdx = 0; mIdx < metricTypes.length; mIdx++) {
        const base = bases[mIdx];
        const growthFactor = metricTypes[mIdx] === "followers" || metricTypes[mIdx] === "views"
          ? 1 + dayProgress * 0.04
          : 1 + (Math.random() - 0.5) * 0.12;
        const value = base * growthFactor * (0.985 + Math.random() * 0.03);

        batch.push({
          influencerId: infId,
          metricType: metricTypes[mIdx],
          value: String(Math.round(value * 100) / 100),
          recordedAt,
        });

        if (batch.length >= batchSize) {
          await db.insert(influencerMetrics).values(batch);
          total += batch.length;
          batch = [];
        }
      }
    }
  }

  if (batch.length > 0) {
    await db.insert(influencerMetrics).values(batch);
    total += batch.length;
  }

  console.log(`Seeded ${total} metric records.`);
}

seedMetrics().catch(console.error);
