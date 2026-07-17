/**
 * 端到端测试：完整对话链
 *
 * 模拟用户从描述场景 → 追问 → 回答 → 出策略的全流程
 *
 * 用法：
 *   cd ~/ai30/code/social-coach/cloudfunctions/getSocialAdvice
 *   node test-e2e.js
 *
 * 修改 myScene 和 simulateAnswer 来测不同场景
 */

var deepseek = require('./deepseek.js');
var prompts = require('./prompts.js');

// ========== 你来改这俩 ==========
var myScene = '领导微信问我周末有空吗，我不想去但又怕得罪他';

// 模拟用户回答：第1题选A，第2题选B，第3题选C，自由题随便写
function simulateAnswer(question, questionIndex) {
  if (question.type === 'free') {
    return '他平时对我不错，但这次加班完全没意义，纯粹是为了给大领导看。我上个月加班很多，这周末本来打算休息。';
  }
  // 选择题：自动选第一个选项（A）
  return question.options[0].text;
}
// =================================

function buildAskUserMsg(situation, history) {
  var parts = ['用户描述了以下社交困境：', '"' + situation + '"', ''];
  if (history.length > 0) {
    parts.push('目前已收集的信息：');
    history.forEach(function (h, i) {
      parts.push((i + 1) + '. ' + h.question + ' → ' + h.answer);
    });
  } else {
    parts.push('尚未收集任何信息。');
  }
  parts.push('');
  parts.push('请判断信息是否充足，返回 JSON。');
  return parts.join('\n');
}

function buildGenerateMsg(situation, history) {
  var parts = ['用户描述了以下社交困境：', '"' + situation + '"', '', '收集到的完整信息：'];
  history.forEach(function (h, i) {
    parts.push((i + 1) + '. ' + h.question + ' → ' + h.answer);
  });
  parts.push('');
  parts.push('请基于以上信息生成3-5条不同角度的回复策略，返回 JSON。');
  return parts.join('\n');
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch (e) {}
  var m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

async function run() {
  console.log('═══════════════════════════════════');
  console.log('🧪 端到端测试：完整对话链');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log('📝 用户场景: ' + myScene);
  console.log('');

  var history = [];
  var round = 0;

  // ===== Phase 1: Ask 循环 =====
  console.log('─── Ask Phase ───');
  console.log('');

  while (true) {
    round++;
    console.log('第' + round + '轮：调用 DeepSeek...');
    var msg = buildAskUserMsg(myScene, history);
    var raw;
    try {
      raw = await deepseek.chat(prompts.ASK_PROMPT, msg, { maxTokens: 4096 });
    } catch (e) {
      console.log('❌ API 失败: ' + e.message);
      return;
    }

    var result = safeParse(raw);
    if (!result) {
      console.log('❌ JSON 解析失败');
      console.log('返回内容: ' + raw.substring(0, 300));
      return;
    }

    if (!result.needMoreInfo) {
      console.log('✅ 信息充足，跳过追问！');
      break;
    }

    // 取当前该答的题（按 history.length 定位）
    var qIndex = history.length;
    var question = result.questions[qIndex];

    if (!question || qIndex >= result.questions.length) {
      console.log('✅ 所有问题已答完');
      break;
    }

    var answer = simulateAnswer(question, qIndex);
    history.push({ question: question.text, answer: answer });

    console.log('   Q' + (qIndex + 1) + ' [' + question.type + ']: ' + question.text.substring(0, 60) + '...');
    if (question.type === 'choice') {
      console.log('    选项: ' + question.options.map(function (o) { return o.label; }).join(' / '));
    }
    console.log('   👤 模拟回答: ' + answer.substring(0, 60) + '...');
    console.log('');

    if (history.length >= 4) break; // 安全上限
  }

  // ===== Phase 2: Generate =====
  console.log('');
  console.log('─── Generate Phase ───');
  console.log('调用 DeepSeek 生成策略...');
  console.log('');

  var genMsg = buildGenerateMsg(myScene, history);
  var genRaw;
  try {
    genRaw = await deepseek.chat(prompts.GENERATE_PROMPT, genMsg, { maxTokens: 4096 });
  } catch (e) {
    console.log('❌ API 失败: ' + e.message);
    return;
  }

  var genResult = safeParse(genRaw);
  if (!genResult) {
    console.log('❌ JSON 解析失败');
    console.log('返回: ' + genRaw.substring(0, 300));
    return;
  }

  console.log('📊 场景: ' + genResult.contextLabel);
  console.log('📋 分析: ' + genResult.analysis);
  console.log('');
  console.log('📌 共 ' + genResult.strategies.length + ' 条策略：');
  console.log('');

  genResult.strategies.forEach(function (s, i) {
    console.log('  策略' + (i + 1) + ': ' + s.angle);
    console.log('    💬 ' + s.script.substring(0, 80) + '...');
    console.log('    ⏱  ' + (s.rhythm || '').substring(0, 50));
    console.log('    🔮 ' + (s.counterPrediction || '').substring(0, 60));
    console.log('    ⚠️  ' + (s.risk || '').substring(0, 60));
    console.log('');
  });

  console.log('═══════════════════════════════════');
  console.log('✅ 端到端测试完成');
  console.log('═══════════════════════════════════');
}

run().catch(function (e) { console.log('❌ 异常: ' + e.message); });
