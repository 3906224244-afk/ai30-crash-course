// 知识库浏览页：奶油纸底 + 手绘卡片
var localKnowledge = require('../../utils/knowledge');

// 简笔画图标路径映射
var KB_ICON_MAP = {
  1: '/images/kb-hongbao.svg',
  2: '/images/kb-wine.svg',
  3: '/images/kb-gift.svg',
  4: '/images/kb-festival.svg',
  5: '/images/kb-onboard.svg',
  6: '/images/kb-email.svg',
  7: '/images/kb-interview.svg',
  8: '/images/kb-refuse.svg',
  9: '/images/kb-apology.svg',
  10: '/images/kb-groupchat.svg',
  11: '/images/kb-wechat.svg',
  12: '/images/kb-visit.svg'
};

// 分类颜色
var CAT_COLORS = {
  '人情往来': 'var(--accent-ghost)',
  '职场规则': '#F0F4F8',
  '拒绝边界': '#FEF0EE',
  '社交应对': '#F4F8F2'
};

// 标签→分类映射
var TAG_TO_CAT = {
  '人情': '人情往来', '随份子': '人情往来', '敬酒': '人情往来',
  '见家长': '人情往来', '节日': '人情往来', '慰问': '人情往来',
  '职场': '职场规则', '入职': '职场规则', '沟通': '职场规则', '面试': '职场规则',
  '拒绝': '拒绝边界', '边界': '拒绝边界', '道歉': '拒绝边界',
  '社交': '社交应对', '群聊': '社交应对', '微信': '社交应对'
};

function getCardColor(tags) {
  for (var i = 0; i < tags.length; i++) {
    var cat = TAG_TO_CAT[tags[i]];
    if (cat && CAT_COLORS[cat]) return CAT_COLORS[cat];
  }
  return '#FFFFFF';
}

Page({
  data: {
    keyword: '',
    activeCategory: '全部',
    categories: ['全部', '人情往来', '职场规则', '拒绝边界', '社交应对'],
    entries: [],
    filteredEntries: [],
    showDetail: false,
    currentEntry: {},
    loading: false,
    cloudAvailable: true
  },

  onLoad() {
    var entries = localKnowledge.knowledgeEntries.map(function (e) {
      e.iconImg = KB_ICON_MAP[e.id] || '/images/kb-hongbao.svg';
      e.cardColor = getCardColor(e.tags);
      return e;
    });
    this.setData({ entries: entries });
    this.filterEntries();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  callCloud(name, data) {
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

  /* ========== 搜索 ========== */

  onSearch(e) {
    var kw = e.detail.value;
    this.setData({ keyword: kw });

    if (kw.trim()) {
      this.setData({ loading: true });
      this.callCloud('querySocialRule', {
        ruleType: kw.trim(),
        context: ''
      }).then(function (result) {
        if (result.card && result.card.type === 'knowledge') {
          var card = result.card;
          var newEntry = {
            id: 'cloud_' + Date.now(),
            iconImg: '/images/ui-search.svg',
            title: card.title || kw,
            brief: (card.content || '').substring(0, 60) + '...',
            tags: ['搜索结果'],
            source: card.source || '社交规则知识库',
            content: card.content || '',
            tips: card.tips || []
          };
          var entries = [newEntry].concat(this.data.entries);
          this.setData({ entries: entries, loading: false });
        }
        this.filterEntries();
      }.bind(this)).catch(function () {
        this.setData({ loading: false });
        this.filterEntries();
      }.bind(this));
    } else {
      this.filterEntries();
    }
  },

  /* ========== 分类 ========== */

  switchCategory(e) {
    var cat = e.currentTarget.dataset.cat;
    this.setData({ activeCategory: cat });
    this.filterEntries();
  },

  /* ========== 过滤 ========== */

  catTagMap: {
    '人情往来': ['人情', '随份子', '敬酒', '见家长', '节日', '慰问'],
    '职场规则': ['职场', '入职', '沟通', '面试'],
    '拒绝边界': ['拒绝', '边界', '道歉'],
    '社交应对': ['社交', '群聊', '微信']
  },

  filterEntries() {
    var entries = this.data.entries;
    var cat = this.data.activeCategory;
    var kw = this.data.keyword.trim().toLowerCase();

    if (cat !== '全部') {
      var matchTags = this.catTagMap[cat] || [];
      entries = entries.filter(function (e) {
        return e.tags.some(function (t) { return matchTags.indexOf(t) !== -1; });
      });
    }

    if (kw) {
      entries = entries.filter(function (e) {
        return (e.title || '').toLowerCase().indexOf(kw) !== -1 ||
          (e.brief || '').toLowerCase().indexOf(kw) !== -1 ||
          (e.content || '').toLowerCase().indexOf(kw) !== -1;
      });
    }

    this.setData({ filteredEntries: entries });
  },

  /* ========== 详情 ========== */

  viewDetail(e) {
    var id = e.currentTarget.dataset.id;
    var entry = this.data.entries.find(function (e) { return e.id === id; });
    if (entry) {
      this.setData({ showDetail: true, currentEntry: entry });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, currentEntry: {} });
  }
});
