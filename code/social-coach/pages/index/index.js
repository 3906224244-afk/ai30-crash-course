// 首页 — 简笔画Hero + 手绘便签
var knowledge = require('../../utils/knowledge');

// 知识库图标文件名映射
var KB_ICON_MAP = {
  1: 'kb-hongbao',
  2: 'kb-wine',
  3: 'kb-gift',
  4: 'kb-festival',
  5: 'kb-onboard',
  6: 'kb-email',
  7: 'kb-interview',
  8: 'kb-refuse',
  9: 'kb-apology',
  10: 'kb-groupchat',
  11: 'kb-wechat',
  12: 'kb-visit'
};

Page({
  data: {
    currentCard: 0,
    heroIndex: 0,
    // 简笔画场景插画 Hero
    heroSlides: [
      {
        scene: 'dinner',
        tagline: '职场如局，杯中有度',
        sub: '敬酒不越级，添茶不空杯',
        image: '/images/hero-dinner.png'
      },
      {
        scene: 'family',
        tagline: '家和万事兴',
        sub: '礼到心也到，进门先放礼',
        image: '/images/hero-family.png'
      },
      {
        scene: 'borrow',
        tagline: '拒绝是边界，不是冷漠',
        sub: '不借不伤关系，借错了才伤',
        image: '/images/hero-borrow.png'
      },
      {
        scene: 'report',
        tagline: '汇报不是表演，是沟通',
        sub: '结论前置，数据在后',
        image: '/images/hero-report.png'
      }
    ],
    featuredKnowledges: []
  },

  onLoad: function () {
    var entries = knowledge.knowledgeEntries.map(function (item) {
      return {
        id: item.id,
        iconImg: '/images/' + (KB_ICON_MAP[item.id] || 'kb-hongbao') + '.svg',
        title: item.title,
        brief: item.brief,
        tags: item.tags
      };
    });
    this.setData({ featuredKnowledges: entries });

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  onHeroChange: function (e) {
    this.setData({ heroIndex: e.detail.current });
  },

  onCardChange: function (e) {
    this.setData({ currentCard: e.detail.current });
  },

  goConsult: function () {
    wx.switchTab({ url: '/pages/advice/advice' });
  },

  goProfile: function () {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  goKnowledgeDetail: function (e) {
    wx.switchTab({ url: '/pages/etiquette/etiquette' });
  }
});
