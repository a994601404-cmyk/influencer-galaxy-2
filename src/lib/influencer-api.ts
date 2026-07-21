// Influencer API layer — tRPC hooks replacing localStorage
// All data is now shared through the backend database

import { trpc } from "@/providers/trpc";
import { useQueryClient } from "@tanstack/react-query";

// ─── Optimistic-update helpers ────────────────────────────────
// cardCategory.list data shape: { categories: any[], items: any[], isAdmin: boolean }
// items are ordered by (isPinned DESC, sortOrder ASC) per category on the server;
// these helpers replicate that ordering locally for instant UI feedback.

function reorderCategoryItems(items: any[], categoryId: number): any[] {
  const inCat = items.filter((i) => i.categoryId === categoryId);
  const pinned = inCat.filter((i) => i.isPinned === 1 || i.isPinned === true);
  const normal = inCat.filter((i) => !(i.isPinned === 1 || i.isPinned === true));
  const queue = [...pinned, ...normal];
  return items.map((i) => (i.categoryId === categoryId ? queue.shift() : i));
}

type CatListData = { categories: any[]; items: any[]; isAdmin: boolean } | undefined;

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
  const queryClient = useQueryClient();
  return trpc.influencer.delete.useMutation({
    onMutate: async (vars) => {
      await utils.cardCategory.list.cancel();
      await queryClient.cancelQueries({ queryKey: [["influencer", "list"]] });
      const prevCat = utils.cardCategory.list.getData();
      const prevInf = queryClient.getQueriesData({ queryKey: [["influencer", "list"]] });
      // Remove the card from category view instantly
      utils.cardCategory.list.setData(undefined, (old: CatListData) =>
        old ? { ...old, items: old.items.filter((i) => i.influencerId !== vars.id) } : old
      );
      // Remove from influencer lists (all filter variants)
      queryClient.setQueriesData({ queryKey: [["influencer", "list"]] }, (old: any) =>
        old?.items ? { ...old, items: old.items.filter((i: any) => i.id !== vars.id), total: Math.max(0, (old.total ?? 1) - 1) } : old
      );
      return { prevCat, prevInf };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevCat) utils.cardCategory.list.setData(undefined, ctx.prevCat);
      ctx?.prevInf?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      alert(err.message || "删除失败");
    },
    onSettled: () => {
      utils.influencer.list.invalidate();
      utils.influencer.getNiches.invalidate();
      utils.influencer.getCreators.invalidate();
      utils.influencer.trashList.invalidate();
      utils.cardCategory.list.invalidate();
    },
  });
}

export function useTrashList() {
  return trpc.influencer.trashList.useQuery();
}

export function useRestoreInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.restore.useMutation({
    onSuccess: () => {
      utils.influencer.list.invalidate();
      utils.influencer.trashList.invalidate();
      utils.cardCategory.list.invalidate();
    },
    onError: (err) => alert(err.message || "恢复失败"),
  });
}

export function useDestroyInfluencer() {
  const utils = trpc.useUtils();
  return trpc.influencer.destroy.useMutation({
    onSuccess: () => {
      utils.influencer.trashList.invalidate();
    },
    onError: (err) => alert(err.message || "彻底删除失败"),
  });
}

export function useHideInfluencer() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  return trpc.influencer.hide.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: [["influencer", "list"]] });
      const prevInf = queryClient.getQueriesData({ queryKey: [["influencer", "list"]] });
      queryClient.setQueriesData({ queryKey: [["influencer", "list"]] }, (old: any) =>
        old?.items ? { ...old, items: old.items.map((i: any) => (i.id === vars.id ? { ...i, hidden: true } : i)) } : old
      );
      return { prevInf };
    },
    onError: (err, _vars, ctx) => {
      ctx?.prevInf?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      alert(err.message || "隐藏失败");
    },
    onSettled: () => utils.influencer.list.invalidate(),
  });
}

