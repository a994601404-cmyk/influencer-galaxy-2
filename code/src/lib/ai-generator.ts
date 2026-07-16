import { getNextScriptId, saveScript, type ScriptSegment, type Script } from "./data-store";

export type PersonaStyle = "koc_share" | "expert_review" | "lifestyle_vlog" | "comedy" | "educational";

// ─── Smart Script Generation ──────────────────────────────────
// Deep personalization based on product name, selling points, style, duration

export interface GenerateOptions {
  productName: string;
  productCategory: string;
  sellingPoints: string;
  personaStyle: PersonaStyle;
  duration: number;
  influencerName: string;
  niche: string;
}

export function generateSmartScript(opts: GenerateOptions): Script {
  const points = opts.sellingPoints.split(/[,，;；]/).map((p) => p.trim()).filter(Boolean);
  const mainPoint = points[0] || opts.productName;
  const secondPoint = points[1] || "";
  const thirdPoint = points[2] || "";

  const segments = buildSegments(opts, mainPoint, secondPoint, thirdPoint);

  const script: Script = {
    id: getNextScriptId(),
    influencerId: 0, // set by caller
    productName: opts.productName,
    productCategory: opts.productCategory,
    sellingPoints: opts.sellingPoints,
    personaStyle: opts.personaStyle,
    duration: opts.duration,
    segments,
    createdAt: new Date().toISOString(),
  };

  saveScript(script);
  return script;
}

function buildSegments(
  opts: GenerateOptions,
  p1: string,
  p2: string,
  p3: string
): ScriptSegment[] {
  const { productName, personaStyle, duration, influencerName, niche, productCategory } = opts;
  const segs: ScriptSegment[] = [];
  const cat = getCategoryName(productCategory);

  // Hook - always present
  segs.push({
    timestamp: "00:00",
    text: buildHook(productName, p1, personaStyle, niche, cat),
    visual: buildHookVisual(productName, influencerName, niche, cat),
    audio: buildHookAudio(personaStyle),
    type: "hook",
  });

  // Problem - 15s+
  if (duration >= 15) {
    segs.push({
      timestamp: formatTime(Math.floor(duration * 0.2)),
      text: buildProblem(productName, personaStyle, niche, cat),
      visual: buildProblemVisual(influencerName, niche, cat),
      audio: buildProblemAudio(personaStyle),
      type: "problem",
    });
  }

  // Solution - always present
  const solTime = duration >= 15 ? Math.floor(duration * 0.4) : Math.floor(duration * 0.35);
  segs.push({
    timestamp: formatTime(solTime),
    text: buildSolution(productName, p1, p2, personaStyle, niche, cat),
    visual: buildSolutionVisual(productName, influencerName, niche, cat),
    audio: buildSolutionAudio(personaStyle),
    type: "solution",
  });

  // Education - 30s+
  if (duration >= 30) {
    segs.push({
      timestamp: formatTime(Math.floor(duration * 0.6)),
      text: buildEducation(productName, p1, p3, personaStyle, niche, cat),
      visual: buildEducationVisual(influencerName, niche, cat),
      audio: buildEducationAudio(personaStyle),
      type: "education",
    });
  }

  // Extra detail - 45s+
  if (duration >= 45 && p2) {
    segs.push({
      timestamp: formatTime(Math.floor(duration * 0.75)),
      text: buildExtra(productName, p2, personaStyle, niche, cat),
      visual: buildExtraVisual(productName, influencerName, niche, cat),
      audio: buildExtraAudio(personaStyle),
      type: "education",
    });
  }

  // CTA - always present at end
  segs.push({
    timestamp: formatTime(Math.floor(duration * 0.9)),
    text: buildCTA(productName, personaStyle, niche, cat),
    visual: buildCTAVisual(productName, influencerName, niche, cat),
    audio: buildCTAAudio(personaStyle),
    type: "cta",
  });

  return segs;
}

// ─── Smart Content Builders ───────────────────────────────────

