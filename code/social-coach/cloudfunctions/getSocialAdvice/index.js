/**
 * getSocialAdvice 原子接口
 *
 * 微信AI调用入口。接收用户场景信息，分阶段返回：
 *   split    → 分流卡片（急需答案 / 提前录入）
 *   ask      → 第一轮自由叙述 + 后续选择题追问（最多4题）[DeepSeek + RAG + 硬编码fallback]
 *   generate → 3-5条策略卡片（流式输出）              [DeepSeek + RAG + 硬编码fallback]
 *
 * 返回格式严格遵循微信AI规范："事实 + 动作"两段式
 * - fact:  AI当上下文地基读取
 * - action: AI照此指示展示卡片
 */

var deepseek = require('./deepseek.js');
var prompts = require('./prompts.js');
var rag = require('./rag.js');

// ========== 工具定义（Function Calling） ==========

var TOOLS = [
  {
    type: 'function',
    function: {
      name: 'searchKnowledge',
      description: '检索人情世故知识库，获取与当前社交场景相关的结构化规则（condition → implication → tactical_note → avoid）。在追问阶段用于判断该问什么，在策略生成阶段用于获取具体策略规则。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '描述当前场景的中文关键词或短句，如"导师催论文 延期"、"暧昧对象已读不回 刚认识"'
          },
          kbType: {
            type: 'string',
            enum: ['ask', 'generate'],
            description: '检索目标知识库。ask库含追问维度规则（该问什么），generate库含策略生成规则（怎么回）。Ask阶段优先调ask库，Generate阶段优先调generate库。'
          }
        },
        required: ['query', 'kbType']
      }
    }
  }
];

// ========== 知识库（已废弃 — RAG 检索替代，保留作为 fallback 的最低兜底） ==========

var FALLBACK_ETIQUETTE = {
  '随份子': '深圳/广州普通同事200-400元，好朋友600-1000元。关键看关系和收入。',
  '敬酒': '互联网/外企：说"感谢帮助"即可。体制内：注意座次。见家长：双手举杯，杯沿低于对方。'
};

// ========== 硬编码：信息缺口分析（LLM失败时fallback） ==========

function analyzeGaps(situation, answers) {
  var collected = {};
  answers.forEach(function (a) { collected[a.question] = true; });

  var gaps = [];

  if (!collected['relation'] &&
    !/领导|导师|老板|同事|朋友|对象|暧昧|相亲|甲方|父母|亲戚|同学|师兄|师姐/.test(situation)) {
    gaps.push({
      key: 'relation',
      text: '你跟对方是什么关系？这个决定了基本语气和分寸。',
      options: [
        { label: 'A', text: '领导/导师/上级 — 需要保持尊重和分寸' },
        { label: 'B', text: '同事/同学/平级 — 平等但注意边界' },
        { label: 'C', text: '朋友/闺蜜/兄弟 — 可以放松但不想伤感情' },
        { label: 'D', text: '若都不符可在对话框中输入你自己的答案' }
      ]
    });
  }

  if (!collected['personality'] &&
    !/他.*很|她.*很|对方.*比较|他是|她是/.test(situation)) {
    gaps.push({
      key: 'personality',
      text: '对方是什么样的人？这决定了用什么方式沟通最有效。',
      options: [
        { label: 'A', text: '严肃直接，公事公办 — 别绕弯子' },
        { label: 'B', text: '表面和气但心里有数 — 话说得好听很重要' },
        { label: 'C', text: '情绪化，容易多想 — 每句话都要掂量' },
        { label: 'D', text: '若都不符可在对话框中输入你自己的答案' }
      ]
    });
  }

  if (!collected['goal'] &&
    !/拒绝|想要|想让|不想|希望|准备|争取|推迟|延期|解释|道歉|挽回|推进/.test(situation)) {
    gaps.push({
      key: 'goal',
      text: '你最想达到什么效果？不同目标，策略完全不一样。',
      options: [
        { label: 'A', text: '委婉拒绝/争取时间 — 不想答应但别得罪人' },
        { label: 'B', text: '解释/表达自己 — 想让对方理解我的处境' },
        { label: 'C', text: '修复/道歉/挽回 — 关系出问题，想补救' },
        { label: 'D', text: '若都不符可在对话框中输入你自己的答案' }
      ]
    });
  }

  if (!collected['history'] && gaps.length < 3 &&
    !/之前|上次|以前|一直|最近|这几天/.test(situation)) {
    gaps.push({
      key: 'history',
      text: '你跟对方之前有过类似情况吗？',
      options: [
        { label: 'A', text: '第一次遇到 — 需要建立边界' },
        { label: 'B', text: '以前发生过，没处理好 — 这次换个方式' },
        { label: 'C', text: '经常发生，已经烦了 — 想彻底解决' },
        { label: 'D', text: '若都不符可在对话框中输入你自己的答案' }
      ]
    });
  }

  if (!collected['constraint'] && gaps.length < 3 &&
    !/绝对|千万|一定不能|底线|不能/.test(situation)) {
    gaps.push({
      key: 'constraint',
      text: '有什么绝对不能做或不能说的？帮你避开雷区。',
      options: [
        { label: 'A', text: '不能撕破脸 — 之后还要来往' },
        { label: 'B', text: '不能显得太软弱 — 要让对方知道态度' },
        { label: 'C', text: '不能撒谎 — 要诚实但不伤感情' },
        { label: 'D', text: '若都不符可在对话框中输入你自己的答案' }
      ]
    });
  }

  return gaps;
}

