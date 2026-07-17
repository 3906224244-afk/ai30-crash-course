// 我的 — 手账便签风格
var knowledge = require('../../utils/knowledge');

Page({
  data: {
    userName: '你好',
    personaSummary: '',
    hasProfile: false,
    profileData: null,
    stats: {
      weeklyCount: 0,
      topScene: '',
      totalStrategies: 0
    },
    savedStrategies: [],
    dailyTip: ''
  },

  onLoad() {
    this.refreshAll();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  onShow() {
    this.refreshAll();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  refreshAll() {
    this.refreshProfile();
    this.refreshStats();
    this.refreshSaved();
    this.refreshDailyTip();
  },

  /* ========== 人设 ========== */

  refreshProfile() {
    var profile = wx.getStorageSync('userProfile');
    var hasProfile = !!(profile && profile.lifeStage);

    var personaSummary = '';
    if (hasProfile) {
      var parts = [];
      if (profile.lifeStage) parts.push(profile.lifeStage);
      if (profile.traits) parts.push(profile.traits);
      personaSummary = parts.join(' · ');
    }

    this.setData({
      hasProfile: hasProfile,
      userName: hasProfile && profile.lifeStage ? this.getStageLabel(profile.lifeStage) : '你好',
      personaSummary: personaSummary,
      profileData: hasProfile ? {
        lifeStage: profile.lifeStage || '',
        traits: profile.traits || '',
        frequentScenes: profile.frequentScenes || []
      } : null
    });
  },

  getStageLabel(stage) {
    if (/大学|研究/.test(stage)) return '同学你好';
    if (/职场|工作/.test(stage)) return '职场达人';
    return '你好';
  },

  /* ========== 使用痕迹 ========== */

  refreshStats() {
    var history = wx.getStorageSync('consultHistory') || [];
    var saved = wx.getStorageSync('savedStrategies') || [];

    // 过去7天的咨询次数
    var now = Date.now();
    var sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    var weekly = history.filter(function (h) {
      return h.timestamp && h.timestamp > sevenDaysAgo;
    });

    // 最常遇到的场景
    var sceneCount = {};
    history.forEach(function (h) {
      if (h.scene) {
        sceneCount[h.scene] = (sceneCount[h.scene] || 0) + 1;
      }
    });
    var topScene = '';
    var maxCount = 0;
    for (var s in sceneCount) {
      if (sceneCount.hasOwnProperty(s) && sceneCount[s] > maxCount) {
        maxCount = sceneCount[s];
        topScene = s;
      }
    }

    this.setData({
      stats: {
        weeklyCount: weekly.length,
        topScene: topScene || '--',
        totalStrategies: history.reduce(function (sum, h) {
          return sum + (h.strategyCount || 0);
        }, 0)
      }
    });
  },

  /* ========== 收藏夹 ========== */

  refreshSaved() {
    var saved = wx.getStorageSync('savedStrategies') || [];
    // 预览前2条
    var previews = saved.slice(0, 2).map(function (s) {
      return {
        id: s.id || Date.now(),
        title: s.title || '未命名策略',
        preview: (s.script || '').substring(0, 40) + '...'
      };
    });
    this.setData({ savedStrategies: previews });
  },

  /* ========== 每日一卡 ========== */

  refreshDailyTip() {
    var entries = knowledge.knowledgeEntries;
    if (entries.length === 0) return;

    // 选取一条随机tip
    var allTips = [];
    entries.forEach(function (e) {
      if (e.tips && e.tips.length > 0) {
        e.tips.forEach(function (t) {
          allTips.push(t);
        });
      }
    });

    if (allTips.length > 0) {
      var idx = Math.floor(Math.random() * allTips.length);
      this.setData({ dailyTip: allTips[idx] });
    }
  },

  /* ========== 导航 ========== */

  goEditProfile() {
    wx.navigateTo({ url: '/pages/profile/edit/edit' });
  },

  goHistory() {
    wx.showToast({ title: '历史记录功能开发中', icon: 'none' });
  },

  goSaved() {
    wx.showToast({ title: '收藏夹功能开发中', icon: 'none' });
  },

  goAbout() {
    wx.showModal({
      title: '人情世故顾问 V1.2',
      content: '为20-30岁年轻人提供定制化社交策略的AI助手。\n\n用魔法打败魔法。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
