import { getDb } from "./server/queries/connection.js";

async function dropTables() {
  const db = getDb();
  await db.execute("DROP TABLE IF EXISTS campaignInfluencers");
  await db.execute("DROP TABLE IF EXISTS campaigns");
  await db.execute("DROP TABLE IF EXISTS storyboards");
  await db.execute("DROP TABLE IF EXISTS scripts");
  await db.execute("DROP TABLE IF EXISTS trendingTopics");
  await db.execute("DROP TABLE IF EXISTS influencers");
  console.log("All tables dropped");
}

dropTables().catch(console.error);