// ========== 硬编码：策略生成（LLM失败时fallback） ==========

function detectContext(situation, answers) {
  var fullText = situation + ' ' + answers.map(function (a) { return a.answer; }).join(' ');

  if (/导师|论文|毕业|学术|研究生/.test(fullText)) return '导师催论文';
  if (/拒绝|不想|借钱|帮忙|约会/.test(fullText)) return '拒绝请求';
  if (/领导|老板|加薪|考核|汇报|工作/.test(fullText)) return '职场上下级';
  if (/对象|女朋|男朋|暧昧|约会|相亲|恋爱/.test(fullText)) return '亲密关系';
  if (/父母|爸妈|亲戚|家庭|见家长|丈母娘|婆婆/.test(fullText)) return '家庭关系';
  if (/道歉|对不起|得罪|冒犯|误会/.test(fullText)) return '道歉修复';
  return '通用社交';
}

function buildStrategies(situation, answers, profile) {
  var context = detectContext(situation, answers);

  var relationAnswer = '';
  var goalAnswer = '';
  answers.forEach(function (a) {
    if (a.question.indexOf('关系') !== -1) relationAnswer = a.answer;
    if (a.question.indexOf('效果') !== -1 || a.question.indexOf('目标') !== -1) goalAnswer = a.answer;
  });

  var isSenior = /领导|导师|上级|老板/.test(relationAnswer);
  var isReject = /拒绝|不想/.test(goalAnswer);

  return [
    {
      typeKey: 'positive', typeLabel: '① 正向回应型',
      script: buildPositiveScript(context, isSenior),
      rhythm: isSenior ? '立刻回复，表达积极态度' : '看到后稍等片刻再回，不要太急',
      counterQuestion: buildCounterQuestion(context, 'positive'),
      risk: isSenior ? '如果最终没兑现会被认为说空话。确保你能做到80%以上再选这条。' : '显得太配合，可能让对方觉得你好说话、下次继续。',
      strategicNote: '正向回应的关键是"接住+留后路"。不是跪舔——你在表达善意的同时悄悄设了一条底线。'
    },
    {
      typeKey: 'defensive', typeLabel: '② 委婉防守型',
      script: buildDefensiveScript(context, isReject),
      rhythm: '不要秒回，等10-30分钟，显得你在忙但没在逃避',
      counterQuestion: buildCounterQuestion(context, 'defensive'),
      risk: '模糊表达可能被对方继续追问。如果对方是死缠烂打型，需要准备第二轮话术。',
      strategicNote: '防守的核心是"不完全拒绝，只是重新提案"。对方会觉得你在合作，而不是在对抗。'
    },
    {
      typeKey: 'reverse', typeLabel: '③ 反问转移型',
      script: buildReverseScript(context, isSenior),
      rhythm: '立刻回——反问的关键是时机，慢了就失去主动权',
      counterQuestion: buildCounterQuestion(context, 'reverse'),
      risk: isSenior ? '如果对方觉得"你应该自己知道"，会觉得你在踢皮球。' : '对方如果强势，可能会觉得你在回避问题。',
      strategicNote: '反问不是真不知道——是把球踢回去，用对方的回答来决定你的下一步。'
    },
    {
      typeKey: 'humor', typeLabel: '④ 幽默破局型',
      script: buildHumorScript(context),
      rhythm: '立刻回，气氛要快——幽默过了时机就是尴尬',
      counterQuestion: buildCounterQuestion(context, 'humor'),
      risk: isSenior ? '⚠️ 高风险！大部分中国职场关系不接受下属用幽默化解严肃问题。' : '如果对方正处于强烈情绪中，幽默可能被理解为不重视。',
      strategicNote: '幽默是关系的试金石——对方跟着笑了，说明你们的关系基础比这件事更牢固。'
    },
    {
      typeKey: 'direct', typeLabel: '⑤ 直球表态型',
      script: buildDirectScript(context, isReject),
      rhythm: '想清楚确认了再发，不要犹豫后补第二句——直球打出去就不能收回来',
      counterQuestion: buildCounterQuestion(context, 'direct'),
      risk: '干脆的回应可能在短期让对方不舒服。但长期看，清晰边界比模糊承诺更受人尊重。',
      strategicNote: '直球=你已经做了决定，只是需要一句话把决定说出来。'
    }
  ];
}

