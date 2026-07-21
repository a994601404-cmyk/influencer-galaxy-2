import { useState, useEffect } from "react";
import { Link } from "react-router";
import { generateSmartScript } from "@/lib/ai-generator";
import { getInfluencers, getScripts, deleteScript, type Influencer, type Script } from "@/lib/data-store";
import {
  Sparkles,
  UserCircle,
  Package,
  Lightbulb,
  Clock,
  Wand2,
  CheckCircle,
  Loader2,
  Film,
  Volume2,
  Trash2,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const personaStyles = [
  { value: "koc_share", label: "KOC 真实分享", desc: "亲切、日常、真实体验感" },
  { value: "expert_review", label: "专业测评", desc: "严谨、数据驱动、权威感" },
  { value: "lifestyle_vlog", label: "生活Vlog", desc: "轻松、自然、生活方式融入" },
  { value: "comedy", label: "搞笑剧情", desc: "幽默、反转、娱乐性强" },
  { value: "educational", label: "知识科普", desc: "干货、教学、价值输出" },
];

const durations = [15, 30, 45, 60];

const typeLabels: Record<string, { label: string; color: string; bg: string }> = {
  hook: { label: "开场", color: "#ccff00", bg: "rgba(204,255,0,0.12)" },
  problem: { label: "痛点", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  solution: { label: "方案", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  education: { label: "教学", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  cta: { label: "CTA", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export default function ScriptGenerator() {
  const [selectedInfluencer, setSelectedInfluencer] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("beauty");
  const [sellingPoints, setSellingPoints] = useState("");
  const [personaStyle, setPersonaStyle] = useState("koc_share");
  const [duration, setDuration] = useState(30);
  const [generatedScript, setGeneratedScript] = useState<Script | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { setInfluencers(getInfluencers()); refreshScripts(); }, []);

  function refreshScripts() {
    setSavedScripts(getScripts().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  const handleGenerate = () => {
    if (!selectedInfluencer || !productName || !sellingPoints) { setError("请填写所有必填字段"); return; }
    setError(""); setGeneratedScript(null); setIsGenerating(true);
    setTimeout(() => {
      const inf = influencers.find((i) => i.id === selectedInfluencer);
      if (!inf) { setError("请选择有效的网红"); setIsGenerating(false); return; }
      const script = generateSmartScript({ productName, productCategory, sellingPoints, personaStyle: personaStyle as any, duration, influencerName: inf.name, niche: inf.niche });
      script.influencerId = inf.id;
      setGeneratedScript(script); refreshScripts(); setIsGenerating(false);
    }, 1800);
  };

  const handleDelete = (id: number) => { deleteScript(id); refreshScripts(); if (generatedScript?.id === id) setGeneratedScript(null); };

  const selectedInf = influencers.find((i) => i.id === selectedInfluencer);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-brand" />
        <h1 className="section-title">AI 脚本生成</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Influencer */}
          <div className="card-surface p-4">
            <div className="flex items-center gap-2 mb-3"><UserCircle className="w-4 h-4 text-brand" /><h3 className="text-sm font-bold text-content">选择网红 *</h3></div>
            <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
              {influencers.map((inf) => (
                <button key={inf.id} onClick={() => setSelectedInfluencer(inf.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-all text-left ${selectedInfluencer === inf.id ? "bg-lime/10 border border-brand/30" : "bg-hover border border-transparent hover:bg-hover"}`}>
                  <img src={inf.avatar} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                  <div className="min-w-0"><p className="text-[11px] text-content truncate font-medium">{inf.name}</p><p className="text-[9px] text-faint">{inf.niche}</p></div>
                </button>
              ))}
            </div>
            {selectedInf && (
              <div className="mt-2 p-2.5 rounded-xl bg-lime/5 border border-brand/15 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-brand" />
                <span className="text-xs text-content font-medium">{selectedInf.name}</span>
                <span className="text-[10px] text-faint">@{selectedInf.platform} · {selectedInf.niche}</span>
              </div>
            )}
          </div>

          {/* Product */}
          <div className="card-surface p-4">
            <div className="flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-cy" /><h3 className="text-sm font-bold text-content">产品信息</h3></div>
            <div className="space-y-2.5">
              <div><label className="text-[11px] text-faint mb-1 block">产品名称 *</label><input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="例如：极光美白精华"
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30" /></div>
              <div><label className="text-[11px] text-faint mb-1 block">产品类别</label><select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:border-brand/30">
                <option value="beauty">美妆护肤</option><option value="tech">数码科技</option><option value="fashion">时尚穿搭</option><option value="food">美食饮品</option><option value="fitness">健身运动</option><option value="lifestyle">生活方式</option>
              </select></div>
              <div><label className="text-[11px] text-faint mb-1 block">核心卖点 *（逗号分隔）</label><textarea value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} placeholder="7天见效，烟酰胺+维C双效，轻薄不闷痘" rows={3}
                className="w-full bg-base border border-line rounded-xl px-3 py-2 text-sm text-content placeholder:text-faint focus:outline-none focus:border-brand/30 resize-none" /></div>
            </div>
          </div>

          {/* Style */}
          <div className="card-surface p-4">
            <div className="flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-[#f59e0b]" /><h3 className="text-sm font-bold text-content">脚本风格 & 时长</h3></div>
            <div className="space-y-1.5">
              {personaStyles.map((style) => (
                <button key={style.value} onClick={() => setPersonaStyle(style.value)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left ${personaStyle === style.value ? "bg-lime/8 border border-brand/25" : "bg-hover border border-transparent hover:bg-hover"}`}>
                  <div><p className="text-xs text-content font-medium">{style.label}</p><p className="text-[9px] text-faint">{style.desc}</p></div>
                  {personaStyle === style.value && <CheckCircle className="w-3.5 h-3.5 text-brand" />}
                </button>
              ))}
            </div>
            <div className="mt-3"><label className="text-[11px] text-faint mb-1.5 block flex items-center gap-1"><Clock className="w-3 h-3" />视频时长</label>
              <div className="flex gap-1.5">
                {durations.map((d) => (
                  <button key={d} onClick={() => setDuration(d)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${duration === d ? "bg-lime text-black" : "bg-hover text-faint hover:text-content"}`}>{d}秒</button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded-xl">{error}</p>}
          <button onClick={handleGenerate} disabled={isGenerating} className="w-full btn-lime flex items-center justify-center gap-2 py-3.5 disabled:opacity-50">
            {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />AI 生成中...</> : <><Wand2 className="w-4 h-4" />生成脚本</>}
          </button>

          {savedScripts.length > 0 && (
            <div className="card-surface p-3">
              <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between w-full text-left">
                <div className="flex items-center gap-2"><History className="w-3.5 h-3.5 text-faint" /><span className="text-xs font-medium text-content">历史脚本 ({savedScripts.length})</span></div>
                {showHistory ? <ChevronUp className="w-3.5 h-3.5 text-faint" /> : <ChevronDown className="w-3.5 h-3.5 text-faint" />}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-thin">
                  {savedScripts.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-hover">
                      <button onClick={() => setGeneratedScript(s)} className="flex-1 text-left min-w-0">
                        <p className="text-[11px] text-content truncate">{s.productName}</p>
                        <p className="text-[9px] text-faint">{s.personaStyle} · {s.duration}秒</p>
                      </button>
                      <Link to={`/storyboard?script=${s.id}`}><Button variant="ghost" size="sm" className="text-brand hover:text-brand h-6 px-1.5"><Sparkles className="w-3 h-3" /></Button></Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 h-6 px-1.5"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:col-span-3">
          {isGenerating ? (
            <div className="card-surface p-8 space-y-3">
              <div className="shimmer h-3 w-1/3 rounded-lg" />
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" style={{ animationDelay: `${i * 200}ms` }} />)}
            </div>
          ) : generatedScript ? (
            <div className="space-y-3 fade-in-up">
              <div className="card-surface p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-content tracking-tight">{generatedScript.productName}</h3>
                  <p className="text-xs text-faint">{selectedInf?.name || ""} · {generatedScript.duration}秒 · {personaStyles.find((s) => s.value === generatedScript.personaStyle)?.label}</p>
                </div>
                <Link to={`/storyboard?script=${generatedScript.id}`}><button className="btn-lime text-xs flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />查看分镜</button></Link>
              </div>
              <div className="space-y-2">
                {generatedScript.segments?.map((segment, idx) => {
                  const tl = typeLabels[segment.type] || typeLabels.hook;
                  return (
                    <div key={idx} className="card-surface p-4 hover-lift">
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0" style={{ backgroundColor: tl.bg, color: tl.color }}>
                            {segment.timestamp}
                          </div>
                          {idx < (generatedScript.segments?.length || 0) - 1 && <div className="w-0.5 flex-1 bg-hover my-1" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ backgroundColor: tl.bg, color: tl.color }}>{tl.label}</span>
                          </div>
                          <p className="text-sm text-content leading-relaxed mb-2.5">{segment.text}</p>
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <div className="p-2 rounded-lg bg-hover"><p className="text-faint mb-0.5 flex items-center gap-1 text-[10px] font-medium"><Film className="w-3 h-3" />画面</p><p className="text-sub text-[10px] leading-relaxed">{segment.visual}</p></div>
                            <div className="p-2 rounded-lg bg-hover"><p className="text-faint mb-0.5 flex items-center gap-1 text-[10px] font-medium"><Volume2 className="w-3 h-3" />声音</p><p className="text-sub text-[10px] leading-relaxed">{segment.audio}</p></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card-surface p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-14 h-14 rounded-2xl bg-lime/10 flex items-center justify-center mb-4"><Wand2 className="w-7 h-7 text-brand" /></div>
              <h3 className="text-base font-bold text-content mb-1">开始生成您的脚本</h3>
              <p className="text-xs text-faint max-w-xs mb-4">选择网红、填写产品信息，AI 将深度个性化生成带时间戳的专业脚本</p>
              <div className="text-[10px] text-faint space-y-1">
                <p>· 支持 15/30/45/60 秒多种时长</p>
                <p>· 5 种网红人设风格</p>
                <p>· 自动生成时间戳 + 画面指导 + 声音设计</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
