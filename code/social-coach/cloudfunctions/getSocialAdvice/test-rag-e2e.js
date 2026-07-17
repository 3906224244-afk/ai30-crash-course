/**
 * 全链路集成测试：RAG检索 + LLM追问 + LLM策略生成
 *
 * 直接调用 index.js 的 main 函数，走完整流程：
 *   split → ask（第1轮自由叙述 → 后续选择题追问）→ generate
 *
 * 用法: node test-rag-e2e.js
 */

var { main } = require('./index.js');
var { clearCache } = require('./rag.js');

// ========== 测试场景（你来改） ==========
var SCENE = '领导微信问我周末有空吗，我不想去但又怕得罪他';

// 第1轮自由叙述回答
var FREE_NARRATIVE = '他是我的直属领导，最近部门在赶一个大项目，大老板盯得紧。这周末他让我们几个加班，说是给大领导看进度。但周末我真的有事——一个老朋友从国外回来，约好的。我不想因为一次加班就推掉这次见面。可又怕直接拒绝领导会觉得我不积极、不听话。之前我还没拒绝过他，这是第一次，心里没底。他这个人比较严肃，公事公办那种，平时对我还算认可，但不喜欢下属讲条件。我查了下项目进度其实这周末不加班也来得及，但他就是想提前做出点东西给大领导看。';

// 模拟用户对追问的回答
function simulateAnswer(question) {
  if (question.text.indexOf('关系') !== -1 || question.text.indexOf('什么关系') !== -1) {
    return '他是我的直属领导，平时对我还行，但这次加班纯粹是为了给大领导看';
  }
  if (question.text.indexOf('效果') !== -1 || question.text.indexOf('目标') !== -1) {
    return '我想委婉拒绝，但不能让他觉得我不积极、不听话';
  }
  if (question.text.indexOf('性格') !== -1 || question.text.indexOf('什么样的人') !== -1) {
    return '他比较严肃，公事公办那种，不喜欢下属讲条件';
  }
  if (question.text.indexOf('底线') !== -1 || question.text.indexOf('不能') !== -1) {
    return '不能撕破脸，之后还要在他手下干活';
  }
  if (question.text.indexOf('历史') !== -1 || question.text.indexOf('之前') !== -1) {
    return '以前没拒绝过他，这是第一次';
  }
  // 默认回答
  return '他最近压力也大，我不想给他添麻烦，但周末我真的有事';
}
// =========================================

function logCard(card) {
  if (!card) return;
  if (card.type === 'split') {
    console.log('  📋 分流卡片:', card.title);
    card.options.forEach(function(o) {
      console.log('     ' + o.label + ': ' + o.desc);
    });
  } else if (card.type === 'question') {
    console.log('  ❓ 追问 [第' + card.questionIndex + '/' + card.totalQuestions + '题] [' + card.questionType + ']:');
    console.log('     ' + card.text);
    if (card.options) {
      card.options.forEach(function(o) {
        console.log('       ' + o.label + ': ' + o.text.substring(0, 60));
      });
    }
    if (card.directionHints) {
      console.log('     参考方向: ' + card.directionHints.join(', '));
    }
  } else if (card.type === 'strategy_list') {
    console.log('  🎯 策略列表 [' + card.contextLabel + ']:');
    if (card.strategies) {
      card.strategies.forEach(function(s, i) {
        console.log('');
        console.log('    策略' + (i + 1) + ': ' + (s.typeLabel || s.angle || '?'));
        console.log('    💬 ' + (s.script || ''));
        console.log('    ⏱ ' + (s.rhythm || ''));
        console.log('    ⚠️ ' + (s.risk || ''));
      });
    }
  } else {
    console.log('  📄 卡片:', JSON.stringify(card).substring(0, 300));
  }
}

async function run() {
  console.log('═══════════════════════════════════════');
  console.log('🧪 全链路集成测试：RAG + LLM');
  console.log('═══════════════════════════════════════\n');

  clearCache();

  // ===== Phase 1: Split =====
  console.log('─── Phase 1: Split ───');
  var r1 = await main({ situation: '', answers: [], phase: 'auto', profile: {} });
  console.log('fact: ' + r1.fact);
  logCard(r1.card);

  // ===== Phase 2: Ask (第1轮 — 自由叙述) =====
  console.log('\n─── Phase 2: Ask (第1轮 — 自由叙述) ───');
  var r2 = await main({ situation: SCENE, answers: [], phase: 'ask', profile: {} });
  console.log('fact: ' + r2.fact);
  logCard(r2.card);

  var answers = [];
  var rounds = 0;

  // 第1轮固定是自由叙述
  if (r2.card && r2.card.type === 'question' && r2.card.questionType === 'free') {
    answers.push({ question: r2.card.text, answer: FREE_NARRATIVE });
    console.log('\n  👤 用户自由叙述: ' + FREE_NARRATIVE.substring(0, 100) + '...');

    // ----- 后续轮次：选择题追问 -----
    while (rounds < 4) {
      rounds++;
      r2 = await main({ situation: SCENE, answers: answers, phase: 'ask', profile: {} });

      if (r2.card && r2.card.type === 'strategy_list') {
        // LLM 判断信息已充足，直接跳到 Generate
        break;
      }

      console.log('\n─── Phase 2: Ask (第' + (rounds + 1) + '轮 — 选择题) ───');
      console.log('fact: ' + r2.fact);
      logCard(r2.card);

      if (!r2.card || r2.card.type !== 'question' || r2.card.questionType !== 'choice') break;

      var q = r2.card;
      var ans = simulateAnswer(q);
      answers.push({ question: q.text, answer: ans });
      console.log('\n  👤 用户选择: ' + ans.substring(0, 80) + '...');
    }
  }

  // ===== Phase 3: Generate =====
  if (r2.card && r2.card.type === 'strategy_list') {
    // generate 已经在 ask 阶段被触发
    console.log('\n✅ 策略已在 Ask 阶段自动触发');
  } else {
    console.log('\n─── Phase 3: Generate ───');
    var r3 = await main({ situation: SCENE, answers: answers, phase: 'generate', profile: {} });
    console.log('fact: ' + r3.fact);
    logCard(r3.card);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ 全链路测试完成 (' + answers.length + ' 轮追问)');
  console.log('═══════════════════════════════════════');
}

run().catch(function(e) {
  console.log('❌ 测试失败:', e.message);
  console.log(e.stack);
});