export function useUnhideInfluencer() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  return trpc.influencer.unhide.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: [["influencer", "list"]] });
      const prevInf = queryClient.getQueriesData({ queryKey: [["influencer", "list"]] });
      queryClient.setQueriesData({ queryKey: [["influencer", "list"]] }, (old: any) =>
        old?.items ? { ...old, items: old.items.map((i: any) => (i.id === vars.id ? { ...i, hidden: false } : i)) } : old
      );
      return { prevInf };
    },
    onError: (err, _vars, ctx) => {
      ctx?.prevInf?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      alert(err.message || "取消隐藏失败");
    },
    onSettled: () => utils.influencer.list.invalidate(),
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

export function useNegotiationListAll(influencerIds?: number[]) {
  // No-arg call fetches ALL negotiation records (backend treats missing
  // ids as "return everything"); an explicit empty array stays disabled.
  return trpc.negotiation.listAll.useQuery(
    influencerIds && influencerIds.length > 0 ? { influencerIds } : undefined,
    { enabled: influencerIds === undefined || influencerIds.length > 0 }
  );
}

export function useCreateNegotiation() {
  const utils = trpc.useUtils();
  return trpc.negotiation.create.useMutation({
    onSuccess: (_, vars) => {
      utils.negotiation.list.invalidate({ influencerId: vars.influencerId });
      utils.negotiation.listAll.invalidate();
    },
  });
}

export function useUpdateNegotiation() {
  const utils = trpc.useUtils();
  return trpc.negotiation.update.useMutation({
    onSuccess: (_, vars) => {
      utils.negotiation.list.invalidate({ influencerId: vars.influencerId });
      utils.negotiation.listAll.invalidate();
      utils.influencer.list.invalidate();
    },
  });
}

export function useDeleteNegotiation() {
  const utils = trpc.useUtils();
  return trpc.negotiation.delete.useMutation({
    onSuccess: () => utils.negotiation.list.invalidate(),
  });
}

// ─── Post Record Hooks (发布记录) ────────────────────────────
export function usePostList(influencerId: number | null) {
  return trpc.post.list.useQuery(
    { influencerId: influencerId! },
    { enabled: !!influencerId }
  );
}

export function useCreatePost() {
  const utils = trpc.useUtils();
  return trpc.post.create.useMutation({
    onSuccess: (_, vars) => {
      utils.post.list.invalidate({ influencerId: vars.influencerId });
      utils.post.listAll.invalidate();
    },
  });
}

export function useUpdatePost() {
  const utils = trpc.useUtils();
  return trpc.post.update.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      utils.post.listAll.invalidate();
    },
  });
}

export function useDeletePost() {
  const utils = trpc.useUtils();
  return trpc.post.delete.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      utils.post.listAll.invalidate();
    },
  });
}

export function usePostListAll() {
  return trpc.post.listAll.useQuery();
}

export function useReviewPost() {
  const utils = trpc.useUtils();
  return trpc.post.review.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      utils.post.listAll.invalidate();
    },
  });
}

// ─── Hashtag Hooks (话题追踪) ───────────────────────────────
export function useHashtagList() {
  return trpc.hashtag.list.useQuery();
}

export function useHashtagCategoryList() {
  return trpc.hashtag.categoryList.useQuery();
}

export function useCreateHashtag() {
  const utils = trpc.useUtils();
  return trpc.hashtag.create.useMutation({
    onSuccess: () => {
      utils.hashtag.list.invalidate();
    },
  });
}

export function useDeleteHashtag() {
  const utils = trpc.useUtils();
  return trpc.hashtag.delete.useMutation({
    onSuccess: () => {
      utils.hashtag.list.invalidate();
    },
  });
}

export function useCreateHashtagCategory() {
  const utils = trpc.useUtils();
  return trpc.hashtag.categoryCreate.useMutation({
    onSuccess: () => {
      utils.hashtag.categoryList.invalidate();
    },
  });
}

