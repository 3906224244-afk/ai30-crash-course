App({
  onLaunch() {
    // 初始化云开发（正式环境需要配置真实环境ID）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'social-coach-dev',
        traceUser: true
      });
    }

    // 加载本地存储的用户人设
    const profile = wx.getStorageSync('userProfile') || null;
    this.globalData.userProfile = profile;
  },

  globalData: {
    userProfile: null,
    // 用户人设结构:
    // {
    //   name: '',
    //   role: '',          // 职场新人/学生/管理者...
    //   personality: '',   // 性格特点
    //   goals: '',         // 社交目标
    //   relationships: []  // [{name, relation, notes}]
    // }
  }
});
