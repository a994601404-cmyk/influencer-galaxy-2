import { getDb } from "./queries/connection.js";
import { influencers, trendingTopics, scripts, storyboards } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

interface ScriptSegment {
  timestamp: string;
  text: string;
  visual: string;
  audio: string;
  type: "hook" | "problem" | "solution" | "education" | "cta";
}

interface GeneratedScript {
  segments: ScriptSegment[];
}

export async function generateScript(
  scriptId: number,
  productName: string,
  sellingPoints: string,
  personaStyle: string,
  duration: number,
  influencerId: number
): Promise<GeneratedScript> {
  const db = getDb();

  const [inf] = await db
    .select()
    .from(influencers)
    .where(eq(influencers.id, influencerId))
    .limit(1);

  const trends = await db
    .select()
    .from(trendingTopics)
    .orderBy(desc(trendingTopics.heat))
    .limit(5);

  const niche = inf?.niche || "general";
  const infName = inf?.name || "网红";

  let audienceAge = "18-34";
  try {
    if (inf?.audienceAge) {
      const age = JSON.parse(inf.audienceAge);
      if (age.length > 0) audienceAge = age[0].range;
    }
  } catch { /* skip */ }

  void trends; void audienceAge;

  const pointList = sellingPoints.split(/[,，;；]/).map((p: string) => p.trim()).filter(Boolean);
  const mainPoint = pointList[0] || productName;
  const secondPoint = pointList[1] || "";
  const thirdPoint = pointList[2] || "";

  const segments = generateSegments(
    productName,
    mainPoint,
    secondPoint,
    thirdPoint,
    personaStyle,
    duration,
    infName,
    niche
  );

  const scriptContent = JSON.stringify({ segments });
  await db
    .update(scripts)
    .set({ scriptContent, status: "completed" })
    .where(eq(scripts.id, scriptId));

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    await db.insert(storyboards).values({
      scriptId,
      sceneIndex: i,
      timestamp: seg.timestamp,
      visualDescription: seg.visual,
      audioDescription: seg.audio,
      narration: seg.text,
      status: "completed",
    });
  }

  return { segments };
}