function buildHook(product: string, point: string, style: PersonaStyle, niche: string, cat: string): string {
  const nicheTopic = getNicheTopic(niche);
  const hooks: Record<PersonaStyle, string[]> = {
    koc_share: [
      `姐妹们！用了这个${product}之后，我的${nicheTopic}直接原地起飞！${point}，真不是吹的！`,
      `实名安利这个${product}！${point}，我已经无限回购三次了！`,
      `停！别划走！${product}真的能救你的${nicheTopic}，${point}！`,
    ],
    expert_review: [
      `作为${getNicheTitle(niche)}，今天深度测评${product}。${point}，我们来拆解它的核心逻辑。`,
      `${product}值得买吗？从成分、效果、性价比三个维度给你答案。先说结论：${point}。`,
      `专业测评${product}：${point}。这期内容有点长，但看完你一定不会后悔。`,
    ],
    lifestyle_vlog: [
      `清晨的第一缕阳光和我的${product}，开启今天的${nicheTopic}时刻。`,
      `今天想和大家分享我生活中的一个小确幸——${product}。${point}，真的很治愈。`,
      `周末慢生活的仪式感，从${product}开始。${point}，这是我的私藏好物。`,
    ],
    comedy: [
      `当我第一次用${product}时，我室友以为我去整容了...`,
      `买${product}之前的我vs买之后的我，差别大到我妈都不敢认！`,
      `笑死，${point}，用了${product}之后连前任都回来问我用了啥！`,
    ],
    educational: [
      `关于${product}，${getNicheTitle(niche)}必须告诉你真相：${point}。`,
      `90%的人不知道${cat}产品的这个秘密——${product}做到了${point}。`,
      `${point}！${product}为什么能成为${cat}品类销量第一？今天从原理说起。`,
    ],
  };
  return pick(hooks[style], product + point);
}

function buildProblem(product: string, style: PersonaStyle, niche: string, cat: string): string {
  const problems: Record<PersonaStyle, string[]> = {
    koc_share: [
      `说实话，在遇见${product}之前，我的${getNicheTopic(niche)}状态真的差到谷底。试了好多${cat}产品都没效果，差点就放弃了。`,
      `之前踩雷太多了，换了十几款${cat}产品，钱包瘪了但${getNicheTopic(niche)}一点没变。`,
    ],
    expert_review: [
      `市面上同类${cat}产品鱼龙混杂，很多打着高科技旗号实际成分表不堪一击。消费者最容易被这三个误区误导。`,
      `我做过调研，70%的用户在选择${cat}产品时只看包装和宣传，忽略了核心成分和实际测试数据。`,
    ],
    lifestyle_vlog: [
      `那段时间工作压力大，${getNicheTopic(niche)}状态特别差，整个人都没自信。试了很多方法都没用。`,
      `最烦的是换季的时候，${getNicheTopic(niche)}各种问题一起找上门，烦都烦死了。`,
    ],
    comedy: [
      `用错产品的那段时间，我室友说我${getNicheTopic(niche)}状态看起来像三天没睡觉...`,
      `我之前不懂瞎买，${cat}产品买了一堆，结果${getNicheTopic(niche)}更差了，脸和钱包一起哭。`,
    ],
    educational: [
      `很多人觉得${cat}产品没效果，其实问题出在认知上。皮肤代谢周期是28天，但很多人用了三天就放弃了。`,
      `研究表明，80%的人使用${cat}产品时方法不对，导致效果至少打了五折。`,
    ],
  };
  return pick(problems[style], product);
}

function buildSolution(product: string, p1: string, p2: string, style: PersonaStyle, niche: string, cat: string): string {
  const extra = p2 ? `，而且${p2}` : "";
  const solutions: Record<PersonaStyle, string[]> = {
    koc_share: [
      `${product}的出现完全改变了我的${getNicheTopic(niche)}！${p1}${extra}，用了一周身边朋友都在问我用了什么！`,
      `然后${product}拯救了我！${p1}${extra}，真的绝了！现在每天最期待的就是用它的时候。`,
    ],
    expert_review: [
      `${product}的核心竞争力非常清晰：${p1}${extra}。从成分配比到工艺验证，它的表现都远超同价位产品。`,
      `实验室数据显示：${p1}。第三方测试报告的有效率达到94.7%，这在${cat}品类中非常罕见。`,
    ],
    lifestyle_vlog: [
      `现在${product}已经成为我日常的一部分。${p1}${extra}，每天用它的时候感觉整个人都在发光。`,
      `我的${getNicheTopic(niche)}逆袭之路，${product}功不可没。${p1}${extra}，生活变得更精致了。`,
    ],
    comedy: [
      `${product}就像我的${getNicheTopic(niche)}救星！${p1}${extra}，效果好到我男朋友偷偷问我能不能借他用。`,
      `用了${product}之后，我朋友的反应是：你是不是偷偷去做了什么项目？笑死，真的只是用了它！`,
    ],
    educational: [
      `${product}的科学原理很清晰：${p1}${extra}。这个配方经过了12周的临床双盲测试，数据支持很充分。`,
      `为什么${product}有效？关键在它${p1}${extra}。这是经过同行评审的研究验证过的机制。`,
    ],
  };
  return pick(solutions[style], product + p1);
}

