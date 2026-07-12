// 咨询页：使用原子组件渲染追问和策略结果
// 原子组件在微信AI对话流中自动渲染卡片
// 在开发者工具中通过属性绑定和事件回传模拟完整流程

Page({
  data: {
    step: 0,              // 0=输入, 1=追问, 2=分析中, 3=结果
    situation: '',
    questions: [],
    currentQIndex: 0,
    isLastQuestion: false,
    directionHints: [
      '对方性格（吃软还是吃硬）',
      '之前跟对方有没有过节',
      '你最担心的后果是什么',
      '有没有共同朋友在场',
      '什么绝对不能做/说',
      '你们平时的关系是什么样的'
    ],
    answers: [],
    strategies: [],
    // strategy-list-card 所需数据
    contextLabel: '',
    guideQuickRef: [
      { label: '① 正向回应', desc: '接住对方 → 适合关系好、想推进', bg: 'positive-bg' },
      { label: '② 委婉防守', desc: '设边界 → 要拒绝、要保护自己', bg: 'defensive-bg' },
      { label: '③ 反问转移', desc: '探底牌 → 争取时间、不确定对方意图', bg: 'reverse-bg' },
      { label: '④ 幽默破局', desc: '降温 → 尴尬场景、想轻松气氛', bg: 'humor-bg' },
      { label: '⑤ 直球表态', desc: '不绕 → 需要明确立场、不能再模糊', bg: 'direct-bg' }
    ]
  },

  /* ========== Step 0: 场景输入 ========== */

  onSituationInput(e) {
    this.setData({ situation: e.detail.value });
  },

  fillExample(e) {
    this.setData({ situation: e.currentTarget.dataset.text });
  },

  submitSituation() {
    const situation = this.data.situation.trim();
    if (!situation) return;

    const questions = this.generateQuestions(situation);

    if (questions.length === 0) {
      this.generateResults();
    } else {
      this.setData({
        step: 1,
        questions: questions,
        currentQIndex: 0,
        isLastQuestion: false,
        answers: []
      });
    }
  },

  /* ========== 追问生成（与云函数 getSocialAdvice 逻辑一致） ========== */

  generateQuestions(situation) {
    var hasRelation = /领导|导师|老板|同事|朋友|对象|暧昧|相亲|甲方|父母|亲戚|同学|师兄|师姐|学弟|学妹|同门/.test(situation);
    var hasOtherPersonality = /他.*很|她.*很|他.*性格|她.*性格|对方.*比较|对方.*很|他是|她是/.test(situation);
    var hasGoal = /拒绝|想要|想让|不想|希望|准备|争取|推迟|延期|解释|道歉|挽回|推进/.test(situation);
    var hasHistory = /之前|上次|以前|一直|最近|这几天|这段时间/.test(situation);
    var hasConstraint = /绝对|千万|一定不能|底线|不能/.test(situation);

    var qs = [];

    if (!hasRelation) {
      qs.push({
        type: 'choice',
        text: '你跟对方是什么关系？这个决定了基本语气和分寸。',
        options: [
          { label: 'A', text: '领导/导师/上级 — 需要保持尊重和分寸' },
          { label: 'B', text: '同事/同学/平级 — 平等相处，但也要注意边界' },
          { label: 'C', text: '朋友/好兄弟/闺蜜 — 可以放松一点，但不想伤感情' },
          { label: 'D', text: '自行描述' }
        ]
      });
    }

    if (!hasOtherPersonality) {
      qs.push({
        type: 'choice',
        text: '对方是什么样的人？这个决定了你用什么方式跟他沟通最有效。',
        options: [
          { label: 'A', text: '比较严肃直接，公事公办型 — 别绕弯子' },
          { label: 'B', text: '表面和气但心里有数 — 话说得好听很重要' },
          { label: 'C', text: '情绪化，容易多想 — 每句话都要掂量一下' },
          { label: 'D', text: '自行描述' }
        ]
      });
    }

    if (!hasGoal) {
      qs.push({
        type: 'choice',
        text: '你最想达到什么效果？不同目标，策略完全不一样。',
        options: [
          { label: 'A', text: '委婉拒绝/争取时间 — 不想答应，但别得罪人' },
          { label: 'B', text: '解释/表达自己 — 想让对方理解我的处境' },
          { label: 'C', text: '修复/道歉/挽回 — 关系出了问题，想补救' },
          { label: 'D', text: '自行描述' }
        ]
      });
    }

    if (!hasHistory && qs.length < 3) {
      qs.push({
        type: 'choice',
        text: '你跟对方之前有过类似的情况吗？历史决定了这次该怎么出牌。',
        options: [
          { label: 'A', text: '第一次遇到这种情况 — 需要建立边界' },
          { label: 'B', text: '以前发生过，上次没处理好 — 这次要换个方式' },
          { label: 'C', text: '经常发生，已经有点烦了 — 想彻底解决' },
          { label: 'D', text: '自行描述' }
        ]
      });
    }

    if (!hasConstraint && qs.length < 3) {
      qs.push({
        type: 'choice',
        text: '有什么是你绝对不能做或绝对不能说的？帮你避开雷区。',
        options: [
          { label: 'A', text: '不能撕破脸 — 之后还要来往' },
          { label: 'B', text: '不能显得太软弱 — 这次要让对方知道我的态度' },
          { label: 'C', text: '不能撒谎/不能承诺做不到的事 — 要诚实但不伤感情' },
          { label: 'D', text: '自行描述' }
        ]
      });
    }

    // 最后一题：自由补充
    qs.push({
      type: 'free',
      text: '还有什么想让我知道的？'
    });

    return qs;
  },

  /* ========== Step 1: 追问轮 — 原子组件事件处理 ========== */

  /** question-card submit 事件 */
  onQuestionSubmit(e) {
    const { questionIndex, label, answer } = e.detail;
    const q = this.data.questions[this.data.currentQIndex];

    this.advanceQuestion(q, label || answer);
  },

  /** question-card skip 事件 */
  onQuestionSkip(e) {
    const q = this.data.questions[this.data.currentQIndex];
    this.advanceQuestion(q, '跳过');
  },

  /** 推进到下一题或生成结果 */
  advanceQuestion(q, answer) {
    const answers = [...this.data.answers, {
      question: q.text,
      answer: answer || '跳过'
    }];

    const nextIndex = this.data.currentQIndex + 1;
    if (nextIndex >= this.data.questions.length) {
      this.setData({ answers, step: 2 });
      setTimeout(() => this.generateResults(), 800);
    } else {
      this.setData({
        answers,
        currentQIndex: nextIndex,
        isLastQuestion: nextIndex === this.data.questions.length - 1
      });
    }
  },

  /* ========== Step 2 → 3: 生成策略 ========== */

  generateResults() {
    const s = this.data.situation;
    var context = '社交场景';
    if (/导师|论文|毕业/.test(s)) context = '导师催论文';
    else if (/拒绝|不想|借钱/.test(s)) context = '拒绝请求';
    else if (/领导|老板|加薪|考核/.test(s)) context = '职场上下级';
    else if (/对象|女朋|男朋|暧昧/.test(s)) context = '亲密关系';

    const templates = this.getTemplates();
    const strategies = templates[context] || templates['导师催论文'];

    this.setData({
      step: 3,
      contextLabel: context,
      strategies: strategies
    });
  },

  /* ========== Step 3: 策略结果 — 原子组件事件处理 ========== */

  /** strategy-list-card copy 事件 */
  onStrategyCopy(e) {
    const { script } = e.detail;
    wx.setClipboardData({
      data: script,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success', duration: 1500 });
      }
    });
  },

  resetAdvice() {
    this.setData({
      step: 0, situation: '', questions: [],
      currentQIndex: 0, answers: [], strategies: [],
      isLastQuestion: false, contextLabel: ''
    });
  },

  /* ========== 策略模板（MVP，后续对接 LLM） ========== */

  getTemplates() {
    return {
      '导师催论文': [
        { typeKey: 'positive', typeLabel: '① 正向回应型', script: '好的老师，我尽量在这周内改完发给您。不过有几个地方我还在补充数据，如果有延迟我会提前跟您说。', rhythm: '立刻回复，表达积极态度', counterQuestion: '哪几个地方？具体什么时候能给我？', risk: '如果最终没完成，会被认为说了空话。只在确定能完成大部分时选这条。', strategicNote: '正向回应不是跪舔，是表达积极态度+给自己留后路。注意后面那句"如果有延迟会提前说"是关键——它把你的底线悄悄放进去了。' },
        { typeKey: 'defensive', typeLabel: '② 委婉防守型', script: '老师，这周我这边确实有点紧，能不能您先看看我已经改完的部分，剩下的我下周三前给您？', rhythm: '立刻回复，不要拖延', counterQuestion: '你改了多少了？先发过来我看看。', risk: '导师如果很push，可能会不太高兴。但只要你真的有部分成果，风险可控。', strategicNote: '防守型的核心是"不完全拒绝，只是重新提案"。你给了他一个替代方案，他就不会觉得你在推脱。' },
        { typeKey: 'reverse', typeLabel: '③ 反问转移型', script: '老师，我正好想请教您——您觉得目前这个版本最大的问题在哪一块？我想着把精力集中在最关键的地方改。', rhythm: '立刻回复', counterQuestion: '主要是文献综述太弱了，方法和结论也要再看看。', risk: '如果导师觉得"你应该自己知道问题在哪"，会觉得你在踢皮球。适合跟关系还行的导师用。', strategicNote: '反问不是真的不知道，是把主动权拿回来——让导师帮你做优先级排序，这样你改论文的方向就明确了。' },
        { typeKey: 'humor', typeLabel: '④ 幽默破局型', script: '老师，我现在改论文的速度跟我的发际线后退速度成正比。会尽快，这周继续肝！', rhythm: '立刻回复，语气轻松', counterQuestion: '哈哈，别贫了，到底能不能行？', risk: '幽默有风险——导师的幽默感决定了这是加分还是翻车。只在你确定导师吃这套时选。', strategicNote: '幽默是双方关系的试金石。如果导师跟着笑了，说明你们的关系比他催你论文这件事更轻松——之后沟通都会容易很多。' },
        { typeKey: 'direct', typeLabel: '⑤ 直球表态型', script: '老师，这周确实改不完，最快下周三。我想确保质量而不是赶时间，您看行吗？', rhythm: '想清楚确认了再发，不要犹豫后补第二句', counterQuestion: '行吧，那下周三一定。', risk: '导师如果不接受，你接下来没有退路。适合你已经确定做不到、必须设定边界的情况。', strategicNote: '直球的风险写在明面上——但有时候就是需要直接。你已经知道自己做不到，继续模糊只会更糟。这是5条里最需要勇气的。' }
      ],
      '拒绝请求': [
        { typeKey: 'positive', typeLabel: '① 正向回应型', script: '我挺想帮你的，但我手头这边也确实排满了。要不你问一下XX？他最近好像没那么忙。', rhythm: '看到消息后稍等10-15分钟再回，不要太快', counterQuestion: 'XX说他也不确定，你能不能抽一点点时间？', risk: '推荐的第三人如果因此被麻烦，你可能会有连带责任。确保推荐的备选方案靠谱。', strategicNote: '正向拒绝=表达善意+给出替代方案。你不是在拒绝他这个人，你是在拒绝这件事但帮他找了出路。' },
        { typeKey: 'defensive', typeLabel: '② 委婉防守型', script: '哎呀这个我确实不太方便，最近自己的事都忙不过来了。你懂的哈～', rhythm: '可以稍等半小时再回，表现出"确实在忙"', counterQuestion: '哎呀就一下下，帮帮忙嘛', risk: '模糊拒绝容易被"再push一下"。如果对方是那种死缠烂打型，这条不一定能一次搞定。', strategicNote: '防守拒绝的核心是"不解释具体原因"。一解释就给了对方讨价还价的入口。"不太方便"是个万用理由。' },
        { typeKey: 'reverse', typeLabel: '③ 反问转移型', script: '你具体需要我怎么帮？我看看我能不能挤出一点时间。', rhythm: '立刻回', counterQuestion: '就是帮我改一下这个方案...（对方会具体描述）', risk: '危险！如果对方说了需求你发现不难做，反而更不好拒绝了。只在你想"先看看再决定"时用。', strategicNote: '反问问的是"你到底要我做什么"。很多时候对方说清楚了需求，你发现其实可以帮一点点——或者你发现确实帮不了，也就有了正当理由。' },
        { typeKey: 'humor', typeLabel: '④ 幽默破局型', script: '哈哈哈我自己的事都快把deadline当跳绳了。你找别人吧，我这儿自身难保。', rhythm: '立刻回，氛围要快', counterQuestion: '哈哈哈哈好吧祝你活着', risk: '低风险。幽默自嘲式拒绝是最不容易伤感情的。但不适合对上级或正式场合。', strategicNote: '自嘲是拒绝的最高境界——你把自己的处境说得比对方还惨，对方反而不好意思继续push你了。' },
        { typeKey: 'direct', typeLabel: '⑤ 直球表态型', script: '不好意思，这个忙我帮不了。我自己也有一堆事要处理。', rhythm: '确认决心后立刻发，不要犹豫', counterQuestion: '哦好的，没事。', risk: '干脆的拒绝可能在短时间内让对方不太舒服。但长期看，清晰边界比模糊承诺更受人尊重。', strategicNote: '适用于：对方跟你不熟或者你过去太老好人了。直接拒绝一次，对方反而会开始尊重你的时间。' }
      ],
      '职场上下级': [
        { typeKey: 'positive', typeLabel: '① 正向回应型', script: '收到，我理解您的考虑。我会认真对待这次考核，有什么需要我提前准备的吗？', rhythm: '立刻回，不要让领导等', counterQuestion: '你自己觉得有哪些方面可以做得更好？', risk: '如果你自己确实没想好怎么提升，这个反问会让你措手不及。提前想好自己的优势和改进点。', strategicNote: '正向回应的关键不是"怕"，而是"积极"。把考核这件事重新定义为"提升机会"而不是"审判"。' },
        { typeKey: 'defensive', typeLabel: '② 委婉防守型', script: '好的领导，我也一直在复盘自己的工作。如果有做得不够的地方，希望能得到您的指点。', rhythm: '想一想再回，不要秒回显得慌张', counterQuestion: '那你觉得自己最大的问题在哪？', risk: '如果领导接下来真的开始翻旧账，会比较被动。但准备了这个问题反而可以衔接。', strategicNote: '防守型把自己的姿态放低，把球交给领导。他说什么你就听什么——你是在收集信息，不是在自证。' },
        { typeKey: 'reverse', typeLabel: '③ 反问转移型', script: '领导，正好我也想找个时间和您聊聊——您觉得我目前的工作中，哪一块最需要加强？', rhythm: '找一个合适的时间窗口，不要在领导很忙的时候发', counterQuestion: '我觉得你在XX方面可以加强...', risk: '这是一个"主动要反馈"的姿态，结果取决于领导是不是愿意认真回答。如果他只是随口一说，收获不大。', strategicNote: '在被考核之前先主动问反馈——这本身就在告诉对方：你是一个追求进步的人。他的回答还能帮你提前准备考核。' },
        { typeKey: 'humor', typeLabel: '④ 幽默破局型', script: '看来下周我得把工位擦干净点了😂 领导放心，该做的我不会掉链子。', rhythm: '秒回，气氛轻松', counterQuestion: '少贫嘴，把你最近的工作总结发我。', risk: '⚠️ 高风险！大部分中国职场领导不接受下属用幽默化解严肃考核。只在互联网/创业公司或你跟领导关系特别铁时用。', strategicNote: '在国内职场，这条选的人最少——但也正因为少，如果你能用好，你跟领导的关系会显得更轻松、更像"自己人"。' },
        { typeKey: 'direct', typeLabel: '⑤ 直球表态型', script: '收到。我有信心做好，您考核时我会把最近的工作成果整理清楚。', rhythm: '秒回，干脆利落', counterQuestion: '好的，期待看到你的总结。', risk: '显得有点"硬"。如果领导觉得你不够谦虚，可能会有负面印象。适合你在团队中已经有一定口碑的情况。', strategicNote: '直球=不绕弯子。你已经确定了你的立场（"我有信心"），但你也在说"我会准备"。自信但不自大。' }
      ],
      '亲密关系': [
        { typeKey: 'positive', typeLabel: '① 正向回应型', script: '我听到了。让我想想怎么跟你好好说——我在乎你的感受，也想把事情说清楚。', rhythm: '不要秒回，给自己30秒冷静，但不要让对方等超过5分钟', counterQuestion: '那你倒是说啊？', risk: '如果对方正在气头上，这句话可能显得有点操作感。确保你的语气是真诚的。', strategicNote: '正向回应的第一步不是解决问题，是确认你听到了对方。人最怕的是被忽视——你先接住了，后面才有得谈。' },
        { typeKey: 'defensive', typeLabel: '② 委婉防守型', script: '我知道这件事让你不开心了，我也在反思。给我一点时间，我好好想想怎么跟你说。', rhythm: '可以在对方发完消息后稍等2-3分钟再回', counterQuestion: '你每次都这样，说了等于没说。', risk: '"给我一点时间"不能成为拖延的借口。你承诺了就要真的去想，否则信用会持续消耗。', strategicNote: '防守在亲密关系里不是逃避——是"我需要冷静一下才能好好跟你说话"。关键在你的后续行动要跟上。' },
        { typeKey: 'reverse', typeLabel: '③ 反问转移型', script: '你希望我怎么做，你会好受一点？我是真的想知道。', rhythm: '立刻回', counterQuestion: '你自己不会想吗？每次都来问我。', risk: '如果对方期待的是"你主动懂我"，反问会让她觉得你不够用心。但如果你真的不知道怎么做，诚实问比乱猜强。', strategicNote: '反问在亲密关系中是危险的——但它表明你不是在表演，而是真的想知道。这个态度的真诚度决定了对方接不接受。' },
        { typeKey: 'humor', typeLabel: '④ 幽默破局型', script: '完蛋了，我感觉又要被教育了😂 说吧，我洗耳恭听（真的）。', rhythm: '在冲突刚冒头时立刻发，时机最重要', counterQuestion: '你少来这套，跟你说正经的呢。', risk: '⚠️ 如果对方正处在强烈情绪中，幽默会被认为你在轻视她的感受。只适合冲突还没升级的小情绪。', strategicNote: '幽默是亲密关系的"破冰船"——但破冰船不能撞冰山。先判断对方是真生气还是小情绪，判断错了翻车很严重。' },
        { typeKey: 'direct', typeLabel: '⑤ 直球表态型', script: '我知道我哪做得不对。我想弥补，你说，我怎么做。', rhythm: '确认自己真的准备好了再发', counterQuestion: '你要我说是吗，那你听好了...', risk: '⚠️ 敞开了让对方说——你要做好真的听到不舒服的话的准备。但这是修复关系最快的一条路。', strategicNote: '直球是把自己放在最脆弱的位置。但正因为脆弱，它最能破冰。你先把姿态放低，后面才有重建的空间。' }
      ]
    };
  }
});
