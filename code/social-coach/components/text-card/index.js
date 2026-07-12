/**
 * text-card 原子组件 — 兜底文本卡片
 *
 * 用于展示无法匹配到特定卡片类型的文本内容。
 * 最简单的卡片格式，标题可选，纯文本展示。
 *
 * 数据来源: 云函数返回的 card.type === 'text' 时
 * structuredContent = { type: 'text', title?, text }
 */

Component({
  properties: {
    title: { type: String, value: '' },
    text:  { type: String, value: '' }
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

        // 监听云函数返回结果 → structuredContent 即 card 对象
        modelCtx.on(NotificationType.Result, (data) => {
          const sc   = data.result.structuredContent || {};
          const meta = data.result._meta || {};

          this.setData({
            title: sc.title || '',
            text:  sc.text  || '',
            cardId: meta.id || 'text-' + Date.now()
          });

          viewCtx.setRelatedPage({
            query: `id=${this.data.cardId}`
          });
        });

        // 内容溢出监听
        viewCtx.on(NotificationType.Overflow, (data) => {
          // 溢出时不做处理，依靠 CSS max-height + overflow:hidden 截断
        });

        // 过期清理
        viewCtx.on(NotificationType.Expire, () => {
          this.setData({ _modelCtx: null, _viewCtx: null });
        });

        // 获取卡片尺寸用于 max-height 计算
        const dims = viewCtx.getDimensions();
        if (dims && dims.width) {
          this.setData({ _maxHeight: dims.width }); // 1:1 比例
        }
      } catch (e) {
        // 独立模式降级：不在微信AI对话框上下文中运行时
        // 组件通过 properties 接收数据
      }
    }
  },

  methods: {
    onTapCard() {
      // 点击确认，发送上行消息
      if (this.data._modelCtx) {
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '知道了' }
          ]
        });
      }
    }
  }
});