export function useDeleteHashtagCategory() {
  const utils = trpc.useUtils();
  return trpc.hashtag.categoryDelete.useMutation({
    onSuccess: () => {
      utils.hashtag.categoryList.invalidate();
      utils.hashtag.list.invalidate();
    },
  });
}

// ─── Script Review Hooks ──────────────────────────────────────

export function useScriptReviewList(influencerId: number | null) {
  return trpc.scriptReview.list.useQuery(
    { influencerId: influencerId! },
    { enabled: !!influencerId }
  );
}

export function useScriptReviewListAll() {
  return trpc.scriptReview.listAll.useQuery();
}

export function useCreateScriptReview() {
  const utils = trpc.useUtils();
  return trpc.scriptReview.create.useMutation({
    onSuccess: (_, vars) => {
      utils.scriptReview.list.invalidate({ influencerId: vars.influencerId });
      utils.scriptReview.listAll.invalidate();
    },
  });
}

export function useReviewScript() {
  const utils = trpc.useUtils();
  return trpc.scriptReview.review.useMutation({
    onSuccess: () => {
      utils.scriptReview.list.invalidate();
      utils.scriptReview.listAll.invalidate();
    },
  });
}

// ─── Video Review Hooks ───────────────────────────────────────

export function useVideoReviewList(influencerId: number | null) {
  return trpc.videoReview.list.useQuery(
    { influencerId: influencerId! },
    { enabled: !!influencerId }
  );
}

export function useVideoReviewListAll() {
  return trpc.videoReview.listAll.useQuery();
}

export function useCreateVideoReview() {
  const utils = trpc.useUtils();
  return trpc.videoReview.create.useMutation({
    onSuccess: (_, vars) => {
      utils.videoReview.list.invalidate({ influencerId: vars.influencerId });
      utils.videoReview.listAll.invalidate();
    },
  });
}

export function useReviewVideo() {
  const utils = trpc.useUtils();
  return trpc.videoReview.review.useMutation({
    onSuccess: () => {
      utils.videoReview.list.invalidate();
      utils.videoReview.listAll.invalidate();
    },
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

// ─── Card Category Hooks ──────────────────────────────────────

export function useCardCategoryList() {
  return trpc.cardCategory.list.useQuery();
}

export function useCreateCardCategory() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.create.useMutation({
    onSuccess: () => utils.cardCategory.list.invalidate(),
  });
}

export function useUpdateCardCategory() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.update.useMutation({
    onSuccess: () => utils.cardCategory.list.invalidate(),
  });
}

export function useDeleteCardCategory() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.delete.useMutation({
    onSuccess: () => utils.cardCategory.list.invalidate(),
  });
}

export function useToggleCategoryExpand() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.toggleExpand.useMutation({
    onSuccess: () => utils.cardCategory.list.invalidate(),
  });
}

