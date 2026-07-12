const { knowledgeEntries } = require('../../utils/knowledge');

Page({
  data: {
    keyword: '',
    activeCategory: '全部',
    categories: ['全部', '随份子', '敬酒送礼', '职场', '恋爱', '家庭', '拒绝', '道歉'],
    entries: knowledgeEntries,
    filteredEntries: knowledgeEntries,
    showDetail: false,
    currentEntry: {}
  },

  onLoad() {
    this.filterEntries();
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.filterEntries();
  },

  switchCategory(e) {
    this.setData({ activeCategory: e.currentTarget.dataset.cat });
    this.filterEntries();
  },

  filterEntries() {
    let entries = this.data.entries;
    const cat = this.data.activeCategory;
    const kw = this.data.keyword.trim().toLowerCase();

    if (cat !== '全部') {
      entries = entries.filter(e => e.tags.includes(cat));
    }

    if (kw) {
      entries = entries.filter(e =>
        e.title.toLowerCase().includes(kw) ||
        e.brief.toLowerCase().includes(kw) ||
        e.content.toLowerCase().includes(kw)
      );
    }

    this.setData({ filteredEntries: entries });
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    const entry = this.data.entries.find(e => e.id === id);
    if (entry) {
      this.setData({ showDetail: true, currentEntry: entry });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, currentEntry: {} });
  }
});
