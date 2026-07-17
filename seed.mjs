import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL;
const parsed = new URL(url);
const conn = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port || 4000,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
  connectTimeout: 10000,
});

console.log("Connected, seeding...");

// Insert influencers
const influencers = [
  ["Vivian Chen", "@vivianbeauty", "instagram", "/avatars/kol-1-vivian.png", "Beauty & skincare enthusiast sharing honest reviews and daily routines.", 520000, 4.20, "beauty", "Shanghai, China", "female", '{"male":12,"female":88}', '[{"range":"18-24","pct":42},{"range":"25-34","pct":35},{"range":"35-44","pct":18},{"range":"45+","pct":5}]', '[{"type":"Mobile","pct":82},{"type":"Desktop","pct":12},{"type":"Tablet","pct":6}]'],
  ["Marcus Zhang", "@marcusfit", "tiktok", "/avatars/kol-2-marcus.png", "Fitness coach & wellness advocate. Transforming lives through movement.", 890000, 5.80, "fitness", "Beijing, China", "male", '{"male":55,"female":45}', '[{"range":"18-24","pct":38},{"range":"25-34","pct":40},{"range":"35-44","pct":18},{"range":"45+","pct":4}]', '[{"type":"Mobile","pct":91},{"type":"Desktop","pct":6},{"type":"Tablet","pct":3}]'],
  ["Luna Priscilla", "@luna.style", "instagram", "/avatars/kol-3-luna.png", "Fashion creator & trend setter. Elevating everyday style.", 310000, 3.90, "fashion", "Jakarta, Indonesia", "female", '{"male":18,"female":82}', '[{"range":"18-24","pct":48},{"range":"25-34","pct":32},{"range":"35-44","pct":15},{"range":"45+","pct":5}]', '[{"type":"Mobile","pct":79},{"type":"Desktop","pct":14},{"type":"Tablet","pct":7}]'],
  ["Jake Morrison", "@jaketech", "tiktok", "/avatars/kol-4-jake.png", "Tech reviewer & gadget guru. Making technology accessible.", 1200000, 6.10, "tech", "Los Angeles, USA", "male", '{"male":72,"female":28}', '[{"range":"18-24","pct":35},{"range":"25-34","pct":38},{"range":"35-44","pct":20},{"range":"45+","pct":7}]', '[{"type":"Mobile","pct":75},{"type":"Desktop","pct":18},{"type":"Tablet","pct":7}]'],
  ["Mei Lin", "@meicooks", "xiaohongshu", "/avatars/kol-5-mei.png", "Home cook & food storyteller. Simple recipes with restaurant-level flavor.", 680000, 5.30, "food", "Guangzhou, China", "female", '{"male":25,"female":75}', '[{"range":"18-24","pct":30},{"range":"25-34","pct":42},{"range":"35-44","pct":22},{"range":"45+","pct":6}]', '[{"type":"Mobile","pct":88},{"type":"Desktop","pct":8},{"type":"Tablet","pct":4}]'],
  ["Leo Wagner", "@leotravels", "instagram", "/avatars/kol-6-leo.png", "Travel filmmaker & adventure seeker. Capturing the world.", 450000, 4.70, "travel", "Berlin, Germany", "male", '{"male":42,"female":58}', '[{"range":"18-24","pct":32},{"range":"25-34","pct":38},{"range":"35-44","pct":22},{"range":"45+","pct":8}]', '[{"type":"Mobile","pct":71},{"type":"Desktop","pct":19},{"type":"Tablet","pct":10}]'],
  ["Sophie Wang", "@sophielife", "xiaohongshu", "/avatars/kol-7-sophie.png", "Lifestyle curator & wellness advocate. Sharing tips on mindful living.", 920000, 4.50, "lifestyle", "Hangzhou, China", "female", '{"male":15,"female":85}', '[{"range":"18-24","pct":28},{"range":"25-34","pct":40},{"range":"35-44","pct":25},{"range":"45+","pct":7}]', '[{"type":"Mobile","pct":85},{"type":"Desktop","pct":10},{"type":"Tablet","pct":5}]'],
];

for (const inf of influencers) {
  await conn.execute(
    `INSERT INTO influencers (name, handle, platform, avatar, bio, followers, engagementRate, niche, location, gender, audienceGender, audienceAge, audienceDevices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    inf
  );
}
console.log("Influencers seeded");

// Insert trending topics
const topics = [
  ["tiktok", "#GlowUp2025", "beauty", 98],
  ["tiktok", "#MorningRoutine", "lifestyle", 94],
  ["tiktok", "#WhatIEatInADay", "food", 91],
  ["instagram", "#OOTD", "fashion", 89],
  ["instagram", "#SkincareTok", "beauty", 87],
  ["tiktok", "#TechUnboxing", "tech", 85],
  ["xiaohongshu", "#早C晚A", "beauty", 96],
  ["xiaohongshu", "#沉浸式护肤", "beauty", 92],
  ["douyin", "#变装挑战", "fashion", 90],
  ["instagram", "#HomeWorkout", "fitness", 83],
  ["tiktok", "#ProductivityHacks", "lifestyle", 81],
  ["xiaohongshu", "#一人食", "food", 88],
  ["weibo", "#夏日防晒", "beauty", 95],
  ["tiktok", "#GRWM", "beauty", 86],
  ["instagram", "#CleanGirl", "beauty", 93],
  ["tiktok", "#BookTok", "lifestyle", 78],
  ["douyin", "#健身打卡", "fitness", 84],
  ["xiaohongshu", "#租房改造", "lifestyle", 80],
  ["instagram", "#SelfCareSunday", "wellness", 82],
  ["tiktok", "#DayInMyLife", "lifestyle", 79],
];

for (const t of topics) {
  await conn.execute(
    `INSERT INTO trendingTopics (platform, topic, category, heat) VALUES (?, ?, ?, ?)`,
    t
  );
}
console.log("Topics seeded");

await conn.end();
console.log("Done!");
