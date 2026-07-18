/**
 * social-coach SKILL — 注册原子接口
 */
var getSocialAdvice = require('./apis/getSocialAdvice');

var skill = wx.modelContext.createSkill('/skill/social-coach');
skill.registerAPI('getSocialAdvice', getSocialAdvice);

module.exports = skill;