function buildEducation(product: string, _p1: string, p3: string, style: PersonaStyle, niche: string, _cat: string): string {
  const tip = p3 || "坚持使用效果最佳";
  const edu: Record<PersonaStyle, string[]> = {
    koc_share: [
      `分享一个小技巧：${tip}。早晚各用一次，坚持7天你会看到明显的变化！`,
      `提醒大家：${tip}。我用下来觉得搭配按摩手法效果更好，现在手法都练出来了哈哈。`,
    ],
    expert_review: [
      `正确的使用方法是：${tip}。建议连续使用28天作为一个完整周期，不要中途停用。`,
      `从专业角度建议：${tip}。避免与含高浓度酸类产品叠加使用，以防刺激。`,
    ],
    lifestyle_vlog: [
      `我的使用routine很简单：${tip}。把它融入日常生活，一点都不会觉得麻烦。`,
      `小贴士：${tip}。这是我用了三个月总结出来的最佳方式。`,
    ],
    comedy: [
      `使用方法超级简单：${tip}。连我这种手残党都能轻松搞定！`,
      `记住三个字：用、对、法！也就是${tip}。`,
    ],
    educational: [
      `科学使用方法：${tip}。研究表明正确使用能让效果提升3倍以上。`,
      `${tip}。最佳使用时机是${getNicheTopic(niche)}状态最"渴"的时候，吸收率最高。`,
    ],
  };
  return pick(edu[style], product);
}

function buildExtra(product: string, p2: string, style: PersonaStyle, niche: string, _cat: string): string {
  const extras: Record<PersonaStyle, string[]> = {
    koc_share: [
      `还有一点超重要：${p2}！这对我来说是加分项，用起来特别安心。`,
      `而且啊，${p2}，这点我真的要吹爆！`,
    ],
    expert_review: [
      `补充一个关键点：${p2}。这一点在同价位竞品中几乎找不到。`,
      `值得一提的还有：${p2}。从配方设计的角度来看，这是非常加分的设计。`,
    ],
    lifestyle_vlog: [
      `另外让我特别心动的是：${p2}。这种细节真的很能体现品质。`,
      `我最喜欢的一点是${p2}，完全符合我的${getNicheTopic(niche)}理念。`,
    ],
    comedy: [
      `最搞笑的是${p2}，连我妈这种挑剔的人都说好！`,
      `而且${p2}，我再也不用找代购了，开心到飞起！`,
    ],
    educational: [
      `另外${p2}也是一个加分项，这说明品牌在研发上下了真功夫。`,
      `从技术角度看，${p2}体现了配方师的用心，这是很多品牌忽略的细节。`,
    ],
  };
  return pick(extras[style], product + p2);
}

function buildCTA(product: string, style: PersonaStyle, niche: string, _cat: string): string {
  const ctas: Record<PersonaStyle, string[]> = {
    koc_share: [
      `链接在左下角！现在下单还有限时优惠～评论区扣"想要"我私信发你隐藏优惠券！`,
      `${product}真的值得冲！链接给你们放好了，赶紧入手吧！不好用你来找我！`,
    ],
    expert_review: [
      `以上就是本期完整测评。综合评分8.5/10，性价比推荐。购买链接在评论区置顶。`,
      `如果你想了解更详细的测试数据，欢迎评论区交流。觉得有用记得点赞收藏。`,
    ],
    lifestyle_vlog: [
      `这就是我今天的分享，喜欢的话记得点赞关注。链接在简介里，祝你们今天也是美好的一天～`,
      `感谢观看，${product}的链接放好了，记得点赞收藏下次找起来方便。拜拜！`,
    ],
    comedy: [
      `别光笑啊！链接给你们了，快去让自己${getNicheTopic(niche)}状态起飞！`,
      `好了不闹了，${product}是真的好用！评论区链接已置顶，冲就完了！`,
    ],
    educational: [
      `希望这期内容对你有帮助。还想了解什么${getNicheTitle(niche)}知识？评论区告诉我。`,
      `觉得有用的话收藏起来，下次选${getNicheTopic(niche)}产品的时候对照着看。`,
    ],
  };
  return pick(ctas[style], product);
}

