// 咨询页：温暖极简对话流
// 优先走 dev server，失败 → 云函数，再失败 → 本地模板
var DEV_URL = 'http://localhost:3001';

Page({
  data: {
    step: 0,
    hasProfile: false,

    // 场景chips
    sceneChips: [
      { id: 'workplace', label: '职场', active: false },
      { id: 'school', label: '校园', active: false },
      { id: 'romance', label: '亲密', active: false },
      { id: 'family', label: '家庭', active: false }
    ],
    activeScene: '',

    questions: [],
    currentQIndex: 0,
    isLastQuestion: false,
    directionHints: [],
    answers: [],
    strategies: [],
    contextLabel: '',
    guideQuickRef: [
      { label: '① 正向回应', desc: '接住对方 → 适合关系好、想推进', bg: 'positive-bg' },
      { label: '② 委婉防守', desc: '设边界 → 要拒绝、要保护自己', bg: 'defensive-bg' },
      { label: '③ 反问转移', desc: '探底牌 → 争取时间、不确定对方意图', bg: 'reverse-bg' },
      { label: '④ 幽默破局', desc: '降温 → 尴尬场景、想轻松气氛', bg: 'humor-bg' },
      { label: '⑤ 直球表态', desc: '不绕 → 需要明确立场、不能再模糊', bg: 'direct-bg' }
    ],
    totalQuestions: 5,
    questionType: 'free',
    showOptions: false,
    freeText: '',
    cloudAvailable: true,
    canGoBack: false
  },

  onLoad: function () {
    var profile = wx.getStorageSync('userProfile');
    if (profile && profile.lifeStage) {
      this.setData({ hasProfile: true });
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  onShow: function () {
    var profile = wx.getStorageSync('userProfile');
    this.setData({ hasProfile: !!(profile && profile.lifeStage) });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  /* ========== 场景chips ========== */

  onChipTap: function (e) {
    var id = e.currentTarget.dataset.id;
    var chips = this.data.sceneChips;
    var activeScene = '';

    chips.forEach(function (c) {
      if (c.id === id) {
        c.active = !c.active;
        if (c.active) activeScene = c.id;
      } else {
        c.active = false;
      }
    });

    this.setData({ sceneChips: chips, activeScene: activeScene });
    wx.vibrateShort({ type: 'light' });
  },

  /* ========== 自由文本 ========== */

  onFreeInput: function (e) {
    this.setData({ freeText: e.detail.value });
  },

  backToStart: function () {
    this.resetAdvice();
  },

  onSubmitFree: function () {
    var text = (this.data.freeText || '').trim();
    var activeScene = this.data.activeScene;

    if (!text && !activeScene) return;

    // 进入等待态
    this.setData({ questionType: 'waiting' });

    var answer = text || '';
    if (activeScene) {
      var chip = this.data.sceneChips.find(function (c) { return c.id === activeScene; });
      if (chip) answer = '【场景：' + chip.label + '】' + (text || '');
    }

    var q = this.data.questions[this.data.currentQIndex];
    this._waitStart = Date.now();
    this.advanceQuestion(q, answer);
  },

  /* ========== 开始聊聊 ========== */

  startConversation: function () {
    this.setData({
      step: 1,
      questionType: 'free',
      questions: [{ type: 'free', text: '把你知道的都告诉我吧' }],
      totalQuestions: 5,
      canGoBack: false,
      sceneChips: this.data.sceneChips.map(function (c) {
        return { id: c.id, label: c.label, icon: c.icon, color: c.color, active: false };
      }),
      activeScene: '',
      freeText: ''
    });
  },

  goProfile: function () {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  /* ========== 云函数调用 ========== */

  callCloud: function (name, data) {
    var that = this;
    return new Promise(function (resolve, reject) {
      if (!wx.cloud || !that.data.cloudAvailable) {
        return reject(new Error('云环境不可用'));
      }
      wx.cloud.callFunction({
        name: name,
        data: data,
        success: function (res) { resolve(res.result); },
        fail: function (err) {
          console.log(name + ' 调用失败:', err.errMsg);
          if (that.data.cloudAvailable) {
            that.setData({ cloudAvailable: false });
          }
          reject(err);
        }
      });
    });
  },

  /* ========== 开发服务器 ========== */

  callDevServer: function (data) {
    return new Promise(function (resolve, reject) {
      // 只有开发版（工具/预览调试）才走本地 dev server，体验版/正式版直接跳去云函数
      var envVersion = 'release';
      try { envVersion = wx.getAccountInfoSync().miniProgram.envVersion; } catch (e) {}
      if (envVersion !== 'develop') {
        return reject(new Error('非开发版，跳过 dev server'));
      }
      wx.request({
        url: DEV_URL + '/',
        method: 'POST',
        data: data,
        header: { 'Content-Type': 'application/json' },
        timeout: 120000,
        success: function (res) {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data);
          } else {
            reject(new Error('dev server returned ' + res.statusCode));
          }
        },
        fail: function (err) {
          console.log('Dev server 不可用:', err.errMsg);
          reject(err);
        }
      });
    });
  },

  getProfile: function () {
    try { return wx.getStorageSync('userProfile') || {}; }
    catch (e) { return {}; }
  },

  /* ========== 追问生成（本地 fallback） ========== */

  generateQuestions: function (situation) {
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
        text: '对方是什么样的人？这决定了用什么方式沟通最有效。',
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
        text: '你跟对方之前有过类似的情况吗？',
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

    qs.push({ type: 'free', text: '还有什么想让我知道的？' });
    return qs;
  },

  /* ========== 追问处理 ========== */

  onQuestionSubmit: function (e) {
    var d = e.detail;
    var q = this.data.questions[this.data.currentQIndex];
    this.setData({ questionType: 'waiting' });
    this._waitStart = Date.now();
    this.advanceQuestion(q, d.label || d.answer);
  },

  onQuestionSkip: function (e) {
    var q = this.data.questions[this.data.currentQIndex];
    this.advanceQuestion(q, '跳过');
  },

  onGoBack: function () {
    var prevIndex = this.data.currentQIndex - 1;
    if (prevIndex < 0) return;

    var answers = this.data.answers.slice(0, -1);  // 去掉最后一个回答
    var prevQ = this.data.questions[prevIndex];

    this.setData({
      currentQIndex: prevIndex,
      answers: answers,
      canGoBack: prevIndex > 0,
      isLastQuestion: false,
      questionType: prevQ.type,
      showOptions: prevQ.type === 'choice',
      freeText: prevQ.type === 'free' ? (answers.length > 0 ? answers[answers.length - 1]?.answer || '' : '') : this.data.freeText
    });
  },

  advanceQuestion: function (q, answer) {
    var that = this;
    var answers = this.data.answers.concat([{
      question: q.text,
      answer: answer || '跳过'
    }]);

    var askData = {
      situation: answers.length > 0 ? answers[0].answer : '',
      answers: answers,
      phase: 'ask',
      profile: this.getProfile()
    };

    console.log('[advice] 调用 dev server...');
    this.callDevServer(askData).then(function (result) {
      console.log('[advice] dev server 返回:', result.card ? result.card.type : '?');
      that.handleAskResult(result, answers);
    }).catch(function (err) {
      console.log('[advice] dev server 失败:', err.message || err.errMsg);
      return that.callCloud('getSocialAdvice', askData);
    }).then(function (result) {
      if (result) {
        console.log('[advice] 云函数返回:', result.card ? result.card.type : '?');
        that.handleAskResult(result, answers);
      }
    }).catch(function () {
      console.log('[advice] 全部远程失败，使用硬编码 fallback');
      that.askFallback(answers);
    });
  },

  _minWait: function (fn, minMs) {
    minMs = minMs || 1000;
    var elapsed = this._waitStart ? (Date.now() - this._waitStart) : minMs;
    var delay = Math.max(0, minMs - elapsed);
    var that = this;
    if (delay > 0) {
      setTimeout(function () { fn.call(that); }, delay);
    } else {
      fn.call(that);
    }
  },

  handleAskResult: function (result, answers) {
    var that = this;
    if (result.card && result.card.type === 'question') {
      this._minWait(function () {
        var card = result.card;
        var newQ = { type: card.questionType, text: card.text, options: card.options || [] };
        var nextIndex = that.data.currentQIndex + 1;

        that.setData({
          answers: answers, currentQIndex: nextIndex,
          canGoBack: nextIndex > 0,
          isLastQuestion: card.isLast || false,
          questionType: card.questionType,
          showOptions: card.questionType === 'choice',
          totalQuestions: card.totalQuestions || that.data.totalQuestions,
          questions: that.data.questions.concat([newQ])
        });
      });
    } else if (result.card && result.card.type === 'strategy_list') {
      this.setData({ step: 2, answers: answers });
      setTimeout(function () { that.showStrategies(result, answers); }, 1200);
    }
  },

  askFallback: function (answers) {
    var that = this;
    var nextIndex = this.data.currentQIndex + 1;
    var qs = this.data.questions;

    if (answers.length === 1 && this.data.currentQIndex === 0 && qs[0].type === 'free') {
      var fb = this.generateQuestions(answers[0].answer || '');
      if (fb.length > 0 && fb[0].type !== 'free') {
        qs = qs.concat(fb);
        this.setData({ questions: qs, totalQuestions: qs.length, questionType: qs[1].type, showOptions: qs[1].type === 'choice' });
      }
    }

    if (nextIndex >= qs.length || answers.length >= 5) {
      this.setData({ answers: answers, step: 2 });
      setTimeout(function () { that.generateResults(); }, 600);
    } else {
      this.setData({
        answers: answers, currentQIndex: nextIndex,
        canGoBack: nextIndex > 0,
        isLastQuestion: nextIndex === qs.length - 1,
        questionType: qs[nextIndex].type, showOptions: qs[nextIndex].type === 'choice'
      });
    }
  },

  /* ========== 展示策略 ========== */

  showStrategies: function (result, answers) {
    var that = this;
    var card = result.card;
    var allStrategies = (card.strategies || []).map(function (s, i) {
      return {
        typeKey: s.typeKey || ('llm_' + i),
        typeLabel: s.typeLabel || ('策略' + (i + 1)),
        script: s.script || '',
        rhythm: s.rhythm || '',
        counterQuestion: s.counterQuestion || s.counterPrediction || '',
        risk: s.risk || '',
        strategicNote: s.strategicNote || ''
      };
    });

    this.setData({
      step: 3,
      answers: answers,
      contextLabel: card.contextLabel || '社交咨询',
      strategies: [],
      strategyCount: allStrategies.length,
      allStrategiesReady: false
    });

    var revealed = [];
    allStrategies.forEach(function (s, i) {
      setTimeout(function () {
        revealed.push(s);
        var isAll = revealed.length === allStrategies.length;
        that.setData({
          strategies: revealed.slice(),
          allStrategiesReady: isAll
        });
        // 全部揭示完成后保存咨询记录
        if (isAll) {
          that._saveHistory(card.contextLabel, allStrategies);
        }
      }, 500 + i * 700);
    });
  },

  _saveHistory: function (contextLabel, strategies) {
    var record = {
      id: Date.now(),
      date: this._formatDate(new Date()),
      contextLabel: contextLabel || '社交咨询',
      question: (this.data.answers.length > 0 ? this.data.answers[0].answer : '').substring(0, 80),
      strategies: strategies.map(function (s) {
        return { typeLabel: s.typeLabel, script: s.script };
      })
    };
    try {
      var history = wx.getStorageSync('consultHistory') || [];
      history.unshift(record);
      if (history.length > 20) history = history.slice(0, 20);
      wx.setStorageSync('consultHistory', history);
    } catch (e) {}
  },

  _formatDate: function (d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var h = d.getHours();
    var min = d.getMinutes();
    return m + '/' + day + ' ' + (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
  },

  /* ========== 生成策略 ========== */

  generateResults: function () {
    var that = this;
    var answers = this.data.answers;

    var genData = {
      situation: answers.length > 0 ? answers[0].answer : '',
      answers: answers,
      phase: 'generate',
      profile: this.getProfile()
    };

    console.log('[advice] Generate: 调用 dev server...');
    this.callDevServer(genData).then(function (result) {
      console.log('[advice] Generate: dev server 返回');
      that.showStrategies(result, answers);
    }).catch(function (err) {
      console.log('[advice] Generate: dev server 失败:', err.message || err.errMsg);
      return that.callCloud('getSocialAdvice', genData);
    }).then(function (result) {
      if (result) {
        console.log('[advice] Generate: 云函数返回');
        that.showStrategies(result, answers);
      }
    }).catch(function () {
      console.log('[advice] Generate: 全部远程失败，使用硬编码');
      var s = answers.length > 0 ? answers[0].answer : '';
      var ctx = '社交场景';
      if (/导师|论文|毕业/.test(s)) ctx = '导师催论文';
      else if (/拒绝|不想|借钱/.test(s)) ctx = '拒绝请求';
      else if (/领导|老板|加薪|考核/.test(s)) ctx = '职场上下级';
      else if (/对象|女朋|男朋|暧昧/.test(s)) ctx = '亲密关系';

      var templates = that.getTemplates();
      var strategies = templates[ctx] || templates['导师催论文'];

      that.setData({ step: 3, contextLabel: ctx, strategies: strategies });
    });
  },

  /* ========== 复制 & 重置 ========== */

  onStrategyCopy: function (e) {
    wx.setClipboardData({
      data: e.detail.script,
      success: function () {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success', duration: 1500 });
      }
    });
  },

  resetAdvice: function () {
    this.setData({
      step: 0, questions: [],
      currentQIndex: 0, answers: [], strategies: [],
      isLastQuestion: false, contextLabel: '',
      activeScene: '', freeText: '',
      totalQuestions: 5, questionType: 'free', showOptions: false, cloudAvailable: true, canGoBack: false,
      sceneChips: this.data.sceneChips.map(function (c) {
        return { id: c.id, label: c.label, icon: c.icon, color: c.color, active: false };
      })
    });
  },

  /* ========== 策略模板（本地 fallback） ========== */

  getTemplates: function () {
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
