// 编辑人设页
Page({
  data: {
    currentStep: 1,
    totalSteps: 4,
    questions: [
      {
        text: '你现在的人生阶段是？',
        type: 'choice',
        options: [
          { label: 'A', text: '大学生/研究生' },
          { label: 'B', text: '职场新人（工作1-3年）' },
          { label: 'C', text: '职场老手（3年+）' },
          { label: 'D', text: '自行描述' }
        ]
      },
      {
        text: '你在社交中最常遇到的问题是？',
        type: 'choice',
        options: [
          { label: 'A', text: '不知道怎么回消息，怕说错话' },
          { label: 'B', text: '不会拒绝别人，又怕得罪人' },
          { label: 'C', text: '不懂人情世故规则（随份子、敬酒等）' },
          { label: 'D', text: '自行描述' }
        ]
      },
      {
        text: '你的沟通风格偏向哪种？',
        type: 'choice',
        options: [
          { label: 'A', text: '偏内向，话不多但想得很多' },
          { label: 'B', text: '偏外向，但有时候冲动说错话' },
          { label: 'C', text: '看人看情况，不同场合不一样' },
          { label: 'D', text: '自行描述' }
        ]
      },
      {
        text: '还有什么想让我记住的？',
        type: 'free'
      }
    ],
    directionHints: [
      '你的身份（学生/职场/自由职业）',
      '重要的人际关系（跟谁相处最头疼）',
      '正在经历的社交困境',
      '你想在社交中更擅长什么',
      '你的底线或原则',
      '所在城市/行业'
    ],
    showCustomInput: false,
    customAnswer: '',
    profile: { lifeStage: '', commonIssue: '', personality: '', extra: '' }
  },

  onLoad() {
    var saved = wx.getStorageSync('userProfile');
    if (saved) this.setData({ profile: saved });
  },

  selectOption(e) {
    var idx = e.currentTarget.dataset.index;
    var qIdx = this.data.currentStep - 1;
    var qs = this.data.questions;
    qs[qIdx].options.forEach(function(o, i) { o.selected = (i === idx); });
    var isD = qs[qIdx].options[idx].label === 'D';
    this.setData({ questions: qs, showCustomInput: isD, customAnswer: isD ? this.data.customAnswer : '' });
  },

  onCustomInput(e) { this.setData({ customAnswer: e.detail.value }); },

  nextStep() {
    var q = this.data.questions[this.data.currentStep - 1];
    var p = this.data.profile;
    var a = '';

    if (q.type === 'free') {
      a = this.data.customAnswer || '跳过';
    } else {
      var sel = q.options.find(function(o) { return o.selected; });
      if (!sel && this.data.currentStep < 4) {
        wx.showToast({ title: '请选择一个选项', icon: 'none' }); return;
      }
      if (sel) a = sel.label === 'D' ? (this.data.customAnswer || '跳过') : sel.text;
    }

    var keys = ['lifeStage', 'commonIssue', 'personality', 'extra'];
    p[keys[this.data.currentStep - 1]] = a || '跳过';

    if (this.data.currentStep === this.data.totalSteps) {
      this.saveProfile(p);
    } else {
      this.setData({ currentStep: this.data.currentStep + 1, profile: p, showCustomInput: false, customAnswer: '' });
    }
  },

  prevStep() {
    if (this.data.currentStep > 1) {
      this.setData({ currentStep: this.data.currentStep - 1, showCustomInput: false, customAnswer: '' });
    }
  },

  saveProfile(p) {
    wx.setStorageSync('userProfile', p);
    wx.showToast({ title: '人设已保存！', icon: 'success', duration: 1500 });
    setTimeout(function() { wx.navigateBack(); }, 1000);
  },

  skipAll() {
    wx.showModal({
      title: '跳过录入',
      content: '没有个人信息，建议可能不够精准。确定跳过吗？',
      success: function(r) { if (r.confirm) wx.navigateBack(); }
    });
  }
});
