import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useHashtagList,
  useHashtagCategoryList,
  useCreateHashtag,
  useDeleteHashtag,
  useCreateHashtagCategory,
  useDeleteHashtagCategory,
} from "@/lib/influencer-api";
import { Hash, Plus, X, Trash2, Tag, FolderPlus } from "lucide-react";

const PRESET_COLORS = [
  "#ccff00", "#06b6d4", "#ef4444", "#f59e0b", "#10b981",
  "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

// Format creator name from unionId
function formatCreator(unionId?: string): string {
  if (!unionId) return "未知";
  if (unionId.startsWith("local_")) return unionId.replace("local_", "");
  return unionId.substring(0, 12) + "...";
}

export default function TopicTracker() {
  const { isAdmin, user, isAuthenticated } = useAuth();
  const { data: tags = [] } = useHashtagList();
  const { data: categories = [] } = useHashtagCategoryList();
  const createTag = useCreateHashtag();
  const deleteTag = useDeleteHashtag();
  const createCategory = useCreateHashtagCategory();
  const deleteCategory = useDeleteHashtagCategory();

  // Permission: admin can edit all, users can edit their own
  const canEdit = (item: any) => isAdmin || (user && item?.createdByUnionId === user.unionId);

  const [showAddTag, setShowAddTag] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagUrl, setNewTagUrl] = useState("");
  const [newTagCategoryId, setNewTagCategoryId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);

  // Build category map
  const catMap = new Map<number, { name: string; color: string }>();
  (categories || []).filter(Boolean).forEach((c: any) => {
    if (c?.id != null) catMap.set(c.id, { name: c.name, color: c.color });
  });

  // Group hashtags by category
  const grouped: Record<number, any[]> = {};
  const uncategorized: any[] = [];
  (tags || []).filter(Boolean).forEach((t: any) => {
    if (!t) return;
    if (t.categoryId && grouped[t.categoryId]) {
      grouped[t.categoryId].push(t);
    } else if (t.categoryId) {
      grouped[t.categoryId] = [t];
    } else {
      uncategorized.push(t);
    }
  });

  const handleAddTag = () => {
    if (!newTagName.trim() || !newTagUrl.trim()) return;
    const name = newTagName.trim().startsWith("#") ? newTagName.trim() : "#" + newTagName.trim();
    createTag.mutate({
      name,
      url: newTagUrl.trim(),
      categoryId: newTagCategoryId,
      createdAt: new Date().toISOString().split("T")[0],
    }, {
      onSuccess: () => {
        setNewTagName(""); setNewTagUrl(""); setNewTagCategoryId(null); setShowAddTag(false);
      }
    });
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    createCategory.mutate({
      name: newCatName.trim(),
      color: newCatColor,
      createdAt: new Date().toISOString().split("T")[0],
    }, {
      onSuccess: () => {
        setNewCatName(""); setNewCatColor(PRESET_COLORS[0]); setShowAddCategory(false);
      }
    });
  };

  const renderTag = (t: any, catColor?: string) => (
    <div key={t.id} className="group/tag relative inline-flex flex-col items-start">
      <a
        href={t.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border"
        style={{
          backgroundColor: (catColor || "#ccff00") + "12",
          borderColor: (catColor || "#ccff00") + "30",
          color: catColor || "#ccff00",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = (catColor || "#ccff00") + "25";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = (catColor || "#ccff00") + "12";
        }}
      >
        <Hash className="w-3 h-3" />
        {t.name}
      </a>
      {isAdmin && t.createdByUnionId && (
        <span className="text-[8px] text-faint pl-1 mt-0.5">{formatCreator(t.createdByUnionId)}</span>
      )}
      {canEdit(t) && (
        <button
          onClick={() => deleteTag.mutate({ id: t.id })}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-content flex items-center justify-center opacity-0 group-hover/tag:opacity-100 transition-opacity"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-brand" />
          <h2 className="section-title">话题追踪</h2>
          <span className="text-[10px] text-faint">{tags.length} 个话题</span>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCategory(!showAddCategory)}
              className="text-[10px] px-2 py-1 rounded-lg bg-hover text-sub hover:bg-hover hover:text-content transition-all flex items-center gap-1"
            >
              <FolderPlus className="w-3 h-3" />分类
            </button>
            <button
              onClick={() => setShowAddTag(!showAddTag)}
              className="text-[10px] px-2 py-1 rounded-lg bg-lime/10 text-brand hover:bg-lime/20 transition-all flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />话题
            </button>
          </div>
        )}
      </div>

      {/* Add Category Form */}
      {showAddCategory && isAdmin && (
        <div className="p-3 rounded-xl bg-hover border border-brand/10 space-y-2">
          <p className="text-[10px] text-sub">新建分类</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="分类名称（如：美妆、美食）"
              className="flex-1 bg-base border border-line rounded-lg px-3 py-1.5 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30"
            />
            <div className="flex items-center gap-1">
              {PRESET_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  onClick={() => setNewCatColor(c)}
                  className="w-5 h-5 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: newCatColor === c ? "#fff" : "transparent",
                  }}
                />
              ))}
            </div>
            <button onClick={handleAddCategory} className="px-3 py-1.5 rounded-lg bg-lime text-black text-[10px] font-bold">创建</button>
            <button onClick={() => setShowAddCategory(false)} className="px-2 py-1.5 rounded-lg bg-hover text-faint text-[10px]">取消</button>
          </div>
        </div>
      )}

      {/* Add Hashtag Form */}
      {showAddTag && isAdmin && (
        <div className="p-3 rounded-xl bg-hover border border-brand/10 space-y-2">
          <p className="text-[10px] text-sub">新建话题</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="#话题名称"
              className="w-32 bg-base border border-line rounded-lg px-3 py-1.5 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30"
            />
            <input
              type="url"
              value={newTagUrl}
              onChange={(e) => setNewTagUrl(e.target.value)}
              placeholder="链接地址"
              className="flex-1 bg-base border border-line rounded-lg px-3 py-1.5 text-xs text-content placeholder:text-faint focus:outline-none focus:border-brand/30"
            />
            <select
              value={newTagCategoryId || ""}
              onChange={(e) => setNewTagCategoryId(e.target.value ? parseInt(e.target.value) : null)}
              className="bg-base border border-line rounded-lg px-2 py-1.5 text-xs text-content focus:outline-none focus:border-brand/30"
            >
              <option value="">选择分类</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button onClick={handleAddTag} className="px-3 py-1.5 rounded-lg bg-lime text-black text-[10px] font-bold">添加</button>
            <button onClick={() => setShowAddTag(false)} className="px-2 py-1.5 rounded-lg bg-hover text-faint text-[10px]">取消</button>
          </div>
        </div>
      )}

      {/* Hashtags by Category */}
      <div className="space-y-3">
        {categories.map((cat: any) => {
          const catTags = grouped[cat.id] || [];
          if (catTags.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[11px] font-medium text-content">{cat.name}</span>
                <span className="text-[10px] text-faint">{catTags.length}</span>
                {isAdmin && cat.createdByUnionId && (
                  <span className="text-[9px] text-faint ml-1">by {formatCreator(cat.createdByUnionId)}</span>
                )}
                {canEdit(cat) && (
                  <button
                    onClick={() => { if (confirm("删除此分类？")) deleteCategory.mutate({ id: cat.id }); }}
                    className="text-[9px] text-faint hover:text-red-400 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {catTags.map((t: any) => renderTag(t, cat.color))}
              </div>
            </div>
          );
        })}

        {/* Uncategorized */}
        {uncategorized.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-faint" />
              <span className="text-[11px] font-medium text-sub">未分类</span>
              <span className="text-[10px] text-faint">{uncategorized.length}</span>
              {isAdmin && uncategorized.some((t: any) => t.createdByUnionId) && (
                <span className="text-[9px] text-faint">（多用户）</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uncategorized.map((t: any) => renderTag(t, "#888"))}
            </div>
          </div>
        )}

        {tags.length === 0 && (
          <div className="text-center py-6">
            <Hash className="w-6 h-6 text-faint mx-auto mb-2" />
            <p className="text-xs text-faint">暂无话题</p>
            <p className="text-[10px] text-faint">{isAuthenticated ? "点击右上角添加话题" : "登录后可添加话题"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