function buildPositiveScript(context, isSenior) {
  var t = {
    '导师催论文': '好的老师，我尽量在这周内改完发给您。有几个地方我在补充数据，如果延迟我会提前跟您说。',
    '拒绝请求': '我挺想帮你的，但我手头确实排满了。要不你问问XX？他最近好像没那么忙。',
    '职场上下级': '收到，我理解您的考虑。我会认真准备，有什么需要我提前做的吗？',
    '亲密关系': '我听到了。让我想想怎么好好跟你说——我在乎你的感受，也想把事情说清楚。',
    '家庭关系': '我明白您的意思。让我想想怎么做最合适，我会认真考虑您的建议。',
    '道歉修复': '这件事确实是我没做好。我想弥补，你说，我怎么做。'
  };
  return t[context] || t['职场上下级'];
}

function buildDefensiveScript(context, isReject) {
  var t = {
    '导师催论文': '老师，这周我这边确实有点紧，能不能您先看看我已经改完的部分，剩下的我下周三前给您？',
    '拒绝请求': '哎呀这个我确实不太方便，最近自己的事都忙不过来了。你懂的哈～',
    '职场上下级': '好的领导，我也一直在复盘自己的工作。如果有做得不够的地方，希望能得到您的指点。',
    '亲密关系': '我知道这件事让你不开心了，我也在反思。给我一点时间，我好好想想怎么跟你说。',
    '家庭关系': '您说的对，我再想想。这事不急的话，我考虑清楚了再跟您聊。',
    '道歉修复': '我想先冷静一下，好好想想怎么跟你道歉不是一句"对不起"就完了。给我一点时间好吗？'
  };
  return t[context] || t['职场上下级'];
}

function buildReverseScript(context, isSenior) {
  var t = {
    '导师催论文': '老师，我正好想请教您——您觉得目前这个版本最大的问题在哪一块？我想把精力集中在最关键的地方改。',
    '拒绝请求': '你具体需要我怎么帮？我看看我能不能挤出一点时间。',
    '职场上下级': '领导，正好我也想找个时间和您聊聊——您觉得我目前的工作中，哪一块最需要加强？',
    '亲密关系': '你希望我怎么做，你会好受一点？我是真的想知道。',
    '家庭关系': '您觉得最理想的结果是什么样的？我想听听您的看法。',
    '道歉修复': '你觉得我最让你失望的是什么？我想听实话，这样才能真的改。'
  };
  return t[context] || t['职场上下级'];
}

function buildHumorScript(context) {
  var t = {
    '导师催论文': '老师，我现在改论文的速度跟我的发际线后退速度成正比。会尽快，这周继续肝！',
    '拒绝请求': '哈哈哈我自己的事都快把deadline当跳绳了。你找别人吧，我这儿自身难保。',
    '职场上下级': '看来下周我得把工位擦干净点了😂 领导放心，该做的我不会掉链子。',
    '亲密关系': '完蛋了，我感觉又要被教育了😂 说吧，我洗耳恭听（真的）。',
    '家庭关系': '我这是遗传了您的倔脾气，咱俩就不能好好坐下来商量吗😄',
    '道歉修复': '我现在都不敢说话了，怕越说越错😂 你教教我，我保证好好学。'
  };
  return t[context] || t['导师催论文'];
}