export function useMoveCardToCategory() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.moveCard.useMutation({
    onMutate: async (vars) => {
      await utils.cardCategory.list.cancel();
      const prev = utils.cardCategory.list.getData();
      utils.cardCategory.list.setData(undefined, (old: CatListData) => {
        if (!old) return old;
        const maxOrder = Math.max(-1, ...old.items.filter((i) => i.categoryId === vars.toCategoryId).map((i) => i.sortOrder ?? 0));
        let items = old.items.map((i) =>
          i.influencerId === vars.influencerId && i.categoryId === vars.fromCategoryId
            ? { ...i, categoryId: vars.toCategoryId, sortOrder: maxOrder + 1 }
            : i
        );
        // Card had no row yet (uncategorized fallback) — create a temp one
        if (!items.some((i) => i.influencerId === vars.influencerId && i.categoryId === vars.toCategoryId)) {
          items = [...items, { id: `tmp-move-${vars.influencerId}`, categoryId: vars.toCategoryId, influencerId: vars.influencerId, sortOrder: maxOrder + 1, isPinned: 0 }];
        }
        items = reorderCategoryItems(items, vars.toCategoryId);
        return { ...old, items };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.cardCategory.list.setData(undefined, ctx.prev);
      alert(err.message || "移动失败");
    },
    onSettled: () => utils.cardCategory.list.invalidate(),
  });
}

export function useToggleCategoryPin() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.togglePin.useMutation({
    onMutate: async (vars) => {
      await utils.cardCategory.list.cancel();
      const prev = utils.cardCategory.list.getData();
      utils.cardCategory.list.setData(undefined, (old: CatListData) => {
        if (!old) return old;
        const exists = old.items.some((i) => i.influencerId === vars.influencerId && i.categoryId === vars.categoryId);
        let items = exists
          ? old.items.map((i) =>
              i.influencerId === vars.influencerId && i.categoryId === vars.categoryId
                ? { ...i, isPinned: i.isPinned === 1 ? 0 : 1 }
                : i
            )
          : [...old.items, { id: `tmp-pin-${vars.influencerId}`, categoryId: vars.categoryId, influencerId: vars.influencerId, sortOrder: 999, isPinned: 1 }];
        items = reorderCategoryItems(items, vars.categoryId);
        return { ...old, items };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.cardCategory.list.setData(undefined, ctx.prev);
      alert(err.message || "置顶失败");
    },
    onSettled: () => utils.cardCategory.list.invalidate(),
  });
}

export function useSaveCategoryOrder() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.saveCategoryOrder.useMutation({
    onMutate: async (vars) => {
      await utils.cardCategory.list.cancel();
      const prev = utils.cardCategory.list.getData();
      utils.cardCategory.list.setData(undefined, (old: CatListData) => {
        if (!old) return old;
        const orderMap = new Map(vars.orders.map((o) => [o.id, o.sortOrder]));
        const categories = old.categories
          .map((c) => (orderMap.has(c.id) ? { ...c, sortOrder: orderMap.get(c.id) } : c))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return { ...old, categories };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.cardCategory.list.setData(undefined, ctx.prev);
      alert(err.message || "分类排序失败");
    },
    onSettled: () => utils.cardCategory.list.invalidate(),
  });
}

export function useSaveCardOrderInCategory() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.saveCardOrder.useMutation({
    onMutate: async (vars) => {
      await utils.cardCategory.list.cancel();
      const prev = utils.cardCategory.list.getData();
      utils.cardCategory.list.setData(undefined, (old: CatListData) => {
        if (!old) return old;
        const orderMap = new Map(vars.orders.map((o) => [o.influencerId, o.sortOrder]));
        const items = old.items.map((i) =>
          i.categoryId === vars.categoryId && orderMap.has(i.influencerId)
            ? { ...i, sortOrder: orderMap.get(i.influencerId) }
            : i
        );
        return { ...old, items: reorderCategoryItems(items, vars.categoryId) };
      });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.cardCategory.list.setData(undefined, ctx.prev);
      alert(err.message || "排序失败");
    },
    onSettled: () => utils.cardCategory.list.invalidate(),
  });
}

export function useAssignCardToCategory() {
  const utils = trpc.useUtils();
  return trpc.cardCategory.assignCard.useMutation({
    onSuccess: () => utils.cardCategory.list.invalidate(),
  });
}

// ─── Card Preference Hooks (drag sort + pin) ──────────────────

export function useCardPreferenceList() {
  return trpc.cardPreference.list.useQuery();
}

export function useSaveCardOrder() {
  const utils = trpc.useUtils();
  return trpc.cardPreference.saveOrder.useMutation({
    onSuccess: () => {
      utils.cardPreference.list.invalidate();
    },
  });
}

export function useToggleCardPin() {
  const utils = trpc.useUtils();
  return trpc.cardPreference.togglePin.useMutation({
    onSuccess: () => {
      utils.cardPreference.list.invalidate();
    },
  });
}
