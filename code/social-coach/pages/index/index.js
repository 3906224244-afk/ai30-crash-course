Page({
  data: {
    hasProfile: false
  },

  onLoad() {
    const profile = wx.getStorageSync('userProfile');
    if (profile) {
      this.setData({ hasProfile: true });
    }
  },

  goAdvice() {
    wx.navigateTo({ url: '/pages/advice/advice' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
