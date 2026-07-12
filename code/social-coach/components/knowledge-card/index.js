/**
 * knowledge-card 原子组件 — 知识卡片
 *
 * 展示社交礼仪规则/行情知识。只读展示型卡片，无复杂交互。
 * 用户阅读后点击"知道了"确认。
 *
 * 数据来源: querySocialRule 匹配成功时返回
 * structuredContent = { type: 'knowledge', title, content, tips, source }
 */

Component({
  properties: {
    title:   { type: String, value: '' },
    content: { type: String, value: '' },
    tips:    { type: Array,  value: [] },
    source:  { type: String, value: '' }
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
            title:   sc.title   || '',
            content: sc.content || '',
            tips:    sc.tips    || [],
            source:  sc.source  || '社交规则知识库',
            cardId:  meta.id    || 'knowledge-' + Date.now()
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
    /** 用户点击"知道了"确认 */
    onAcknowledge() {
      if (this.data._modelCtx) {
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '用户已阅读知识卡片：' + this.data.title }
          ]
        });
      }
    }
  }
});
