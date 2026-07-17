// Influencer API layer — tRPC hooks replacing localStorage
// All data is now shared through the backend database

import { trpc } from "@/providers/trpc";

// ─── Influencer Hooks ─────────────────────────────────────────

export function useInfluencerList(input?: {
  platform?: string;
  niche?: string;
  search?: string;
  creator?: string;
}) {
  return trpc.influencer.list.useQuery(input || {});
}

export function useInfluencerById(id: number | null) {
  return trpc.influencer.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );
}

export function useCreateInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.create.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getNiches.invalidate();
      utils.influencer.getCreators.invalidate();
    },
  });
}

export function useUpdateInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.update.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getById.invalidate();
    },
  });
}

export function useDeleteInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.delete.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getNiches.invalidate();
      utils.influencer.getCreators.invalidate();
    },
  });
}

export function useHideInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.hide.useMutation({
    onSuccess: () => utils.influencer.list.invalidate(),
  });
}

export function useUnhideInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.unhide.useMutation({
    onSuccess: () => utils.influencer.list.invalidate(),
  });
}

export function useUpdateUserPrice() {
  const utils = trpc.useUtils();
  return trpc.influencer.updateUserPrice.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getById.invalidate();
    },
  });
}

export function useUpdateAdminPrice() {
  const utils = trpc.useUtils();
  return trpc.influencer.updateAdminPrice.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getById.invalidate();
    },
  });
}

export function useSetNotCooperating() {
  const utils = trpc.useUtils();
  return trpc.influencer.setNotCooperating.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getById.invalidate();
    },
  });
}

export function useInfluencerNiches() {
  return trpc.influencer.getNiches.useQuery();
}

export function useInfluencerCreators() {
  return trpc.influencer.getCreators.useQuery();
}

// ─── Negotiation Hooks ────────────────────────────────────────

export function useNegotiationList(influencerId: number | null) {
  return trpc.negotiation.list.useQuery(
    { influencerId: influencerId! },
    { enabled: !!influencerId }
  );
}

export function useNegotiationListAll(influencerIds: number[]) {
  return trpc.negotiation.listAll.useQuery(
    { influencerIds },
    { enabled: influencerIds.length > 0 }
  );
}

export function useCreateNegotiation() {
  const utils = trpc.useUtils();
  return trpc.negotiation.create.useMutation({
    onSuccess: (_, vars) => {
      utils.negotiation.list.invalidate({ influencerId: vars.influencerId });
    },
  });
}

export function useDeleteNegotiation() {
  const utils = trpc.useUtils();
  return trpc.negotiation.delete.useMutation({
    onSuccess: () => utils.negotiation.list.invalidate(),
  });
}

// ─── Script Review Hooks ──────────────────────────────────────

export function useScriptReviewList(influencerId: number | null) {
  return trpc.scriptReview.list.useQuery(
    { influencerId: influencerId! },
    { enabled: !!influencerId }
  );
}

export function useCreateScriptReview() {
  const utils = trpc.useUtils();
  return trpc.scriptReview.create.useMutation({
    onSuccess: (_, vars) => {
      utils.scriptReview.list.invalidate({ influencerId: vars.influencerId });
    },
  });
}

export function useReviewScript() {
  const utils = trpc.useUtils();
  return trpc.scriptReview.review.useMutation({
    onSuccess: () => utils.scriptReview.list.invalidate(),
  });
}

// ─── Video Review Hooks ───────────────────────────────────────

export function useVideoReviewList(influencerId: number | null) {
  return trpc.videoReview.list.useQuery(
    { influencerId: influencerId! },
    { enabled: !!influencerId }
  );
}

export function useCreateVideoReview() {
  const utils = trpc.useUtils();
  return trpc.videoReview.create.useMutation({
    onSuccess: (_, vars) => {
      utils.videoReview.list.invalidate({ influencerId: vars.influencerId });
    },
  });
}

export function useReviewVideo() {
  const utils = trpc.useUtils();
  return trpc.videoReview.review.useMutation({
    onSuccess: () => utils.videoReview.list.invalidate(),
  });
}

// ─── User List Hook (for admin role management) ───────────────

export function useUserList() {
  return trpc.auth.list.useQuery(undefined, {
    retry: false,
  });
}

// ─── Notification Hooks ───────────────────────────────────────

export function useNotificationList(unreadOnly?: boolean) {
  return trpc.notification.list.useQuery(
    { unreadOnly: unreadOnly ?? false },
    { refetchInterval: 30000 } // Poll every 30s
  );
}

export function useUnreadNotificationCount() {
  return trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const utils = trpc.useUtils();
  return trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
}

export function useMarkAllNotificationsRead() {
  const utils = trpc.useUtils();
  return trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
}

export function useCleanupTestData() {
  const utils = trpc.useUtils();
  return trpc.notification.cleanupTestData.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
}
