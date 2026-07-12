/**
 * strategy-list-card 原子组件 — 5条策略结果卡片
 *
 * 展示5条不同战略路径的沟通方案。每条策略包含：
 *   话术、回复节奏、对方反问预判、风险提示、战略标注
 *
 * 核心挑战：5条完整策略 ~2000px，远超 1:1 最大高度 ~310px。
 * 解决方案：手风琴折叠模式。
 *   - 引导区（快速参考表 + tip）始终可见
 *   - 策略默认折叠，只显示标签 + 话术前40字
 *   - 点击展开一条，同时折叠上一条
 *
 * 数据来源: getSocialAdvice phase=generate 时返回
 * structuredContent = {
 *   type: 'strategy_list', contextLabel, guideTitle, guideIntro,
 *   guideQuickRef: [{label, desc, bg}],
 *   guideTip, strategies: [{typeKey, typeLabel, script, rhythm,
 *     counterQuestion, risk, strategicNote}]
 * }
 */

/** 策略类型颜色映射 */
var STRATEGY_COLORS = {
  positive:  { badgeBg: '#e8f8f5', badgeText: '#16a085', border: '#4ecdc4' },
  defensive: { badgeBg: '#e8f4fd', badgeText: '#2980b9', border: '#45b7d1' },
  reverse:   { badgeBg: '#fef9e7', badgeText: '#d68910', border: '#f39c12' },
  humor:     { badgeBg: '#fdedf4', badgeText: '#c0392b', border: '#e056a0' },
  direct:    { badgeBg: '#fdedec', badgeText: '#c0392b', border: '#e94560' }
};

/** 截断话术预览 */
function truncateScript(script, maxLen) {
  if (!script) return '';
  if (script.length <= maxLen) return script;
  return script.substring(0, maxLen) + '...';
}

Component({
  properties: {
    contextLabel:  { type: String, value: '' },
    guideTitle:    { type: String, value: '怎么选？先看这张表' },
    guideIntro:    { type: String, value: '' },
    guideQuickRef: { type: Array,  value: [] },
    guideTip:      { type: String, value: '' },
    strategies:    { type: Array,  value: [] }
  },

  data: {
    _modelCtx: null,
    _viewCtx:  null,
    _maxHeight: 310,
    cardId: '',

    // 手风琴状态：-1 表示全部折叠
    expandedIndex: -1,
    // 策略颜色
    strategyColors: STRATEGY_COLORS,
    // 是否展示全部（折叠态最多显示3条策略）
    showAll: false
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
            contextLabel:  sc.contextLabel  || '',
            guideTitle:    sc.guideTitle    || '怎么选？先看这张表',
            guideIntro:    sc.guideIntro    || '',
            guideQuickRef: sc.guideQuickRef || [],
            guideTip:      sc.guideTip      || '',
            strategies:    sc.strategies    || [],
            cardId:        meta.id          || 'strategy-' + Date.now(),
            expandedIndex: -1,
            showAll:       false
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
          this.setData({ _maxHeight: dims.width });
        }
      } catch (e) {
        // 独立模式降级：页面嵌入时无 max-height 限制
        this.setData({ _maxHeight: 3000 });
      }
    }
  },

  methods: {
    /**
     * 获取策略的颜色配置
     */
    getColor: function (typeKey) {
      return STRATEGY_COLORS[typeKey] || STRATEGY_COLORS.direct;
    },

    /**
     * 获取截断的话术预览
     */
    getPreview: function (script) {
      return truncateScript(script, 40);
    },

    /**
     * 点击快速参考表中的某行 → 展开对应策略
     */
    onTapGuideRow: function (e) {
      var index = e.currentTarget.dataset.index;
      this.setData({
        expandedIndex: this.data.expandedIndex === index ? -1 : index
      });
    },

    /**
     * 点击策略行 → 展开/折叠
     */
    onToggleStrategy: function (e) {
      var index = e.currentTarget.dataset.index;
      this.setData({
        expandedIndex: this.data.expandedIndex === index ? -1 : index
      });
    },

    /**
     * 展开全部策略
     */
    onToggleShowAll: function () {
      this.setData({ showAll: !this.data.showAll });
    },

    /**
     * 复制话术
     */
    onCopyScript: function (e) {
      var script    = e.currentTarget.dataset.script;
      var typeLabel = e.currentTarget.dataset.typeLabel;

      // 发送上行消息通知 AI（话术通过微信AI对话流天然可复制）
      if (this.data._modelCtx) {
        this.data._modelCtx.sendFollowUpMessage({
          content: [
            { type: 'text', text: '用户复制了策略"' + typeLabel + '"的话术：' + script }
          ]
        });
      } else {
        // 独立模式：通过事件回传给页面处理复制
        this.triggerEvent('copy', {
          script: script,
          typeLabel: typeLabel
        });
      }
    }
  }
});
