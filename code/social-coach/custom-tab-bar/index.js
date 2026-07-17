Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '/images/tab-home.svg' },
      { pagePath: '/pages/advice/advice', text: '咨询', icon: '/images/tab-advice.svg' },
      { pagePath: '/pages/etiquette/etiquette', text: '知识库', icon: '/images/tab-etiquette.svg' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '/images/tab-profile.svg' }
    ]
  },

  methods: {
    switchTab(e) {
      var index = e.currentTarget.dataset.index;
      var item = this.data.list[index];
      wx.switchTab({ url: item.pagePath });
    }
  }
});
