import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Link } from "react-router";
import { getScriptById, getScripts, type Script } from "@/lib/data-store";
import {
  Film,
  Clock,
  Eye,
  Volume2,
  ChevronRight,
  ChevronLeft,
  Wand2,
  AlertCircle,
} from "lucide-react";

const typeLabels: Record<string, { label: string; color: string; bg: string }> = {
  hook: { label: "开场", color: "#ccff00", bg: "rgba(204,255,0,0.12)" },
  problem: { label: "痛点", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  solution: { label: "方案", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  education: { label: "教学", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  cta: { label: "CTA", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const sceneGradients: Record<string, string> = {
  hook: "from-[#ccff00]/10 to-[#ccff00]/0",
  problem: "from-[#f59e0b]/10 to-[#f59e0b]/0",
  solution: "from-[#10b981]/10 to-[#10b981]/0",
  education: "from-[#06b6d4]/10 to-[#06b6d4]/0",
  cta: "from-[#ef4444]/10 to-[#ef4444]/0",
};

export default function Storyboard() {
  const [searchParams] = useSearchParams();
  const scriptId = searchParams.get("script");
  const [selectedScene, setSelectedScene] = useState(0);
  const [script, setScript] = useState<Script | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showAllScripts, setShowAllScripts] = useState(!scriptId);

  useEffect(() => {
    const allScripts = getScripts().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setScripts(allScripts);
    if (scriptId) {
      const s = getScriptById(Number(scriptId));
      if (s) { setScript(s); setShowAllScripts(false); } else setShowAllScripts(true);
    } else if (allScripts.length > 0) { setScript(allScripts[0]); setShowAllScripts(false); }
  }, [scriptId]);

  const segments = script?.segments || [];
  const currentScene = segments[selectedScene];

  if (showAllScripts) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3"><Film className="w-5 h-5 text-[#ccff00]" /><h1 className="section-title">分镜拆解</h1></div>
        {scripts.length === 0 ? (
          <div className="card-surface p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
            <div className="w-14 h-14 rounded-2xl bg-[#ccff00]/10 flex items-center justify-center mb-4"><AlertCircle className="w-7 h-7 text-[#ccff00]" /></div>
            <h3 className="text-base font-bold text-white mb-1">暂无脚本</h3>
            <p className="text-xs text-[#666] mb-4">先在脚本生成页面创建脚本</p>
            <Link to="/script-generator"><button className="btn-lime text-xs flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />去生成脚本</button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scripts.map((s) => (
              <button key={s.id} onClick={() => { setScript(s); setShowAllScripts(false); setSelectedScene(0); }}
                className="card-surface p-4 text-left hover:border-[#ccff00]/20 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white group-hover:text-[#ccff00] transition-colors">{s.productName}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">{s.segments.length} 镜头</span>
                </div>
                <p className="text-[10px] text-[#666] mb-2">{s.personaStyle} · {s.duration}秒</p>
                <p className="text-[10px] text-[#555] italic line-clamp-1">"{s.segments[0]?.text}"</p>
                <div className="flex gap-1 mt-2">{s.segments.map((seg, i) => {
                  const ti = typeLabels[seg.type] || typeLabels.hook;
                  return <div key={i} className="flex-1 h-1 rounded-full" style={{ backgroundColor: ti.color }} />;
                })}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!script || segments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3"><Film className="w-5 h-5 text-[#ccff00]" /><h1 className="section-title">分镜拆解</h1></div>
        <div className="card-surface p-12 flex flex-col items-center justify-center text-center">
          <Link to="/script-generator"><button className="btn-lime text-xs flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />去生成脚本</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-[#ccff00]" />
          <h1 className="section-title">分镜拆解</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] font-medium">{script.productName}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAllScripts(true)} className="px-4 py-2 rounded-full border border-white/[0.08] text-[#666] hover:text-white text-xs transition-all">切换脚本</button>
          <Link to="/script-generator"><button className="btn-lime text-xs flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />新建脚本</button></Link>
        </div>
      </div>

      {/* Scene Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {segments.map((seg, idx) => {
          const typeInfo = typeLabels[seg.type] || typeLabels.hook;
          return (
            <button key={idx} onClick={() => setSelectedScene(idx)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${selectedScene === idx ? "bg-[#ccff00]/8 border border-[#ccff00]/25" : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: typeInfo.bg, color: typeInfo.color }}>{seg.timestamp}</div>
              <div className="text-left"><p className="text-[11px] text-white font-medium">{typeInfo.label}</p><p className="text-[9px] text-[#666] truncate max-w-[80px]">{seg.text.slice(0, 12)}...</p></div>
            </button>
          );
        })}
      </div>

      {currentScene && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fade-in-up">
          {/* Visual Panel */}
          <div className="card-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">画面指导</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-[#888]">{currentScene.visual.includes("特写") ? "特写镜头" : currentScene.visual.includes("分屏") ? "分屏对比" : currentScene.visual.includes("俯拍") ? "俯视角度" : "中景/全景"}</span>
            </div>
            <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br ${sceneGradients[currentScene.type] || sceneGradients.hook} border border-white/[0.04] flex items-center justify-center p-8`}>
              <div className="text-center">
                <Film className="w-10 h-10 text-white/[0.08] mx-auto mb-2" />
                <p className="text-xs text-[#666]">{typeLabels[currentScene.type]?.label}</p>
                <p className="text-[10px] text-[#444]">{currentScene.timestamp}</p>
              </div>
              <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-mono"><Clock className="w-2.5 h-2.5 inline mr-1" />{currentScene.timestamp}</div>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: typeLabels[currentScene.type]?.bg, color: typeLabels[currentScene.type]?.color }}>{typeLabels[currentScene.type]?.label}</div>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-white/[0.02]"><p className="text-[10px] text-[#666] mb-0.5 font-medium"><Eye className="w-3 h-3 inline mr-1" />画面描述</p><p className="text-xs text-white leading-relaxed">{currentScene.visual}</p></div>
          </div>

          {/* Details Panel */}
          <div className="space-y-3">
            <div className="card-surface p-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5"><Film className="w-4 h-4 text-[#06b6d4]" />口播文案</h3>
              <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/[0.04]"><p className="text-white text-sm leading-relaxed">{currentScene.text}</p></div>
            </div>
            <div className="card-surface p-4">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5"><Volume2 className="w-4 h-4 text-[#f59e0b]" />声音 / 字幕设计</h3>
              <div className="p-3 rounded-xl bg-[#0a0a0a] border border-white/[0.04]"><p className="text-xs text-[#888] leading-relaxed">{currentScene.audio}</p></div>
            </div>
            <div className="card-surface p-4">
              <h3 className="text-sm font-bold text-white mb-3">场景信息</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "时间戳", value: currentScene.timestamp },
                  { label: "场景类型", value: typeLabels[currentScene.type]?.label, color: typeLabels[currentScene.type]?.color },
                  { label: "镜头建议", value: currentScene.visual.includes("特写") ? "特写" : currentScene.visual.includes("分屏") ? "分屏" : "中景" },
                  { label: "时长建议", value: `${Math.round(script.duration / segments.length)}秒` },
                ].map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/[0.02]">
                    <p className="text-[10px] text-[#555]">{item.label}</p>
                    <p className="text-xs font-bold" style={{ color: (item as any).color || "#fff" }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedScene(Math.max(0, selectedScene - 1))} disabled={selectedScene === 0}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.06] text-[#666] hover:text-white text-xs font-medium disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4 inline mr-1" />上一帧</button>
              <button onClick={() => setSelectedScene(Math.min(segments.length - 1, selectedScene + 1))} disabled={selectedScene === segments.length - 1}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.06] text-[#666] hover:text-white text-xs font-medium disabled:opacity-30 transition-all">下一帧<ChevronRight className="w-4 h-4 inline ml-1" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card-surface p-4">
        <h3 className="text-sm font-bold text-white mb-4">完整时间线</h3>
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/[0.04]" />
          <div className="flex justify-between relative">
            {segments.map((seg, idx) => {
              const typeInfo = typeLabels[seg.type] || typeLabels.hook;
              return (
                <button key={idx} onClick={() => setSelectedScene(idx)} className={`flex flex-col items-center gap-1.5 transition-all ${selectedScene === idx ? "scale-110" : "opacity-50 hover:opacity-100"}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black border-2 z-10"
                    style={{ backgroundColor: selectedScene === idx ? typeInfo.bg : "#0a0a0a", borderColor: typeInfo.color, color: typeInfo.color }}>{seg.timestamp}</div>
                  <span className="text-[9px] font-medium" style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
