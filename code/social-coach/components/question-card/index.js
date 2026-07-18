/**
 * question-card 原子组件 — 追问卡片
 *
 * 在咨询流程中收集用户信息。支持两种子类型：
 *   - choice: ABC+D 选择题。选 A/B/C 直接回传；选 D 展示语音引导，
 *             用户直接对微信AI说话来完成自定义回答。
 *   - free:   最后一题的开放补充。展示方向提示 + 语音引导，
 *             用户直接说出补充内容或跳过。
 *
 * 核心设计：原子组件不支持 textarea，所有文本输入通过微信AI原生语音完成。
 *
 * 数据来源: getSocialAdvice phase=ask 时返回
 * structuredContent = {
 *   type: 'question', questionType: 'choice'|'free',
 *   questionIndex, totalQuestions, text, isLast,
 *   options? (choice型), directionHints? (free型)
 * }
 */

Component({
  properties: {
    questionType:   { type: String, value: 'choice' },
    questionIndex:  { type: Number, value: 1 },
    totalQuestions: { type: Number, value: 1 },
    text:           { type: String, value: '' },
    options:        { type: Array,  value: [] },
    directionHints: { type: Array,  value: [] },
    isLast:         { type: Boolean, value: false },
    canGoBack:      { type: Boolean, value: false }
  },

  data: {
    _modelCtx: null,
    _viewCtx:  null,
    _maxHeight: 310,
    cardId: '',
    _prevAnswers: [],

    // 交互状态
    selectedIndex: -1,
    showCustomInput: false,
    customText: '',
    // 进度条宽度（px），在 attached 中根据实际容器宽度计算
    progressMaxWidth: 280
  },

  lifetimes: {
    created() {
      try {
        var modelCtx = wx.modelContext.getContext(this);
        var viewCtx  = wx.modelContext.getViewContext(this);
        var NotificationType = wx.modelContext.NotificationType;

        this.setData({ _modelCtx: modelCtx, _viewCtx: viewCtx });

        modelCtx.on(NotificationType.Result, function (data) {
          var sc   = data.result.structuredContent || {};
          var meta = data.result._meta || {};

          this.setData({
            questionType:   sc.questionType   || 'choice',
            questionIndex:  sc.questionIndex  || 1,
            totalQuestions: sc.totalQuestions || 1,
            text:           sc.text           || '',
            options:        sc.options        || [],
            directionHints: sc.directionHints || [],
            isLast:         sc.isLast         || false,
            cardId:         meta.id           || 'question-' + Date.now(),
            _prevAnswers:   sc._answers       || [],

            // 重置交互状态
            selectedIndex: -1,
            showCustomInput: false,
            customText: ''
          });

          viewCtx.setRelatedPage({
            query: 'id=' + this.data.cardId
          });
        });

        viewCtx.on(NotificationType.Overflow, function (data) {});
        viewCtx.on(NotificationType.Expire, function () {
          this.setData({ _modelCtx: null, _viewCtx: null });
        });

        var dims = viewCtx.getDimensions();
        if (dims && dims.width) {
          // 进度条宽度 = 卡片宽 - 两侧 padding (16px*2)
          this.setData({
            _maxHeight: dims.width,
            progressMaxWidth: dims.width - 32
          });
        }
      } catch (e) {
        // 独立模式降级：页面嵌入时无 max-height 限制，卡片可自然撑开
        this.setData({ _maxHeight: 2000, progressMaxWidth: 300 });
      }
    }
  },

  methods: {
    /* ========== choice 型交互 ========== */

    /** 选择一个选项 */
    onSelectOption: function (e) {
      var index = e.currentTarget.dataset.index;
      var label = e.currentTarget.dataset.label;

      this.setData({ selectedIndex: index });

      // D 选项 → 展示自定义输入框
      if (label === 'D') {
        this.setData({ showCustomInput: true });
      } else {
        this.setData({ showCustomInput: false, customText: '' });
      }
    },

    /** 返回上一题 */
    onBackChoice: function () {
      this.triggerEvent('back', { questionIndex: this.data.questionIndex });
    },

    /** D 选项自定义输入 */
    onCustomInput: function (e) {
      this.setData({ customText: e.detail.value });
    },

    /** 提交答案 */
    onSubmitChoice: function () {
      var opt = this.data.options[this.data.selectedIndex];
      if (!opt) return;

      var label = opt.label;
      var answerText = opt.text;

      if (label === 'D') {
        answerText = this.data.customText || '用户自行描述';
      }

      if (this.data._modelCtx) {
        // 累积历史答案：上次的 _prevAnswers + 本轮新答案
        var allAnswers = (this.data._prevAnswers || []).concat([{
          question: this.data.text,
          answer: label === 'D' ? '' : answerText
        }]);
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '用户回答了第' + this.data.questionIndex + '题' },
            { type: 'api/call', data: {
              name: 'getSocialAdvice',
              arguments: {
                phase: this.data.isLast ? 'generate' : 'ask',
                answers: allAnswers
              }
            }}
          ]
        });
      } else {
        // 独立模式：通过事件回传给页面
        this.triggerEvent('submit', {
          questionIndex: this.data.questionIndex,
          label: label,
          answer: label === 'D' ? '' : answerText
        });
      }
    },

    /** 跳过当前问题 */
    onSkipChoice: function () {
      if (this.data._modelCtx) {
        var allAnswers = (this.data._prevAnswers || []).concat([{
          question: this.data.text,
          answer: ''
        }]);
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '用户跳过了第' + this.data.questionIndex + '题' },
            { type: 'api/call', data: {
              name: 'getSocialAdvice',
              arguments: {
                phase: 'ask',
                answers: allAnswers
              }
            }}
          ]
        });
      } else {
        this.triggerEvent('skip', {
          questionIndex: this.data.questionIndex
        });
      }
    },

    /* ========== free 型交互 ========== */

    /** 提交自由补充（引导语音） */
    onSubmitFree: function () {
      if (this.data._modelCtx) {
        var allAnswers = (this.data._prevAnswers || []).concat([{
          question: this.data.text,
          answer: '用户已完成补充'
        }]);
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '用户完成自由补充' },
            { type: 'api/call', data: {
              name: 'getSocialAdvice',
              arguments: {
                phase: this.data.isLast ? 'generate' : 'ask',
                answers: allAnswers
              }
            }}
          ]
        });
      } else {
        this.triggerEvent('submit', {
          questionIndex: this.data.questionIndex,
          answer: ''
        });
      }
    },

    /** 跳过自由补充（直接生成） */
    onSkipFree: function () {
      if (this.data._modelCtx) {
        var allAnswers = (this.data._prevAnswers || []).concat([{
          question: this.data.text,
          answer: ''
        }]);
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '用户跳过自由补充' },
            { type: 'api/call', data: {
              name: 'getSocialAdvice',
              arguments: {
                phase: this.data.isLast ? 'generate' : 'ask',
                answers: allAnswers
              }
            }}
          ]
        });
      } else {
        this.triggerEvent('skip', {
          questionIndex: this.data.questionIndex
        });
      }
    }
  }
});