function generateSegments(
  product: string,
  mainPoint: string,
  secondPoint: string,
  thirdPoint: string,
  style: string,
  duration: number,
  infName: string,
  niche: string
): ScriptSegment[] {
  const segments: ScriptSegment[] = [];

  segments.push({
    timestamp: "00:00",
    text: generateHook(product, mainPoint, style, infName, niche),
    visual: `${infName}手持${product}特写，明亮自然光，惊喜表情，${niche}风格背景`,
    audio: "轻快抓耳的BGM开场，音量渐强",
    type: "hook",
  });

  if (duration >= 15) {
    segments.push({
      timestamp: formatTime(3),
      text: generateProblem(product, style),
      visual: `分屏对比：左侧使用前的状态，右侧${infName}表情从担忧转为期待`,
      audio: "BGM减弱，突出人声情感",
      type: "problem",
    });
  }

  const solutionIdx = duration >= 15 ? 2 : 1;
  segments.push({
    timestamp: formatTime(solutionIdx * 3),
    text: generateSolution(product, mainPoint, secondPoint, style),
    visual: `${infName}展示${product}瓶身，开心自信表情，明亮整洁背景，产品特写`,
    audio: "BGM恢复节奏，语调自信",
    type: "solution",
  });

  if (duration >= 30) {
    segments.push({
      timestamp: formatTime((solutionIdx + 1) * 3),
      text: generateEducation(product, mainPoint, thirdPoint, style),
      visual: `俯视角度：${infName}演示使用步骤，手法轻柔专业，桌面整齐`,
      audio: "柔和背景音，强调专业感",
      type: "education",
    });
  }

  const ctaIdx = segments.length;
  segments.push({
    timestamp: formatTime(ctaIdx * 3),
    text: generateCTA(product, style),
    visual: `${infName}比心手势，${product}礼盒包装展示，"点击链接"文字提示`,
    audio: "CTA音效强调，音乐渐强收尾",
    type: "cta",
  });

  return segments;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function generateHook(product: string, point: string, style: string, _name: string, niche: string): string {
  const hooks: Record<string, string[]> = {
    koc_share: [
      `姐妹们！我发现了一个${product}的隐藏用法，用完直接惊呆！`,
      `停！别划走！这个${product}真的值得你们3秒钟听我说完！`,
      `用了${product}一周，我的${getNicheTopic(niche)}状态完全不一样了！`,
    ],
    expert_review: [
      `作为${getNicheTitle(niche)}，我今天要深度拆解这款${product}的真实表现。`,
      `很多人问我${product}到底值不值得买？今天用数据说话。`,
      `专业测评：${product}，成分、效果、性价比全维度分析。`,
    ],
    lifestyle_vlog: [
      `早起的第一件事，就是拿出我的${product}，开启精致的一天。`,
      `周末宅家Vlog，今天给大家安利我的${niche}私藏好物${product}。`,
      `日常碎片：${product}已经成为我生活中不可缺少的一部分了。`,
    ],
    comedy: [
      `当我第一次用${product}时的反应...（你们懂的）`,
      `我男朋友偷用了我的${product}，然后发生了不可思议的事！`,
      `买${product}前vs买后的我，这变化连我妈都惊了！`,
    ],
    educational: [
      `关于${product}，90%的人都不知道的${point}真相。`,
      `${getNicheTitle(niche)}科普：为什么${product}能成为${niche}圈的爆款？`,
      `今天教你3个${product}的高效使用方法，新手也能秒上手。`,
    ],
  };

  const list = hooks[style] || hooks.koc_share;
  return list[Math.floor(Math.random() * list.length)];
}

function generateProblem(_product: string, style: string) {
  const problems: Record<string, string[]> = {
    koc_share: [
      `之前用了好多产品都没效果，真的很沮丧...`,
      `说实话，买之前我也半信半疑，毕竟踩雷太多次了。`,
      `你们有没有这种烦恼？换了无数产品，就是找不到那个对的。`,
    ],
    expert_review: [
      `市面上同类产品鱼龙混杂，很多成分表看着华丽但实际效果有限。`,
      `消费者最常见的误区就是只看宣传，不看成分和实际测试数据。`,
      `我测试了15款同类产品，大多数在第三周就开始效果衰减。`,
    ],
    lifestyle_vlog: [
      `那段时间状态特别差，每天忙到连保养的时间都没有。`,
      `换季的时候各种问题都来了，真的是焦头烂额。`,
      `旅行出差的时候最头疼的就是怎么保持好状态。`,
    ],
    comedy: [
      `用错产品那段时间，我朋友说我脸看起来像被轰炸过...`,
      `我爸看到我那一堆瓶瓶罐罐，说了一句让我永生难忘的话...`,
      `之前不懂，瞎买一通，结果钱包和脸一起哭了。`,
    ],
    educational: [
      `为什么很多人用了觉得没效果？其实问题出在使用方法上。`,
      `研究表明，70%的用户因为没有正确使用而导致效果打折扣。`,
      `首先要了解你的肤质类型，才能选对产品。`,
    ],
  };

  const list = problems[style] || problems.koc_share;
  return list[Math.floor(Math.random() * list.length)];
}

function generateSolution(product: string, p1: string, p2: string, style: string): string {
  const solutions: Record<string, string[]> = {
    koc_share: [
      `${product}真的不一样！${p1}${p2 ? "，" + p2 : ""}，用了一周就看到变化！`,
      `然后${product}拯救了我！${p1}，质地轻薄好吸收，真的绝了！`,
      `直到用了${product}，${p1}，亲测有效！`,
    ],
    expert_review: [
      `${product}的核心优势在于：${p1}${p2 ? "；" + p2 : ""}。从成分配比到工艺都经过严格验证。`,
      `数据说话：${p1}。第三方实验室测试报告显示有效率达到94.7%。`,
      `${product}采用的是${p1}技术路线，这在同价位产品中非常罕见。`,
    ],
    lifestyle_vlog: [
      `现在每天我都会用${product}，${p1}，已经成为习惯了。`,
      `我的必备好物：${product}，${p1}。`,
      `出差旅行必带的${product}，${p1}${p2 ? "，" + p2 : ""}。`,
    ],
    comedy: [
      `然后${product}出现了，就像我的救星！${p1}，连我妈都问我偷偷用了啥。`,
      `用了${product}之后，我朋友的反应是：你是不是去整容了？`,
      `${product}效果有多明显？我男朋友居然主动问我借来用...`,
    ],
    educational: [
      `${product}的科学原理是：${p1}${p2 ? "。同时" + p2 : ""}。`,
      `正确使用${product}的3个关键点：第一${p1}；第二坚持使用；第三配合适当手法。`,
      `${product}之所以有效，是因为${p1}。这是经过临床验证的。`,
    ],
  };

  const list = solutions[style] || solutions.koc_share;
  return list[Math.floor(Math.random() * list.length)];
}

function generateEducation(product: string, _p1: string, p3: string, style: string): string {
  const edu: Record<string, string[]> = {
    koc_share: [
      `分享一下我的使用心得：早晚各一次，坚持7天效果最明显。`,
      `小tips：搭配按摩手法效果更佳，我现在手法都练出来了哈哈。`,
      `记住要用够量！别省，省了效果打折反而浪费。`,
    ],
    expert_review: [
      `建议每天使用2次，每次取适量均匀涂抹。连续使用28天为一个完整周期。`,
      `成分分析显示${p3 || "核心成分浓度达标"}，建议搭配维C使用效果更好。`,
      `使用注意事项：避免与含酒精产品同时使用，建议晚间使用效果最佳。`,
    ],
    lifestyle_vlog: [
      `我的日常routine：洁面后取适量${product}，轻轻按摩至吸收，简单高效。`,
      `分享一下我今天的使用过程，真的很治愈。`,
      `早上赶时间的话，我会简化步骤但${product}这一步绝对不会省。`,
    ],
    comedy: [
      `使用方法超简单：打开→涂抹→变好看。就这么easy！`,
      `我教我妈用${product}，她说比教我数学题简单多了...`,
      `记住三个字：用、坚、持。对了，是三个字分开的。`,
    ],
    educational: [
      `科学使用方法：清洁后取3-5滴${product}，由内向外轻轻按摩至吸收。`,
      `${p3 || "研究表明"}，正确使用的效果比随意涂抹高出3倍。`,
      `最佳使用时机：洁面后30秒内，肌肤水分最充足时使用效果最佳。`,
    ],
  };

  const list = edu[style] || edu.koc_share;
  return list[Math.floor(Math.random() * list.length)];
}

function generateCTA(_product: string, style: string): string {
  const ctas: Record<string, string[]> = {
    koc_share: [
      `链接在左下角！现在下单还送小样套装~评论区扣"想要"我私信发你优惠码！`,
      `姐妹们真的值得冲！我放了链接在主页，趁有活动赶紧入手！`,
      `不好用你来找我！链接给你们放好了，快去试试吧！`,
    ],
    expert_review: [
      `如果你想了解更详细的测评数据，可以私信我。购买链接我放在评论区置顶了。`,
      `综合评分8.5/10，性价比推荐。感兴趣的朋友可以点击链接了解更多。`,
      `以上就是本期测评，觉得有用的话点赞收藏。产品链接在评论区。`,
    ],
    lifestyle_vlog: [
      `这就是我今天的分享，喜欢的话记得点赞关注，我们下期再见！`,
      `好物链接在简介里，感谢观看，祝你今天也是美好的一天~`,
      `记得点赞收藏这个视频，下次想找的时候方便。拜拜！`,
    ],
    comedy: [
      `别光笑啊，链接给你们了，快去让自己也变美/变帅！`,
      `看完不点赞？那...那我也没办法，但求你试试这个产品！`,
      `好了不闹了，产品真的好用，链接在评论区，冲就完了！`,
    ],
    educational: [
      `如果你想了解更多专业知识，关注我不迷路。产品链接在评论区置顶。`,
      `把这期内容收藏起来，下次选产品的时候对照着看。`,
      `有任何问题欢迎在评论区留言，我会一一回复。`,
    ],
  };

  const list = ctas[style] || ctas.koc_share;
  return list[Math.floor(Math.random() * list.length)];
}

function getNicheTopic(niche: string): string {
  const map: Record<string, string> = {
    beauty: "皮肤", fitness: "身材", fashion: "穿搭",
    tech: "使用体验", food: "口味", travel: "旅途", lifestyle: "生活状态",
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