function buildDirectScript(context, isReject) {
  var t = {
    '导师催论文': '老师，这周确实改不完，最快下周三。我想确保质量而不是赶时间，您看行吗？',
    '拒绝请求': '不好意思，这个忙我帮不了。我自己也有一堆事要处理。',
    '职场上下级': '收到。我有信心做好，您考核时我会把最近的工作成果整理清楚。',
    '亲密关系': '我知道我哪做得不对。我想弥补，你说，我怎么做。',
    '家庭关系': '我尊重您的意见，但这次我的想法不太一样。我们能不能各自说说理由？',
    '道歉修复': '是我的错，没有借口。我会用行动证明，不是嘴上说说。'
  };
  return t[context] || t['导师催论文'];
}

function buildCounterQuestion(context, type) {
  var map = {
    '导师催论文_positive': '哪几个地方？具体什么时候能给我？',
    '导师催论文_defensive': '你改了多少了？先发过来看看。',
    '导师催论文_reverse': '主要是文献综述太弱了，方法和结论也要看看。',
    '导师催论文_humor': '哈哈别贫了，到底能不能行？',
    '导师催论文_direct': '行吧，那下周三一定。',
    '拒绝请求_positive': 'XX说他也不确定，你能不能抽一点点时间？',
    '拒绝请求_defensive': '哎呀就一下下，帮帮忙嘛。',
    '拒绝请求_reverse': '就是帮我改一下这个方案。',
    '拒绝请求_humor': '哈哈哈哈好吧祝你活着。',
    '拒绝请求_direct': '哦好的，没事。',
    '职场上下级_positive': '你自己觉得有哪些方面可以做得更好？',
    '职场上下级_defensive': '那你觉得自己最大的问题在哪？',
    '职场上下级_reverse': '我觉得你在XX方面可以加强。',
    '职场上下级_humor': '少贫嘴，把你最近的工作总结发我。',
    '职场上下级_direct': '好的，期待看到你的总结。'
  };
  return map[context + '_' + type] || '对方可能有自己的看法，准备好接住。';
}

// ========== DeepSeek API 调用封装 ==========

function safeParseJSON(raw) {
  // 剥离 markdown 代码块包裹（```json ... ```）
  var stripped = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  try { return JSON.parse(stripped); } catch (e) { /* continue */ }
  try { return JSON.parse(raw); } catch (e) { /* continue */ }
  var match = (stripped.match(/\{[\s\S]*\}/) || raw.match(/\{[\s\S]*\}/));
  if (match) {
    try { return JSON.parse(match[0]); } catch (e) { /* continue */ }
  }
  throw new Error('JSON parse failed: ' + raw.substring(0, 200));
}

function buildAskUserMessage(situation, answers) {
  var parts = ['用户描述了以下社交困境：', '"' + situation + '"', ''];
  if (answers.length > 0) {
    parts.push('目前已收集的信息：');
    answers.forEach(function (a, i) {
      parts.push((i + 1) + '. ' + a.question + ' → ' + a.answer);
    });
  } else {
    parts.push('尚未收集任何信息。');
  }
  parts.push('');
  parts.push('请判断信息是否充足，返回 JSON。');
  return parts.join('\n');
}

function buildGenerateUserMessage(situation, answers, profile) {
  var parts = ['用户描述了以下社交困境：', '"' + situation + '"', '', '收集到的完整信息：'];
  answers.forEach(function (a, i) {
    parts.push((i + 1) + '. ' + a.question + ' → ' + a.answer);
  });
  if (profile && profile.lifeStage) {
    parts.push('');
    parts.push('用户人设：' + JSON.stringify(profile));
  }
  parts.push('');
  parts.push('请基于以上信息生成3-5条不同角度的回复策略，返回 JSON。');
  return parts.join('\n');
}

