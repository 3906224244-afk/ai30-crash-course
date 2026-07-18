App({
  onLaunch() {
    // 初始化云开发（正式环境需要配置真实环境ID）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d0g6rvd87c8980c04',
        traceUser: true
      });
    }

    // 加载本地存储的用户人设
    var profile = wx.getStorageSync('userProfile') || null;
    this.globalData.userProfile = profile;
  },

  globalData: {
    userProfile: null
  },

  /** 根据当前时段返回人性化问候语 */
  getTimeGreeting: function () {
    var hour = new Date().getHours();
    if (hour < 6)  return { emoji: '🌙', title: '夜深了', sub: '这么晚还没睡，是有心事吧。跟我说说？' };
    if (hour < 12) return { emoji: '🌅', title: '早上好', sub: '新的一天。有什么想聊的？' };
    if (hour < 14) return { emoji: '☀️', title: '中午好', sub: '吃过饭了吗？随时可以找我聊聊。' };
    if (hour < 18) return { emoji: '🌤', title: '下午好', sub: '今天过得怎么样？有什么我能帮上忙的？' };
    if (hour < 22) return { emoji: '🌆', title: '晚上好', sub: '辛苦了。坐下来聊聊？' };
    return { emoji: '🌙', title: '夜深了', sub: '还没休息呀。有什么烦心的，说来听听。' };
  }
});


