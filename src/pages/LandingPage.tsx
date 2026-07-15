import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import { Users, Eye, Heart, Bookmark } from "lucide-react";

/* ─── Mock KOL Data ─────────────────────────────────────────── */
const KOL_CARDS = [
  { name: "Vivian Chen", handle: "@vivianbeauty", platform: "Instagram", followers: "520K", exposures: "1.2M", likes: "85K", bookmarks: "12K", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" },
  { name: "Marcus Zhang", handle: "@marcusfit", platform: "TikTok", followers: "890K", exposures: "3.2M", likes: "210K", bookmarks: "28K", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" },
  { name: "Luna Priscilla", handle: "@luna.style", platform: "Instagram", followers: "310K", exposures: "850K", likes: "62K", bookmarks: "8K", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face" },
  { name: "Jake Morrison", handle: "@jaketech", platform: "TikTok", followers: "1.2M", exposures: "5.5M", likes: "380K", bookmarks: "45K", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face" },
  { name: "Mei Lin", handle: "@meicooks", platform: "小红书", followers: "680K", exposures: "4.2M", likes: "310K", bookmarks: "52K", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" },
  { name: "Leo Wagner", handle: "@leotravels", platform: "Instagram", followers: "450K", exposures: "1.8M", likes: "134K", bookmarks: "18K", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" },
  { name: "Sophie Wang", handle: "@sophielife", platform: "小红书", followers: "920K", exposures: "2.5M", likes: "198K", bookmarks: "35K", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face" },
  { name: "Aria Kim", handle: "@ariamakeup", platform: "TikTok", followers: "750K", exposures: "2.8M", likes: "156K", bookmarks: "22K", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face" },
  { name: "Ryan Chen", handle: "@ryangaming", platform: "YouTube", followers: "2.1M", exposures: "8.5M", likes: "420K", bookmarks: "68K", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face" },
  { name: "Nina Patel", handle: "@ninayoga", platform: "Instagram", followers: "380K", exposures: "1.1M", likes: "95K", bookmarks: "15K", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face" },
];

/* ─── Types ─────────────────────────────────────────────────── */
interface GalaxyParticle { theta: number; r: number; speed: number; size: number; alpha: number; arm: number; pulsePhase: number; pulseSpeed: number; }
interface ActiveCard { id: number; kol: typeof KOL_CARDS[0]; x: number; y: number; px: number; py: number; opacity: number; scale: number; bornAt: number; lifeMs: number; }
interface ActiveLine { px: number; py: number; cx: number; cy: number; opacity: number; }

// Space entities flying toward galaxy center
type SpaceEntityType = "ufo" | "asteroid" | "ship";
interface SpaceEntity {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  type: SpaceEntityType;
  rotation: number;
  rotSpeed: number;
  alpha: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

/* ─── Main Landing Page ─────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  useEffect(() => { if (isAuthenticated) navigate("/", { replace: true }); }, [isAuthenticated, navigate]);

  return (
    <div className="relative min-h-screen bg-[#050505] overflow-hidden select-none">
      <GalaxyScene />

      {/* Content below galaxy */}
      <div className="absolute inset-x-0 z-20 flex flex-col items-center pointer-events-none" style={{ top: "60%" }}>
        <div className="flex flex-col items-center opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white mb-1.5">
            Influencer<span className="text-[#ccff00]">Galaxy</span>
          </h1>
          <p className="text-xs text-[#777] text-center max-w-sm mb-4 px-4 leading-relaxed tracking-wide">
            InfluencerGalaxy为你简化网红营销的复杂流程
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 pointer-events-auto opacity-0 animate-fade-in-up" style={{ animationDelay: "0.8s", animationFillMode: "forwards" }}>
          <button onClick={() => { setAuthMode("register"); setAuthOpen(true); }}
            className="px-6 py-2.5 rounded-full bg-[#ccff00] text-black text-sm font-bold hover:bg-[#d4ff33] transition-all shadow-[0_0_20px_rgba(204,255,0,0.2)] tracking-tight">
            免费开始
          </button>
          <button onClick={() => { setAuthMode("login"); setAuthOpen(true); }}
            className="px-6 py-2.5 rounded-full border border-white/[0.1] text-[#777] text-sm font-medium hover:text-white hover:border-[#ccff00]/30 transition-all tracking-tight">
            登录
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-5 py-3 text-[10px] text-[#444] uppercase tracking-widest">
        <span>Instagram</span><span className="text-[#ccff00]">·</span><span>TikTok</span><span className="text-[#ccff00]">·</span><span>小红书</span><span className="text-[#ccff00]">·</span><span>YouTube</span>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode={authMode}
        onSuccess={() => { setAuthOpen(false); navigate("/"); }}
      />

      <style>{`
        @keyframes fade-in-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
    </div>
  );
}

/* ─── Galaxy + Cards + Space Entities (one Canvas) ──────────── */
function GalaxyScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cards, setCards] = useState<ActiveCard[]>([]);
  const cardsRef = useRef<ActiveCard[]>([]);
  const linesRef = useRef<ActiveLine[]>([]);
  const particlesRef = useRef<GalaxyParticle[]>([]);
  const entitiesRef = useRef<SpaceEntity[]>([]);
  const dimsRef = useRef({ W: 0, H: 0, CX: 0, CY: 0, maxR: 0 });
  const globalRotRef = useRef(0);
  const idRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const visibleRef = useRef(true);

  // Visibility
  useEffect(() => {
    const onVis = () => { visibleRef.current = !document.hidden; if (!document.hidden) lastSpawnRef.current = performance.now(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ─── Main Canvas Loop ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;

    function resize() {
      const W = window.innerWidth, H = window.innerHeight;
      canvas!.width = W; canvas!.height = H;
      dimsRef.current = { W, H, CX: W / 2, CY: H * 0.30, maxR: Math.min(W, H) * 0.52 };
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Particles ──
    const COUNT = 1200;
    const ARM_COUNT = 5;
    const particles: GalaxyParticle[] = [];
    for (let i = 0; i < COUNT; i++) {
      const arm = i % ARM_COUNT;
      const dist = 0.03 + Math.random() * 0.44;
      const armSpread = (Math.random() - 0.5) * 0.14;
      particles.push({
        theta: (arm / ARM_COUNT) * Math.PI * 2 + dist * Math.PI * 4 + armSpread,
        r: dist, speed: 0.00006 + Math.random() * 0.00014,
        size: Math.random() * 2.0 + 0.4, alpha: Math.random() * 0.35 + 0.5,
        arm, pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.004 + Math.random() * 0.007,
      });
    }
    particlesRef.current = particles;

    // ── Space Entities ──
    const entities: SpaceEntity[] = [];
    entitiesRef.current = entities;
    let entitySpawnTimer = 0;
    const ENTITY_SPAWN_INTERVAL = () => 5000 + Math.random() * 5000; // 5-10 seconds
    let nextEntitySpawn = ENTITY_SPAWN_INTERVAL();

    function spawnEntity() {
      const { W, H, CX, CY } = dimsRef.current;
      const side = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (side === 0) { x = Math.random() * W; y = -20; }
      else if (side === 1) { x = W + 20; y = Math.random() * H * 0.6; }
      else if (side === 2) { x = Math.random() * W; y = H * 0.5; }
      else { x = -20; y = Math.random() * H * 0.6; }

      const types: SpaceEntityType[] = ["ufo", "asteroid", "ship"];
      const type = types[Math.floor(Math.random() * types.length)];
      const dx = CX - x + (Math.random() - 0.5) * 100;
      const dy = CY - y + (Math.random() - 0.5) * 60;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = type === "ufo" ? 0.3 + Math.random() * 0.2 : type === "asteroid" ? 0.2 + Math.random() * 0.3 : 0.5 + Math.random() * 0.5;

      entities.push({
        x, y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        size: type === "ufo" ? 5 + Math.random() * 2 : type === "ship" ? 3 + Math.random() * 2 : 2 + Math.random() * 3,
        type,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: type === "ufo" ? 0.08 + Math.random() * 0.06 : (Math.random() - 0.5) * 0.04,
        alpha: 0,
        trail: [],
      });
    }

    let time = 0;

    // ── Draw helpers ──
    function drawUFO(e: SpaceEntity, time: number) {
      ctx!.save();
      ctx!.translate(e.x, e.y);
      // Tumbling: squash-stretch to simulate 3D rotation
      const tumbleX = Math.cos(e.rotation);
      const tumbleY = Math.sin(e.rotation * 0.7);
      ctx!.scale(Math.abs(tumbleX) * 0.4 + 0.6, Math.abs(tumbleY) * 0.4 + 0.6);
      ctx!.rotate(e.rotation * 0.3);

      // Dome
      ctx!.fillStyle = `rgba(204,255,0,${e.alpha * 0.5})`;
      ctx!.beginPath();
      ctx!.arc(0, -e.size * 0.3, e.size * 0.35, Math.PI, 0);
      ctx!.fill();

      // Body
      ctx!.fillStyle = `rgba(160,220,255,${e.alpha * 0.65})`;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, e.size, e.size * 0.32, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Rim
      ctx!.strokeStyle = `rgba(160,220,255,${e.alpha * 0.5})`;
      ctx!.lineWidth = 0.8;
      ctx!.beginPath();
      ctx!.ellipse(0, e.size * 0.05, e.size * 0.9, e.size * 0.2, 0, 0, Math.PI * 2);
      ctx!.stroke();

      // Lights
      ctx!.fillStyle = `rgba(204,255,0,${e.alpha * 0.85})`;
      for (let i = -2; i <= 2; i++) {
        ctx!.beginPath();
        ctx!.arc(i * e.size * 0.32, e.size * 0.08, 0.8, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
    }

    function drawAsteroid(e: SpaceEntity) {
      ctx!.save();
      ctx!.translate(e.x, e.y);
      ctx!.rotate(e.rotation);
      ctx!.fillStyle = `rgba(140,140,140,${e.alpha * 0.7})`;
      ctx!.beginPath();
      const pts = 6;
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const r = e.size * (0.7 + Math.sin(a * 3 + e.rotation) * 0.3);
        if (i === 0) ctx!.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx!.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx!.closePath();
      ctx!.fill();
      ctx!.restore();
    }

    function drawShip(e: SpaceEntity) {
      ctx!.save();
      ctx!.translate(e.x, e.y);
      // Point toward movement direction
      const angle = Math.atan2(e.vy, e.vx);
      ctx!.rotate(angle);
      // Body
      ctx!.fillStyle = `rgba(255,255,255,${e.alpha * 0.8})`;
      ctx!.beginPath();
      ctx!.moveTo(e.size, 0);
      ctx!.lineTo(-e.size * 0.5, -e.size * 0.4);
      ctx!.lineTo(-e.size * 0.3, 0);
      ctx!.lineTo(-e.size * 0.5, e.size * 0.4);
      ctx!.closePath();
      ctx!.fill();
      // Engine glow
      ctx!.fillStyle = `rgba(204,255,0,${e.alpha * 0.6})`;
      ctx!.beginPath();
      ctx!.arc(-e.size * 0.4, 0, e.size * 0.25, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
    }

    function draw() {
      time++;
      globalRotRef.current += 0.0004;
      const { W, H, CX, CY, maxR } = dimsRef.current;
      const gr = globalRotRef.current;

      ctx!.fillStyle = "rgba(5, 5, 5, 0.15)";
      ctx!.fillRect(0, 0, W, H);

      // ── Center glow ──
      const cg = ctx!.createRadialGradient(CX, CY, 0, CX, CY, maxR * 0.05);
      cg.addColorStop(0, "rgba(204,255,0,0.45)");
      cg.addColorStop(0.5, "rgba(204,255,0,0.08)");
      cg.addColorStop(1, "rgba(204,255,0,0)");
      ctx!.fillStyle = cg;
      ctx!.beginPath(); ctx!.arc(CX, CY, maxR * 0.05, 0, Math.PI * 2); ctx!.fill();

      const og = ctx!.createRadialGradient(CX, CY, maxR * 0.12, CX, CY, maxR * 0.35);
      og.addColorStop(0, "rgba(204,255,0,0.025)");
      og.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = og;
      ctx!.beginPath(); ctx!.arc(CX, CY, maxR * 0.35, 0, Math.PI * 2); ctx!.fill();

      // ── Update & draw entities ──
      // Spawn timer (5-10 seconds)
      entitySpawnTimer += 16;
      if (entitySpawnTimer >= nextEntitySpawn && entities.length < 6) {
        entitySpawnTimer = 0;
        nextEntitySpawn = ENTITY_SPAWN_INTERVAL();
        spawnEntity();
      }

      for (let ei = entities.length - 1; ei >= 0; ei--) {
        const e = entities[ei];
        e.x += e.vx;
        e.y += e.vy;
        e.rotation += e.rotSpeed;

        // Fade in
        if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + 0.015);

        // Distance to center
        const dcx = CX - e.x;
        const dcy = CY - e.y;
        const distToCenter = Math.sqrt(dcx * dcx + dcy * dcy);

        // Fade out near center
        if (distToCenter < 50) {
          e.alpha -= 0.04;
          if (e.alpha <= 0) { entities.splice(ei, 1); continue; }
        }

        // Trail
        e.trail.push({ x: e.x, y: e.y, alpha: e.alpha * 0.4 });
        if (e.trail.length > 20) e.trail.shift();

        // Draw trail
        if (e.trail.length > 1) {
          for (let ti = 1; ti < e.trail.length; ti++) {
            const t = e.trail[ti];
            const tPrev = e.trail[ti - 1];
            const ta = (ti / e.trail.length) * t.alpha;
            ctx!.strokeStyle = e.type === "ship" ? `rgba(204,255,0,${ta * 0.5})` : e.type === "ufo" ? `rgba(160,220,255,${ta * 0.3})` : `rgba(200,200,200,${ta * 0.25})`;
            ctx!.lineWidth = e.type === "ship" ? 1.5 : 0.8;
            ctx!.beginPath();
            ctx!.moveTo(tPrev.x, tPrev.y);
            ctx!.lineTo(t.x, t.y);
            ctx!.stroke();
          }
        }

        // Draw entity
        if (e.type === "ufo") drawUFO(e, time);
        else if (e.type === "asteroid") drawAsteroid(e);
        else drawShip(e);
      }

      // ── Particle lines (synced with cards) ──
      for (const line of linesRef.current) {
        const op = line.opacity;
        if (op <= 0.01) continue;
        ctx!.strokeStyle = `rgba(204,255,0,${op * 0.45})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(line.px, line.py);
        ctx!.lineTo(line.cx, line.cy);
        ctx!.stroke();

        const rp = 0.7 + Math.sin(time * 0.06) * 0.3;
        const rR = 7 + rp * 5;
        ctx!.fillStyle = `rgba(204,255,0,${op * 0.06})`;
        ctx!.beginPath(); ctx!.arc(line.px, line.py, rR * 2, 0, Math.PI * 2); ctx!.fill();
        ctx!.fillStyle = `rgba(204,255,0,${op * 0.18})`;
        ctx!.beginPath(); ctx!.arc(line.px, line.py, rR, 0, Math.PI * 2); ctx!.fill();
        ctx!.strokeStyle = `rgba(204,255,0,${op * 0.65})`;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath(); ctx!.arc(line.px, line.py, rR, 0, Math.PI * 2); ctx!.stroke();
        ctx!.fillStyle = `rgba(255,255,255,${op * 0.9})`;
        ctx!.beginPath(); ctx!.arc(line.px, line.py, 3, 0, Math.PI * 2); ctx!.fill();
      }

      // ── Particles ──
      for (const p of particles) {
        p.theta += p.speed;
        p.pulsePhase += p.pulseSpeed;
        const pulseMul = 0.65 + Math.sin(p.pulsePhase) * 0.35;
        const x = CX + Math.cos(p.theta + gr) * p.r * maxR * 2;
        const y = CY + Math.sin(p.theta + gr) * p.r * maxR * 0.5;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        const alpha = p.alpha * (1 - p.r * 0.4) * pulseMul;
        const sz = p.size * (0.7 + pulseMul * 0.5);
        const cR = 204, cG = 255, cB = 100 + p.arm * 25;
        if (sz < 1) {
          ctx!.fillStyle = `rgba(${cR},${cG},${cB},${alpha})`;
          ctx!.fillRect(x - sz * 0.5, y - sz * 0.5, sz, sz);
        } else {
          ctx!.fillStyle = `rgba(${cR},${cG},${cB},${alpha * 0.12})`;
          ctx!.beginPath(); ctx!.arc(x, y, sz * 2.5, 0, Math.PI * 2); ctx!.fill();
          ctx!.fillStyle = `rgba(${cR},${cG},${cB},${alpha})`;
          ctx!.beginPath(); ctx!.arc(x, y, sz, 0, Math.PI * 2); ctx!.fill();
        }
      }

      // ── Core ──
      const cp = 0.8 + Math.sin(time * 0.025) * 0.2;
      ctx!.fillStyle = `rgba(255,255,220,${cp})`;
      ctx!.beginPath(); ctx!.arc(CX, CY, 2.5, 0, Math.PI * 2); ctx!.fill();
      ctx!.strokeStyle = `rgba(204,255,0,${0.12 * cp})`;
      ctx!.lineWidth = 0.5;
      const fl = 14 * cp;
      ctx!.beginPath();
      ctx!.moveTo(CX - fl, CY); ctx!.lineTo(CX + fl, CY);
      ctx!.moveTo(CX, CY - fl); ctx!.lineTo(CX, CY + fl);
      ctx!.stroke();

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  // ─── Card Spawning ──────────────────────────────────────
  const spawnCard = useCallback(() => {
    if (!visibleRef.current) return;
    const { W, H, CX, CY, maxR } = dimsRef.current;
    const gr = globalRotRef.current;
    const kol = KOL_CARDS[Math.floor(Math.random() * KOL_CARDS.length)];
    const cAngle = Math.random() * Math.PI * 2;
    const cDist = Math.min(W, H) * (0.14 + Math.random() * 0.26);
    let cx = CX + Math.cos(cAngle) * cDist;
    let cy = CY + Math.sin(cAngle) * cDist * 0.5;
    cx = Math.max(140, Math.min(W - 220, cx));
    cy = Math.max(50, Math.min(H * 0.58, cy));

    const pAll = particlesRef.current;
    const pIdx = Math.floor(Math.random() * pAll.length);
    const p = pAll[pIdx];
    const px = CX + Math.cos(p.theta + gr) * p.r * maxR * 2;
    const py = CY + Math.sin(p.theta + gr) * p.r * maxR * 0.5;

    linesRef.current.push({ px, py, cx, cy, opacity: 0 });

    const card: ActiveCard = {
      id: idRef.current++, kol,
      x: cx, y: cy, px, py,
      opacity: 0, scale: 0.6,
      bornAt: performance.now(), lifeMs: 5000,
    };
    cardsRef.current = [...cardsRef.current.slice(-5), card];
    setCards([...cardsRef.current]);
  }, []);

  useEffect(() => {
    lastSpawnRef.current = performance.now();
    spawnCard();
    const iv = setInterval(() => {
      if (performance.now() - lastSpawnRef.current >= 3200) {
        lastSpawnRef.current = performance.now();
        spawnCard();
      }
    }, 3200);
    return () => clearInterval(iv);
  }, [spawnCard]);

  // ─── Card Animation ─────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const prevLen = cardsRef.current.length;
      cardsRef.current = cardsRef.current.map((c) => {
        const age = now - c.bornAt;
        if (age >= c.lifeMs) return null as any;
        const pct = age / c.lifeMs;
        let opacity: number, scale: number;
        if (pct < 0.12) { const p = pct / 0.12; opacity = p; scale = 0.5 + p * 0.5; }
        else if (pct > 0.72) { const p = (pct - 0.72) / 0.28; opacity = 1 - p; scale = 1; }
        else { opacity = 1; scale = 1; }
        return { ...c, opacity, scale };
      }).filter(Boolean);

      // Sync lines with cards
      const cardPositions = new Set(cardsRef.current.map((c) => `${Math.round(c.px)},${Math.round(c.py)}`));
      linesRef.current = linesRef.current.filter((l) => {
        const key = `${Math.round(l.px)},${Math.round(l.py)}`;
        const match = cardsRef.current.find((c) => `${Math.round(c.px)},${Math.round(c.py)}` === key);
        if (match) { l.opacity = match.opacity; return match.opacity > 0.01; }
        return false;
      });

      if (cardsRef.current.length !== prevLen || cardsRef.current.some((c) => c.opacity < 1)) {
        setCards([...cardsRef.current]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        {cards.map((c) => (
          <div key={c.id} className="absolute" style={{ left: c.x, top: c.y, transform: `translate(-50%,-50%) scale(${c.scale})`, opacity: c.opacity }}>
            <div className="bg-[#0a0a0a]/70 backdrop-blur-sm border border-[#ccff00]/10 rounded-xl px-3.5 py-3 w-[185px]" style={{ boxShadow: "0 0 20px rgba(204,255,0,0.03), 0 4px 16px rgba(0,0,0,0.5)" }}>
              <div className="flex items-center gap-2.5 mb-2">
                <img src={c.kol.avatar} alt={c.kol.name} className="w-8 h-8 rounded-full object-cover border border-[#ccff00]/15" />
                <div>
                  <p className="text-[11px] font-bold text-white leading-tight">{c.kol.name}</p>
                  <p className="text-[9px] text-[#666]">{c.kol.handle}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <div className="text-center"><Users className="w-3 h-3 mx-auto text-[#ccff00]/60 mb-0.5" /><p className="text-[9px] font-bold text-[#ccff00]">{c.kol.followers}</p></div>
                <div className="text-center"><Eye className="w-3 h-3 mx-auto text-[#06b6d4]/60 mb-0.5" /><p className="text-[9px] font-bold text-white">{c.kol.exposures}</p></div>
                <div className="text-center"><Heart className="w-3 h-3 mx-auto text-[#ef4444]/60 mb-0.5" /><p className="text-[9px] font-bold text-white">{c.kol.likes}</p></div>
                <div className="text-center"><Bookmark className="w-3 h-3 mx-auto text-[#f59e0b]/60 mb-0.5" /><p className="text-[9px] font-bold text-white">{c.kol.bookmarks}</p></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
