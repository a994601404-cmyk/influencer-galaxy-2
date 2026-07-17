// Frontend Data Store - localStorage based persistence
// All data is managed client-side for static deployment compatibility

import { getCurrentUser, getAllUsers, type LocalUser } from "./local-auth";

export interface Influencer {
  id: number;
  name: string;
  handle: string;
  platform: string;
  avatar: string;
  bio: string;
  followers: number;
  engagementRate: number;
  niche: string;
  location: string;
  gender: string;
  profileUrl: string;         // Link to the influencer's social media profile page
  userPrice: number;           // Price set by normal users (网红报价)
  userPriceUpdatedAt: string;  // When userPrice was last set
  adminPrice: number;          // Price set by admin after review (审核报价)
  adminPriceUpdatedAt: string; // When adminPrice was last set
  coopStatus: "pending" | "cooperating" | "not-cooperating"; // Admin review result
  audienceGender: { male: number; female: number };
  audienceAge: Array<{ range: string; pct: number }>;
  audienceDevices: Array<{ type: string; pct: number }>;
  topPosts: Array<{ title: string; views: number; likes: number }>;
  createdBy: number; // user ID who added this influencer
  hidden: boolean;   // admin-only: whether this influencer is hidden from normal users
}

// ─── User-Entered Tracking Data ───────────────────────────────
// Each record is a data point manually entered by the user from
// actual social media analytics dashboards (Instagram Insights,
// TikTok Analytics, etc.)

// ─── Collaboration Record ─────────────────────────────────────
// Each record tracks a single collaboration campaign with an influencer
// Users enter actual performance data from the social media platform

export interface CollaborationRecord {
  id: number;
  influencerId: number;
  date: string;          // YYYY-MM-DD
  videoUrl: string;      // Link to the posted video
  exposures: number;     // 曝光量 / impressions
  likes: number;         // 点赞数
  comments: number;      // 评论数
  shares: number;        // 转发/分享数
  notes: string;         // Optional notes about this collaboration
  createdBy: number;     // user ID who added this record
}

// Legacy interface - kept for backward compatibility
export interface TrackingRecord {
  id: number;
  influencerId: number;
  date: string;
  followers: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  source: string;
  notes: string;
}

export interface ScriptSegment {
  timestamp: string;
  text: string;
  visual: string;
  audio: string;
  type: "hook" | "problem" | "solution" | "education" | "cta";
}

export interface Script {
  id: number;
  influencerId: number;
  productName: string;
  productCategory: string;
  sellingPoints: string;
  personaStyle: string;
  duration: number;
  segments: ScriptSegment[];
  createdAt: string;
}

export interface Campaign {
  id: number;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "completed";
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roi: number;
  startDate: string;
  endDate: string;
}

export interface TrendingTopic {
  id: number;
  platform: string;
  topic: string;
  category: string;
  heat: number;
}

// No pre-seeded mock data — users add influencers themselves

const DEFAULT_TRENDING: TrendingTopic[] = [
  { id: 1, platform: "tiktok", topic: "#GlowUp2025", category: "beauty", heat: 98 },
  { id: 2, platform: "xiaohongshu", topic: "#早C晚A", category: "beauty", heat: 96 },
  { id: 3, platform: "instagram", topic: "#CleanGirl", category: "beauty", heat: 93 },
  { id: 4, platform: "tiktok", topic: "#MorningRoutine", category: "lifestyle", heat: 94 },
  { id: 5, platform: "xiaohongshu", topic: "#沉浸式护肤", category: "beauty", heat: 92 },
  { id: 6, platform: "instagram", topic: "#OOTD", category: "fashion", heat: 89 },
  { id: 7, platform: "xiaohongshu", topic: "#一人食", category: "food", heat: 88 },
  { id: 8, platform: "tiktok", topic: "#WhatIEatInADay", category: "food", heat: 91 },
  { id: 9, platform: "instagram", topic: "#SkincareTok", category: "beauty", heat: 87 },
  { id: 10, platform: "tiktok", topic: "#TechUnboxing", category: "tech", heat: 85 },
  { id: 11, platform: "tiktok", topic: "#HomeWorkout", category: "fitness", heat: 83 },
  { id: 12, platform: "instagram", topic: "#SelfCareSunday", category: "wellness", heat: 82 },
];

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 1, name: "Summer Beauty Launch 2025",
    description: "Multi-platform campaign for summer skincare line launch targeting beauty and lifestyle influencers",
    status: "active", budget: 50000, spent: 32500, impressions: 2800000, clicks: 156000, conversions: 4200, roi: 3.85,
    startDate: "2025-05-01", endDate: "2025-07-31",
  },
  {
    id: 2, name: "Tech Gadget Review Series",
    description: "Product review collaboration with tech influencers for wireless earbuds launch",
    status: "completed", budget: 30000, spent: 28000, impressions: 4200000, clicks: 234000, conversions: 3800, roi: 4.21,
    startDate: "2025-03-01", endDate: "2025-04-30",
  },
  {
    id: 3, name: "Fitness Challenge Q2",
    description: "30-day fitness challenge campaign with fitness KOLs across TikTok and Instagram",
    status: "active", budget: 25000, spent: 12000, impressions: 1800000, clicks: 98000, conversions: 2100, roi: 2.95,
    startDate: "2025-06-01", endDate: "2025-06-30",
  },
];