// ─── Visual Descriptions ──────────────────────────────────────

function buildHookVisual(product: string, name: string, niche: string, _cat: string): string {
  const visuals: Record<string, string> = {
    beauty: `${name}面对镜头微笑，手持${product}瓶身在自然光下展示，背景是整洁的白色梳妆台，画面明亮清新。`,
    fashion: `${name}在时尚穿搭场景中自然展示${product}，街景背景，阳光照射，画面充满都市时尚感。`,
    tech: `${name}手持${product}在简洁的桌面场景中，产品特写清晰，背景有科技感的蓝色氛围灯。`,
    food: `${name}在温馨的厨房环境中展示${product}，食材新鲜，暖色调灯光，画面充满食欲感。`,
    fitness: `${name}在健身房/运动场景中活力展示${product}，汗水和笑容并存，画面充满能量感。`,
  };
  return visuals[niche] || `${name}面对镜头自然地展示${product}，明亮干净的背景，表情真诚有感染力。`;
}

function buildProblemVisual(name: string, niche: string, cat: string): string {
  const visuals: Record<string, string> = {
    beauty: `分屏对比画面。左侧：${name}素颜状态下轻抚脸颊略显疲惫；右侧：期待的表情感，背景色调从冷变暖。`,
    fashion: `${name}翻衣柜的苦恼表情，衣架上堆满衣服却觉得"没衣服穿"的无奈，生活化场景。`,
    tech: `${name}对着一堆充电线和旧设备发愁的夸张表情，桌面杂乱，暗示旧设备的不便。`,
    food: `${name}看着外卖APP纠结的表情，厨房角落积灰的厨具，暗示"想做饭但太麻烦"。`,
    fitness: `${name}做了几个动作就气喘吁吁的搞笑画面，或者对着镜子捏肚子的自嘲表情。`,
  };
  return visuals[niche] || `${name}展示${cat}使用前的困扰场景，表情真实有共鸣，背景生活化。`;
}

function buildSolutionVisual(product: string, name: string, niche: string, _cat: string): string {
  const visuals: Record<string, string> = {
    beauty: `${name}开心展示${product}瓶身特写，产品质地在手背上清晰可见，背景明亮整洁，表情自信满足。`,
    fashion: `${name}换上搭配${product}的造型，在镜子前自信转身，展现整体穿搭效果。`,
    tech: `${name}手持${product}展示核心功能，屏幕亮起特写，操作流畅自然，表情惊喜。`,
    food: `${name}用${product}做出精美成品，俯拍美食特写，蒸汽袅袅，表情满足自豪。`,
    fitness: `${name}运动中使用${product}，动作标准有力，阳光照射下的汗水闪闪发光，充满正能量。`,
  };
  return visuals[niche] || `${name}展示${product}的使用效果，特写镜头突出产品特点，表情愉悦自信。`;
}

function buildEducationVisual(name: string, niche: string, _cat: string): string {
  const visuals: Record<string, string> = {
    beauty: `俯拍角度：${name}在梳妆台前演示使用步骤，手法轻柔专业，产品摆放整齐，光线柔和治愈。`,
    fashion: `${name}在镜子前展示搭配技巧，动作优雅，细节特写展示配饰和面料质感。`,
    tech: `特写镜头：${name}手指在${niche}产品屏幕上流畅操作，展示核心功能，界面清晰可见。`,
    food: `${name}在厨房中分步骤演示烹饪过程，手法熟练，食材新鲜，每一步都清晰展示。`,
    fitness: `${name}在瑜伽垫上展示标准动作，侧面和正面双角度，动作流畅优美，呼吸节奏可视化。`,
  };
  return visuals[niche] || `${name}演示${niche}相关技巧，动作标准专业，镜头清晰展示关键细节。`;
}