async function llmAnalyzeGaps(situation, answers) {
  // 1. 构建检索查询
  var searchQuery = situation;
  if (answers.length > 0) {
    searchQuery += ' ' + answers.map(function(a) { return a.answer; }).join(' ');
  }

  // 2. 预检索：Agent 自己查两个知识库（不等模型要）
  var askRules = [];
  var genRules = [];
  try {
    askRules = await rag.searchKnowledge(searchQuery, 'ask', 5);
    console.log('Ask: 预检索 Ask KB →', askRules.length, '条规则');
  } catch (e) {
    console.log('Ask: 预检索 Ask KB 失败:', e.message);
  }
  try {
    genRules = await rag.searchKnowledge(searchQuery, 'generate', 3);
    console.log('Ask: 预检索 Generate KB →', genRules.length, '条规则');
  } catch (e) {
    console.log('Ask: 预检索 Generate KB 失败:', e.message);
  }

  // 3. 拼装知识库上下文，注入 prompt（用 compact 摘要，精简但不丢维度方向）
  var knowledgeContext = '';
  if (askRules.length > 0) {
    knowledgeContext += '## 追问维度参考（知识库告诉你这类场景该问什么）\n';
    askRules.forEach(function(r, i) {
      knowledgeContext += (i + 1) + '. ' + (r.compact || r.tactical_note) + '\n';
    });
    knowledgeContext += '\n';
  }
  if (genRules.length > 0) {
    knowledgeContext += '## 策略方向参考（知识库告诉你这类场景有哪些策略可用）\n';
    genRules.forEach(function(r, i) {
      knowledgeContext += (i + 1) + '. ' + (r.compact || r.tactical_note) + '\n';
    });
    knowledgeContext += '\n';
  }
  if (knowledgeContext.length === 0) {
    knowledgeContext = '知识库中暂无匹配规则，请根据你的通用社交知识判断。\n\n';
  }

  // 4. 单次 API 调用（知识库已在 prompt 里，不需要 tool-loop）
  var userMsg = knowledgeContext + buildAskUserMessage(situation, answers);

  try {
    var raw = await deepseek.chat(prompts.ASK_PROMPT, userMsg, { model: deepseek.FAST_MODEL, maxTokens: 4096 });
    return safeParseJSON(raw);
  } catch (e) {
    console.log('Ask LLM 失败:', e.message);
  }

  // 失败返回 null，触发外层硬编码 fallback
  return null;
}

/**
 * Generate 阶段 LLM 调用（单轮直发，Agent 提前查好知识库）
 *
 * 自主检索 Ask KB + Generate KB 两个库，把所有信息拼进一个 prompt，一轮发给模型。
 * 不需要工具调用循环——Agent 自己全查完。
 */
async function llmGenerateStrategies(situation, answers, profile) {
  // 1. 构建检索查询（situation + 用户所有回答）
  var searchQuery = situation;
  if (answers.length > 0) {
    searchQuery += ' ' + answers.map(function(a) { return a.answer; }).join(' ');
  }

  // 2. 查 Generate KB（策略规则）
  var genRules = [];
  try {
    genRules = await rag.searchKnowledge(searchQuery, 'generate', 5);
    console.log('Generate: 检索 Generate KB →', genRules.length, '条规则');
  } catch (e) {
    console.log('Generate: 检索 Generate KB 失败:', e.message);
  }

  // 2. 拼装 knowledge context（只查 Generate KB，Ask 阶段的成果已在 answers 里）
  var knowledgeContext = '';

  if (genRules.length > 0) {
    knowledgeContext += '## 策略生成规则（基于以下规则，使用其中的策略方向和雷区）\n';
    genRules.forEach(function(r, i) {
      knowledgeContext += (i + 1) + '. ' + (r.compact || r.tactical_note) + '\n';
    });
    knowledgeContext += '\n';
  }

  if (knowledgeContext.length === 0) {
    knowledgeContext = '知识库中暂无匹配规则，请根据你的通用社交知识生成策略。\n\n';
  }

  // 3. 拼装 user message（知识库内容直接注入）
  var userMsg = buildGenerateUserMessage(situation, answers, profile);
  userMsg = knowledgeContext + userMsg;

  // 4. 流式直发
  try {
    var lastLog = Date.now();
    var raw = await deepseek.chatStream(prompts.GENERATE_PROMPT, userMsg, { maxTokens: 8192 }, function(chunk) {
      // 每2秒汇报一次进度，避免刷屏
      var now = Date.now();
      if (now - lastLog > 2000) {
        process.stdout.write('.');
        lastLog = now;
      }
    });
    console.log(''); // 换行
    return safeParseJSON(raw);
  } catch (e) {
    console.log('Generate LLM 流式失败，重试:', e.message);
    return safeParseJSON(await deepseek.chat(prompts.GENERATE_PROMPT, userMsg, { maxTokens: 8192 }));
  }
}

// ========== 主入口 ==========

