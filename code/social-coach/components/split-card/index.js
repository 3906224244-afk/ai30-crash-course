/**
 * split-card 原子组件 — 分流选择卡片
 *
 * 用户在微信AI对话流中首次匹配时展示，选择使用模式：
 *   - urgent:  急需答案（直接描述场景 → 追问 → 生成策略）
 *   - prepare: 提前录入（跳转小程序人设录入页）
 *
 * 数据来源: getSocialAdvice phase=split 时返回
 * structuredContent = { type: 'split', title, options: [{key, label, desc}] }
 */

Component({
  properties: {
    title:   { type: String, value: '你需要什么帮助？' },
    options: { type: Array,  value: [] }
  },

  data: {
    _modelCtx: null,
    _viewCtx:  null,
    _maxHeight: 310,
    cardId: ''
  },

  lifetimes: {
    created() {
      try {
        const modelCtx = wx.modelContext.getContext(this);
        const viewCtx  = wx.modelContext.getViewContext(this);
        const { NotificationType } = wx.modelContext;

        this.setData({ _modelCtx: modelCtx, _viewCtx: viewCtx });

        modelCtx.on(NotificationType.Result, (data) => {
          const sc   = data.result.structuredContent || {};
          const meta = data.result._meta || {};

          this.setData({
            title:   sc.title   || '你需要什么帮助？',
            options: sc.options || [],
            cardId:  meta.id    || 'split-' + Date.now()
          });

          viewCtx.setRelatedPage({
            query: `id=${this.data.cardId}`
          });
        });

        viewCtx.on(NotificationType.Overflow, (data) => {});
        viewCtx.on(NotificationType.Expire, () => {
          this.setData({ _modelCtx: null, _viewCtx: null });
        });

        const dims = viewCtx.getDimensions();
        if (dims && dims.width) {
          this.setData({ _maxHeight: dims.width });
        }
      } catch (e) {
        // 独立模式降级
      }
    }
  },

  methods: {
    /**
     * 用户点击某个选项
     * @param {Object} e - tap 事件，e.currentTarget.dataset.key 为选项标识
     */
    onSelectOption(e) {
      const key   = e.currentTarget.dataset.key;
      const label = e.currentTarget.dataset.label;
      const desc  = e.currentTarget.dataset.desc;

      if (!this.data._modelCtx) return;

      if (key === 'urgent') {
        // 急需答案 → 引导用户描述场景
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: `用户选择：${label} — ${desc}` },
            { type: 'api/call', data: {
              name: 'getSocialAdvice',
              arguments: { situation: '', phase: 'split', answers: [], profile: {} }
            }}
          ]
        });
      } else if (key === 'prepare') {
        // 提前录入 → 发送上行消息并引导到人设录入
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: `用户选择：${label} — 需要跳转到人设录入页面` }
          ]
        });
      }
    }
  }
});
