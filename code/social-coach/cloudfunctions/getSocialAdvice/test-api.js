/**
 * 快速测试脚本 — 你自己换场景跑
 *
 * 用法：修改 myScene 为你想测的场景，然后：
 *   cd ~/ai30/code/social-coach/cloudfunctions/getSocialAdvice
 *   node test-api.js
 */
var d = require('./deepseek.js');
var p = require('./prompts.js');

var myScene = '领导微信问我周末有空吗，我不想去但又怕得罪他';

console.log('=== 测试 Ask Phase ===');
console.log('场景: ' + myScene);
console.log('思考中...\n');

var userMsg = '用户描述："' + myScene + '"\n\n尚未收集任何信息。\n\n请判断信息是否充足，返回 JSON。';

d.chat(p.ASK_PROMPT, userMsg, { maxTokens: 4096 })
  .then(function (r) { console.log(r); })
  .catch(function (e) { console.log('失败: ' + e.message); });