exports.main = async function (event, context) {
  var situation = (event.situation || '').trim();
  var answers = event.answers || [];
  var phase = event.phase || 'auto';
  var profile = event.profile || {};

  // 自动判断阶段
  if (phase === 'auto') {
    if (!situation) {
      phase = 'split';
    } else if (answers.length === 0) {
      phase = 'ask';
    } else {
      // 1轮自由叙述 + 最多4轮选择题 = 最多5轮追问
      phase = (answers.length < 5) ? 'ask' : 'generate';
    }
  }

  // ===== SPLIT 阶段（硬编码） =====
  if (phase === 'split') {
    return {
      fact: '用户首次进入人情世故顾问，尚未描述具体场景。',
      action: '展示分流选择卡片。"急需答案"引导用户描述场景；"提前录入"调用updateProfile。',
      card: {
        type: 'split',
        title: '你需要什么帮助？',
        options: [
          { key: 'urgent', label: '🆘 急需答案', desc: '直接说问题，我边问边记，立刻给你方案' },
          { key: 'prepare', label: '📝 提前录入', desc: '花1-2分钟建你的人设档案，以后更快更准' }
        ]
      }
    };
  }

  // ===== ASK 阶段（LLM + 硬编码fallback） =====
  if (phase === 'ask') {

    // ----- 第一轮：自由叙述 -----
    // 用户刚输入场景描述（可能只有一句话），先让ta自由叙述完整情况。
    // 不调 LLM——等用户把故事讲完，后续选择题追问才有高质量上下文。
    if (answers.length === 0) {
      return {
        fact: '用户已输入初步场景：' + (situation || '').substring(0, 100) + '。引导自由叙述完整情况。',
        action: '展示自由叙述卡片。用户提交后继续追问（phase=ask）。',
        card: {
          type: 'question', questionType: 'free',
          questionIndex: 1,
          totalQuestions: 5,   // 1轮自由叙述 + 最多4轮选择题
          text: '把你知道的都告诉我吧——越详细越好。想到什么说什么，不用组织语言。',
          directionHints: [
            '对方是什么样的人（性格、职位、跟你的关系）',
            '具体发生了什么（时间、地点、说了什么、怎么说的）',
            '你最担心什么后果？之前有没有类似的事？',
            '有什么绝对不能做或不能说的',
            '你希望达到的最好结果是什么'
          ],
          isLast: false
        }
      };
    }

    // ----- 第二轮起：选择题追问 -----
    // 用户已通过自由叙述提供了详细背景。现在调 LLM 分析缺口，生成精准选择题。
    // 固定 5 题（1 自由 + 4 选择），第 5 题答完才切 Generate。
    var CHOICE_COUNT = 4;  // 自由叙述后固定 4 道选择题
    var choiceIndex = answers.length - 1;  // 当前是第几道选择题（0-based）

    var llmUsed = false;
    if (choiceIndex < CHOICE_COUNT) {
      try {
        var llmResult = await llmAnalyzeGaps(situation, answers);

        if (llmResult && llmResult.questions && llmResult.questions.length > 0) {
          // 从 LLM 返回的题目中取当前索引。LLM 不够 4 道时，剩余用硬编码补
          var question = llmResult.questions[choiceIndex];
          if (question) {
            llmUsed = true;
            var isLast = choiceIndex >= CHOICE_COUNT - 1;
            return {
              fact: '已收集' + answers.length + '轮信息。当前追问：' + (question.text || '').substring(0, 30) + '...',
              action: '展示追问卡片。用户选择后继续调用本工具，phase=ask。',
              card: {
                type: 'question', questionType: 'choice',
                questionIndex: answers.length + 1,
                totalQuestions: 5,
                text: question.text,
                options: question.options || [],
                isLast: isLast
              }
            };
          }
          // LLM 返回了题但不够 → llmUsed 保持 false，走硬编码补位
        }
      } catch (e) {
        console.log('LLM ask failed, fallback to hardcoded:', (e && e.message));
      }
    }

    // Fallback: 硬编码（LLM 失败或返回空时走这里）
    // 同样固化 5 题：1 自由叙述 + 4 道选择题
    if (!llmUsed && choiceIndex < CHOICE_COUNT) {
      var gaps = analyzeGaps(situation, answers);
      var askedKeys = {};
      answers.forEach(function (a) {
        gaps.forEach(function (g) {
          if (a.question && a.question.indexOf(g.text.substring(0, 4)) !== -1) {
            askedKeys[g.key] = true;
          }
        });
      });
      var freshGaps = gaps.filter(function (g) { return !askedKeys[g.key]; });

      // 用新鲜 gap，不够则循环复用（确保始终有题可出）
      var currentGap;
      if (freshGaps.length > 0) {
        currentGap = freshGaps[0];
      } else {
        // 全部问完一轮，循环复用第一道
        currentGap = gaps[0];
      }

      var isLast = choiceIndex >= CHOICE_COUNT - 1;

      return {
        fact: '正在收集信息（硬编码fallback）。当前追问维度：' + currentGap.key + '。',
        action: '展示追问卡片。用户选择后继续调用本工具，phase=ask。',
        card: {
          type: 'question', questionType: 'choice',
          questionIndex: answers.length + 1,
          totalQuestions: 5,
          text: currentGap.text,
          options: currentGap.options,
          isLast: isLast
        }
      };
    }

    // 选择题已问够 4 道（总 5 题），切到 Generate 阶段
    phase = 'generate';
  }

  // ===== GENERATE 阶段（LLM + 硬编码fallback） =====
  if (phase === 'generate') {
    // 尝试 LLM
    try {
      var genResult = await llmGenerateStrategies(situation, answers, profile);

      if (genResult && genResult.strategies && genResult.strategies.length > 0) {
        var llmStrategies = genResult.strategies.map(function (s, i) {
          return {
            typeKey: 'llm_' + i,
            typeLabel: (i + 1) + ' ' + (s.angle || '策略' + (i + 1)),
            script: s.script || '',
            rhythm: s.rhythm || '',
            counterQuestion: s.counterPrediction || '',
            risk: s.risk || '',
            strategicNote: ''
          };
        });

        return {
          fact: '场景：' + (genResult.contextLabel || '社交咨询') + '。' + (genResult.analysis || ''),
          action: '展示策略列表卡片。用户选择一条复制话术，或重新生成。',
          card: {
            type: 'strategy_list',
            contextLabel: genResult.contextLabel || '社交咨询',
            guideTitle: '怎么选？先看这张表',
            guideIntro: '下面' + llmStrategies.length + '条是不同战略路径，不是同一种意思的不同说法。每条路走下去，对方反应和后续走向都不一样。',
            guideQuickRef: llmStrategies.map(function (s) {
              return { label: s.typeLabel, desc: s.rhythm, bg: 'dynamic-bg' };
            }),
            guideTip: '💡 不确定选哪个？先看每条的风险提示，排除你不能承担的。',
            strategies: llmStrategies
          }
        };
      }
    } catch (e) {
      console.log('LLM generate failed, fallback to hardcoded:', (e && e.message));
    }

    // Fallback: 硬编码
    var hardStrategies = buildStrategies(situation, answers, profile);
    var contextLabel = detectContext(situation, answers);

    return {
      fact: '场景类型：' + contextLabel + '。已结合知识库生成5条策略。',
      action: '展示5条策略卡片。用户选择一条复制话术。',
      card: {
        type: 'strategy_list',
        contextLabel: contextLabel,
        guideTitle: '怎么选？先看这张表',
        guideIntro: '下面5条是不同战略路径，不是同一种意思的5种说法。',
        guideQuickRef: [
          { label: '① 正向回应', desc: '接住对方 → 适合关系好、想推进', bg: 'positive-bg' },
          { label: '② 委婉防守', desc: '设边界 → 要拒绝、要保护自己', bg: 'defensive-bg' },
          { label: '③ 反问转移', desc: '探底牌 → 争取时间、不确定对方意图', bg: 'reverse-bg' },
          { label: '④ 幽默破局', desc: '降温 → 尴尬场景、想轻松气氛', bg: 'humor-bg' },
          { label: '⑤ 直球表态', desc: '不绕 → 需要明确立场、不能再模糊', bg: 'direct-bg' }
        ],
        guideTip: '💡 不确定选哪个？先看每条的风险提示，排除你不能承担的。',
        strategies: hardStrategies
      }
    };
  }

  // 兜底
  return {
    fact: '无法确定当前阶段。',
    action: '询问用户是否需要帮助回复消息，或查询社交礼仪规则。',
    card: {
      type: 'text',
      text: '你想让我怎么帮你？可以直接描述你的社交场景，我帮你分析。'
    }
  };
};

exports.safeParseJSON = safeParseJSON;