function buildExtraVisual(product: string, name: string, niche: string, _cat: string): string {
  return `${name}在日常生活中自然使用${product}的场景，${getNicheTopic(niche)}状态明显提升，画面温暖治愈。`;
}

function buildCTAVisual(product: string, name: string, _niche: string, _cat: string): string {
  return `${name}指向屏幕下方链接位置，双手比心或点赞手势，${product}礼盒包装展示，画面出现"点击链接"或"限时优惠"文字提示。`;
}

// ─── Audio Descriptions ───────────────────────────────────────

function buildHookAudio(style: PersonaStyle): string {
  const audios: Record<PersonaStyle, string> = {
    koc_share: "轻快抓耳的BGM开场，3秒内音量渐强，营造惊喜氛围",
    expert_review: "沉稳专业的背景音乐，节奏舒缓，建立权威感",
    lifestyle_vlog: "温柔治愈的日常BGM，音量适中，营造生活氛围感",
    comedy: "搞笑反转音效开头，BGM节奏明快，配合悬念感",
    educational: "轻音乐打底，清晰利落的开头，营造知识分享氛围",
  };
  return audios[style];
}

function buildProblemAudio(style: PersonaStyle): string {
  const audios: Record<PersonaStyle, string> = {
    koc_share: "BGM减弱，突出人声情感，带一丝共鸣感的叙述",
    expert_review: "音乐淡出，纯人声叙述，语气严肃专业",
    lifestyle_vlog: "BGM转为柔和，叙述节奏放慢，带一丝感慨",
    comedy: "BGM暂停+经典搞笑音效，人声夸张有趣",
    educational: "音乐渐弱，人声清晰有力，数据陈述语气",
  };
  return audios[style];
}

function buildSolutionAudio(style: PersonaStyle): string {
  const audios: Record<PersonaStyle, string> = {
    koc_share: "BGM恢复节奏，语调转为兴奋自信，情绪上扬",
    expert_review: "轻音乐回归，语调平稳自信，关键数据加重音",
    lifestyle_vlog: "温暖BGM回升，叙述语气轻松愉悦",
    comedy: "BGM欢快回归，配合'哇'的惊喜音效",
    educational: "节奏感BGM，语调积极，关键信息强调",
  };
  return audios[style];
}

function buildEducationAudio(style: PersonaStyle): string {
  const audios: Record<PersonaStyle, string> = {
    koc_share: "柔和治愈系BGM，分享语气亲切自然",
    expert_review: "轻音乐背景，教学语气耐心细致",
    lifestyle_vlog: "日常氛围音乐，叙述轻松随意",
    comedy: "搞笑教学BGM，轻松幽默语气",
    educational: "知识分享配乐，清晰有条理的讲述",
  };
  return audios[style];
}

function buildExtraAudio(style: PersonaStyle): string {
  return buildEducationAudio(style);
}

function buildCTAAudio(style: PersonaStyle): string {
  const audios: Record<PersonaStyle, string> = {
    koc_share: "CTA音效强调，BGM渐强收尾，制造紧迫感",
    expert_review: "音乐平稳收尾，最后一句加重音，专业结束感",
    lifestyle_vlog: "温馨BGM渐弱，温柔告别语气",
    comedy: "搞笑音效收尾，BGM高潮结束",
    educational: "BGM渐弱，最后一句金句总结",
  };
  return audios[style];
}

// ─── Utilities ────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pick(arr: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return arr[Math.abs(hash) % arr.length];
}

function getNicheTopic(niche: string): string {
  const map: Record<string, string> = {
    beauty: "皮肤", fitness: "身材", fashion: "穿搭",
    tech: "体验", food: "口味", travel: "旅途", lifestyle: "状态",
  };
  return map[niche] || "状态";
}

function getNicheTitle(niche: string): string {
  const map: Record<string, string> = {
    beauty: "护肤专家", fitness: "健身教练", fashion: "时尚博主",
    tech: "数码达人", food: "美食家", travel: "旅行达人", lifestyle: "生活家",
  };
  return map[niche] || "达人";
}

function getCategoryName(cat: string): string {
  const map: Record<string, string> = {
    beauty: "美妆护肤", tech: "数码科技", fashion: "时尚穿搭",
    food: "美食饮品", fitness: "健身运动", lifestyle: "生活方式",
  };
  return map[cat] || cat;
}
