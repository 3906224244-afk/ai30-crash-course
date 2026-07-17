/**
 * A/B 对比：deepseek-v4-pro vs deepseek-chat 策略质量
 *
 * 用法: node test-ab-compare.js
 */

var deepseek = require('./deepseek.js');
var prompts = require('./prompts.js');
var rag = require('./rag.js');

var SITUATION = '领导微信问我周末有空吗，我不想去但又怕得罪他';
var ANSWERS = [
  { question: '关系', answer: '他是我的直属领导，平时对我还行，控制欲不强' },
  { question: '目标', answer: '委婉拒绝，不能让他觉得我不积极' },
  { question: '个性', answer: '他比较务实，不太记仇，但不喜欢被敷衍' },
  { question: '底线', answer: '不能撕破脸，之后还要在他手下干活。周末是真的有安排' }
];

async function testModel(modelName, label) {
  console.log('\n═══════════════════════════════════════');
  console.log('🔬 测试: ' + label + ' (' + modelName + ')');
  console.log('═══════════════════════════════════════');

  // 1. RAG 检索（跟正式流程一样）
  var searchQuery = SITUATION + ' ' + ANSWERS.map(function(a) { return a.answer; }).join(' ');
  var genRules = await rag.searchKnowledge(searchQuery, 'generate', 5);
  console.log('RAG 检索: ' + genRules.length + ' 条规则');

  // 2. 拼装 knowledge context（用 compact）
  var knowledgeContext = '## 策略生成规则\n';
  genRules.forEach(function(r, i) {
    knowledgeContext += (i + 1) + '. ' + (r.compact || r.tactical_note) + '\n';
  });
  knowledgeContext += '\n';

  // 3. 拼装 user message
  var userMsg = knowledgeContext;
  userMsg += '用户描述了以下社交困境：\n"' + SITUATION + '"\n\n';
  userMsg += '收集到的完整信息：\n';
  ANSWERS.forEach(function(a, i) {
    userMsg += (i + 1) + '. ' + a.question + ' → ' + a.answer + '\n';
  });
  userMsg += '\n请基于以上信息生成3-5条不同角度的回复策略，返回 JSON。';

  console.log('Prompt 大小: ' + userMsg.length + ' 字');

  // 4. 调用 LLM（切换模型）
  var startTime = Date.now();
  var backupModel = deepseek.MODEL;
  deepseek.MODEL = modelName;

  try {
    var raw = await deepseek.chat(prompts.GENERATE_PROMPT, userMsg, { maxTokens: 8192 });
    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    deepseek.MODEL = backupModel;

    // 5. 解析
    var raw_no_markers = raw.replace(/```json|```/g, '').trim();
    var result;
    try {
      result = JSON.parse(raw_no_markers);
    } catch(e) {
      var m = raw_no_markers.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
    }

    if (!result || !result.strategies) {
      console.log('❌ 解析失败');
      console.log('原始输出(前500字):', raw.substring(0, 500));
      return { model: modelName, elapsed: elapsed, strategies: [], raw: raw };
    }

    console.log('✅ 耗时: ' + elapsed + '秒 | 策略数: ' + result.strategies.length);
    console.log('场景分析: ' + (result.analysis || result.contextLabel || '').substring(0, 120));
    console.log('');

    return { model: modelName, elapsed: elapsed, strategies: result.strategies, analysis: result.analysis || result.contextLabel };

  } catch (e) {
    deepseek.MODEL = backupModel;
    console.log('❌ 调用失败: ' + e.message);
    return { model: modelName, elapsed: '失败', strategies: [] };
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  A/B 对比: 推理模型 vs 标准模型');
  console.log('═══════════════════════════════════════');

  // 先跑标准模型（快）
  var resultA = await testModel('deepseek-chat', 'A: 标准模型');

  // 再跑推理模型（慢）
  var resultB = await testModel('deepseek-v4-pro', 'B: 推理模型');

  // ===== 对比 =====
  console.log('\n═══════════════════════════════════════');
  console.log('  📊 对比结果');
  console.log('═══════════════════════════════════════\n');

  console.log('| 维度 | A: 标准模型 | B: 推理模型 |');
  console.log('|------|------------|------------|');
  console.log('| 耗时 | ' + resultA.elapsed + 's | ' + resultB.elapsed + 's |');
  console.log('| 策略数 | ' + resultA.strategies.length + ' | ' + resultB.strategies.length + ' |');

  // 策略对比
  var maxLen = Math.max(resultA.strategies.length, resultB.strategies.length);
  for (var i = 0; i < maxLen; i++) {
    var sa = resultA.strategies[i];
    var sb = resultB.strategies[i];
    console.log('');
    console.log('─── 策略' + (i + 1) + ' ───');
    if (sa) console.log('A 角度: ' + (sa.angle || '?'));
    if (sb) console.log('B 角度: ' + (sb.angle || '?'));
    if (sa) console.log('A 话术: ' + (sa.script || '').substring(0, 120));
    if (sb) console.log('B 话术: ' + (sb.script || '').substring(0, 120));
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ A/B 对比完成');
  console.log('═══════════════════════════════════════');
}

main().catch(function(e) { console.error(e); });