// ─── Storage Helpers ──────────────────────────────────────────

const STORAGE_KEYS = {
  influencers: "pulseboost_influencers",
  scripts: "pulseboost_scripts",
  campaigns: "pulseboost_campaigns",
  trending: "pulseboost_trending",
  scriptCounter: "pulseboost_script_counter",
  collaborations: "pulseboost_collaborations",
  collabCounter: "pulseboost_collab_counter",
  // seeded removed — no more pre-seeded data
  negotiations: "pulseboost_negotiations",
  negotiationCounter: "pulseboost_negotiation_counter",
  scriptReviews: "pulseboost_script_reviews",
  videoReviews: "pulseboost_video_reviews",
  videoCounter: "pulseboost_video_counter",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

export function save(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ─── Influencer Store (with RBAC) ────────────────────────────

// Get ALL influencers (raw, for internal use)
// All influencers are visible to everyone — no RBAC filtering on visibility
export function getAllInfluencersRaw(): Influencer[] {
  const existing = localStorage.getItem(STORAGE_KEYS.influencers);
  if (existing) {
    try { return JSON.parse(existing); } catch { /* fall through */ }
  }
  return [];
}

// Get influencers — all cards visible to all users (logged in or not)
// Only hidden cards are filtered out for non-admin users
export function getInfluencers(): Influencer[] {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  if (currentUser?.role === "admin") {
    // Admin: sees everything including hidden
    return all;
  }
  // Everyone (logged in + not logged in): sees all non-hidden cards
  return all.filter((i) => !i.hidden);
}

// Admin-only: get influencers by a specific owner
export function getInfluencersByOwner(ownerId: number): Influencer[] {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return [];
  return all.filter((i) => i.createdBy === ownerId);
}

// Get all unique owner IDs from influencers (for admin filter)
export function getInfluencerOwners(): Array<{ id: number; name: string }> {
  const all = getAllInfluencersRaw();
  const ownerIds = [...new Set(all.map((i) => i.createdBy))].filter((id) => id !== 0);
  // Try to resolve names from registered users
  const users = getAllUsers();
  return ownerIds.map((id) => {
    const user = users.find((u: LocalUser) => u.id === id);
    return { id, name: user?.name || user?.email || `用户 #${id}` };
  });
}

export function getInfluencerById(id: number): Influencer | undefined {
  return getInfluencers().find((i) => i.id === id);
}

export function addInfluencer(inf: Omit<Influencer, "id" | "createdBy" | "hidden">): Influencer {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  const ownerId = currentUser?.id ?? 0;
  const newInf: Influencer = { ...inf, id: Math.max(0, ...all.map((i) => i.id)) + 1, createdBy: ownerId, hidden: false };
  all.push(newInf);
  save(STORAGE_KEYS.influencers, all);
  return newInf;
}

// ─── Negotiation Record ──────────────────────────────────────
// Tracks multiple rounds of price negotiation between user and admin

export interface NegotiationRecord {
  id: number;
  influencerId: number;
  round: number;        // 1, 2, 3...
  userPrice: number;    // User-reported influencer quote
  adminPrice: number;   // Admin-reviewed price
  notes: string;        // Any notes about this round
  createdAt: string;    // YYYY-MM-DD
}

export function getNegotiations(influencerId: number): NegotiationRecord[] {
  return load<NegotiationRecord[]>(STORAGE_KEYS.negotiations, [])
    .filter((n) => n.influencerId === influencerId)
    .sort((a, b) => a.round - b.round);
}

export function addNegotiation(data: Omit<NegotiationRecord, "id" | "round">): NegotiationRecord {
  const all = load<NegotiationRecord[]>(STORAGE_KEYS.negotiations, []);
  const existing = all.filter((n) => n.influencerId === data.influencerId);
  const nextRound = existing.length > 0 ? Math.max(...existing.map((n) => n.round)) + 1 : 1;
  const counter = load(STORAGE_KEYS.negotiationCounter, 1);
  const record: NegotiationRecord = { ...data, id: counter, round: nextRound };
  save(STORAGE_KEYS.negotiationCounter, counter + 1);
  all.push(record);
  save(STORAGE_KEYS.negotiations, all);
  return record;
}

export function deleteNegotiation(id: number): boolean {
  const all = load<NegotiationRecord[]>(STORAGE_KEYS.negotiations, []);
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  save(STORAGE_KEYS.negotiations, all);
  return true;
}

// ─── Script Review ───────────────────────────────────────────
// Users submit scripts, admin approves/rejects with feedback

export interface ScriptReview {
  id: number;
  influencerId: number;
  round: number;              // 1, 2, 3...
  scriptText: string;         // The script content
  userNote: string;           // User's initial comments
  status: "pending" | "approved" | "rejected"; // Admin decision
  adminNote: string;          // Admin feedback
  submittedAt: string;        // YYYY-MM-DD
  reviewedAt: string;         // YYYY-MM-DD
}

export function getScriptReviews(influencerId: number): ScriptReview[] {
  return load<ScriptReview[]>(STORAGE_KEYS.scriptReviews, [])
    .filter((s) => s.influencerId === influencerId)
    .sort((a, b) => a.round - b.round);
}

export function addScriptReview(data: Omit<ScriptReview, "id" | "round" | "status" | "adminNote" | "reviewedAt">): ScriptReview {
  const all = load<ScriptReview[]>(STORAGE_KEYS.scriptReviews, []);
  const existing = all.filter((s) => s.influencerId === data.influencerId);
  const nextRound = existing.length > 0 ? Math.max(...existing.map((s) => s.round)) + 1 : 1;
  const counter = load(STORAGE_KEYS.scriptCounter, 1);
  const record: ScriptReview = {
    ...data,
    id: counter,
    round: nextRound,
    status: "pending",
    adminNote: "",
    reviewedAt: "",
  };
  save(STORAGE_KEYS.scriptCounter, counter + 1);
  all.push(record);
  save(STORAGE_KEYS.scriptReviews, all);
  return record;
}

export function reviewScript(id: number, status: "approved" | "rejected", adminNote: string): boolean {
  const all = load<ScriptReview[]>(STORAGE_KEYS.scriptReviews, []);
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  all[idx].status = status;
  all[idx].adminNote = adminNote;
  all[idx].reviewedAt = new Date().toISOString().split("T")[0];
  save(STORAGE_KEYS.scriptReviews, all);
  return true;
}

// ─── Video Review ────────────────────────────────────────────
// Users submit video drafts, admin approves/rejects with feedback

export interface VideoReview {
  id: number;
  influencerId: number;
  round: number;              // 1, 2, 3...
  videoUrl: string;           // URL to the video (uploaded file link) or base64 data URL
  videoFileName: string;      // Original file name (for uploaded files)
  userNote: string;           // User's initial comments
  status: "pending" | "approved" | "rejected"; // Admin decision
  adminNote: string;          // Admin feedback
  submittedAt: string;        // YYYY-MM-DD
  reviewedAt: string;         // YYYY-MM-DD
}

export function getVideoReviews(influencerId: number): VideoReview[] {
  return load<VideoReview[]>(STORAGE_KEYS.videoReviews, [])
    .filter((v) => v.influencerId === influencerId)
    .sort((a, b) => a.round - b.round);
}

export function addVideoReview(data: Omit<VideoReview, "id" | "round" | "status" | "adminNote" | "reviewedAt">): VideoReview {
  const all = load<VideoReview[]>(STORAGE_KEYS.videoReviews, []);
  const existing = all.filter((v) => v.influencerId === data.influencerId);
  const nextRound = existing.length > 0 ? Math.max(...existing.map((v) => v.round)) + 1 : 1;
  const counter = load(STORAGE_KEYS.videoCounter, 1);
  const record: VideoReview = {
    ...data,
    id: counter,
    round: nextRound,
    status: "pending",
    adminNote: "",
    reviewedAt: "",
  };
  save(STORAGE_KEYS.videoCounter, counter + 1);
  all.push(record);
  save(STORAGE_KEYS.videoReviews, all);
  return record;
}

export function reviewVideo(id: number, status: "approved" | "rejected", adminNote: string): boolean {
  const all = load<VideoReview[]>(STORAGE_KEYS.videoReviews, []);
  const idx = all.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  all[idx].status = status;
  all[idx].adminNote = adminNote;
  all[idx].reviewedAt = new Date().toISOString().split("T")[0];
  save(STORAGE_KEYS.videoReviews, all);
  return true;
}

// ─── Price Operations ─────────────────────────────────────────

export function updateUserPrice(influencerId: number, price: number): boolean {
  const all = getAllInfluencersRaw();
  const idx = all.findIndex((i) => i.id === influencerId);
  if (idx === -1) return false;
  all[idx].userPrice = price;
  all[idx].userPriceUpdatedAt = new Date().toISOString().split("T")[0];
  save(STORAGE_KEYS.influencers, all);
  return true;
}

export function updateAdminPrice(influencerId: number, price: number): boolean {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return false;
  const idx = all.findIndex((i) => i.id === influencerId);
  if (idx === -1) return false;
  all[idx].adminPrice = price;
  all[idx].adminPriceUpdatedAt = new Date().toISOString().split("T")[0];
  // When admin sets a price > 0, mark as cooperating; if price is 0, keep current status
  if (price > 0) {
    all[idx].coopStatus = "cooperating";
  }
  save(STORAGE_KEYS.influencers, all);
  return true;
}

// ─── Admin Operations ─────────────────────────────────────────

// Admin can delete any card; normal users can only delete their own cards
export function deleteInfluencer(id: number): boolean {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  if (!currentUser) return false;
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  // Admin can delete any card; normal users can only delete their own (createdBy === user.id)
  if (currentUser.role !== "admin" && all[idx].createdBy !== currentUser.id) return false;
  all.splice(idx, 1);
  save(STORAGE_KEYS.influencers, all);
  return true;
}

export function hideInfluencer(id: number): boolean {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return false;
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  all[idx].hidden = true;
  save(STORAGE_KEYS.influencers, all);
  return true;
}

export function unhideInfluencer(id: number): boolean {
  const all = getAllInfluencersRaw();
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return false;
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  all[idx].hidden = false;
  save(STORAGE_KEYS.influencers, all);
  return true;
}

// ─── Script Store ─────────────────────────────────────────────

export function getScripts(): Script[] {
  return load(STORAGE_KEYS.scripts, []);
}

export function getScriptById(id: number): Script | undefined {
  return getScripts().find((s) => s.id === id);
}

export function saveScript(script: Script) {
  const all = getScripts();
  const idx = all.findIndex((s) => s.id === script.id);
  if (idx >= 0) all[idx] = script;
  else all.push(script);
  save(STORAGE_KEYS.scripts, all);
}

export function deleteScript(id: number) {
  const all = getScripts().filter((s) => s.id !== id);
  save(STORAGE_KEYS.scripts, all);
}

export function getNextScriptId(): number {
  const current = load<number>(STORAGE_KEYS.scriptCounter, 1);
  const next = current + 1;
  save(STORAGE_KEYS.scriptCounter, next);
  return current;
}

// ─── Campaign Store ───────────────────────────────────────────

export function getCampaigns(): Campaign[] {
  return load(STORAGE_KEYS.campaigns, DEFAULT_CAMPAIGNS);
}

export function saveCampaign(campaign: Campaign) {
  const all = getCampaigns();
  const idx = all.findIndex((c) => c.id === campaign.id);
  if (idx >= 0) all[idx] = campaign;
  else all.push(campaign);
  save(STORAGE_KEYS.campaigns, all);
}

// ─── Trending Store ───────────────────────────────────────────

export function getTrending(): TrendingTopic[] {
  return load(STORAGE_KEYS.trending, DEFAULT_TRENDING);
}

// ─── Analytics Aggregates ─────────────────────────────────────

export function getDashboardStats() {
  const campaigns = getCampaigns();
  return {
    totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
    totalClicks: campaigns.reduce((s, c) => s + c.clicks, 0),
    totalConversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    avgRoi: campaigns.length > 0 ? campaigns.reduce((s, c) => s + c.roi, 0) / campaigns.length : 0,
    totalBudget: campaigns.reduce((s, c) => s + c.budget, 0),
    totalSpent: campaigns.reduce((s, c) => s + c.spent, 0),
  };
}

export function getPlatformBreakdown() {
  const influencers = getInfluencers();
  const platforms = ["instagram", "tiktok", "xiaohongshu", "douyin"] as const;
  return platforms.map((platform) => {
    const infs = influencers.filter((i) => i.platform === platform);
    return {
      platform,
      count: infs.length,
      totalFollowers: infs.reduce((s, i) => s + i.followers, 0),
      avgEngagement: infs.length > 0 ? infs.reduce((s, i) => s + i.engagementRate, 0) / infs.length : 0,
    };
  }).filter((p) => p.count > 0);
}

export function getNicheBreakdown() {
  const influencers = getInfluencers();
  const niches = [...new Set(influencers.map((i) => i.niche))];
  return niches.map((niche) => {
    const infs = influencers.filter((i) => i.niche === niche);
    return {
      niche,
      count: infs.length,
      totalFollowers: infs.reduce((s, i) => s + i.followers, 0),
      avgEngagement: infs.length > 0 ? infs.reduce((s, i) => s + i.engagementRate, 0) / infs.length : 0,
    };
  });
}

// ─── Collaboration Store ──────────────────────────────────────

export function getCollaborations(): CollaborationRecord[] {
  return load(STORAGE_KEYS.collaborations, []);
}

export function getCollaborationsByInfluencer(influencerId: number): CollaborationRecord[] {
  return getCollaborations()
    .filter((c) => c.influencerId === influencerId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getAllCollaborations(): CollaborationRecord[] {
  const currentUser = getCurrentUser();
  const all = getCollaborations();
  if (!currentUser) return all;
  if (currentUser.role === "admin") return all;
  // Normal user: only see their own records + system records (createdBy: 0)
  return all.filter((c) => c.createdBy === currentUser.id || c.createdBy === 0);
}

export function addCollaboration(data: Omit<CollaborationRecord, "id" | "createdBy">): CollaborationRecord {
  const all = getCollaborations();
  const currentUser = getCurrentUser();
  const counter = load(STORAGE_KEYS.collabCounter, 1);
  const record: CollaborationRecord = {
    ...data,
    id: counter,
    createdBy: currentUser?.id ?? 0,
  };
  save(STORAGE_KEYS.collabCounter, counter + 1);
  all.push(record);
  save(STORAGE_KEYS.collaborations, all);
  return record;
}

export function deleteCollaboration(id: number): boolean {
  const all = getCollaborations();
  const currentUser = getCurrentUser();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  // Only admin or owner can delete
  if (currentUser?.role !== "admin" && all[idx].createdBy !== currentUser?.id) return false;
  all.splice(idx, 1);
  save(STORAGE_KEYS.collaborations, all);
  return true;
}

export function getCollaborationStats() {
  const all = getAllCollaborations();
  return {
    totalCollabs: all.length,
    totalExposures: all.reduce((s, c) => s + c.exposures, 0),
    totalLikes: all.reduce((s, c) => s + c.likes, 0),
    totalComments: all.reduce((s, c) => s + c.comments, 0),
    totalShares: all.reduce((s, c) => s + c.shares, 0),
    avgEngagementRate: all.length > 0
      ? all.reduce((s, c) => s + (c.likes + c.comments + c.shares) / (c.exposures || 1), 0) / all.length * 100
      : 0,
  };
}

// ─── Reset to defaults ────────────────────────────────────────

export function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.influencers);
  localStorage.removeItem(STORAGE_KEYS.scripts);
  localStorage.removeItem(STORAGE_KEYS.campaigns);
  localStorage.removeItem(STORAGE_KEYS.trending);
  localStorage.removeItem(STORAGE_KEYS.scriptCounter);
  localStorage.removeItem(STORAGE_KEYS.collaborations);
  localStorage.removeItem(STORAGE_KEYS.collabCounter);
}