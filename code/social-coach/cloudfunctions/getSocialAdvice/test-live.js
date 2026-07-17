/**
 * 交互式测试 — 在终端里手写问题，走完整 Ask → Generate 流程
 * 用法: node test-live.js
 */

var { main } = require('./index.js');

var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var situation = '';
var answers = [];
var phase = 'ask';

function ask(question) {
  return new Promise(function(resolve) {
    rl.question(question, function(answer) {
      resolve(answer.trim());
    });
  });
}

async function run() {
  console.log('═════════════════════════════');
  console.log('  人情世故顾问 — 交互测试');
  console.log('═════════════════════════════\n');

  // Step 1: 输入场景
  situation = await ask('说说你遇到的社交困境：\n> ');

  // Step 2: 循环追问
  while (phase !== 'generate') {
    console.log('\n⏳ 分析中...\n');
    var result = await main({ situation: situation, answers: answers, phase: 'ask' });

    if (result.card && result.card.type === 'question') {
      // 显示问题
      if (result.card.questionType === 'choice') {
        console.log('📋 ' + result.card.text);
        result.card.options.forEach(function(o) {
          console.log('  ' + o.label + '. ' + o.text);
        });
        var choice = await ask('\n选哪个？(A/B/C/D 或直接打字): ');
        answers.push({ question: result.card.text, answer: choice });
      } else if (result.card.questionType === 'free') {
        console.log('📋 ' + result.card.text);
        if (result.card.directionHints && result.card.directionHints.length > 0) {
          console.log('  参考方向: ' + result.card.directionHints.join(', '));
        }
        var free = await ask('\n想说啥就说（直接回车跳过）: ');
        answers.push({ question: result.card.text, answer: free || '无补充' });
        phase = 'generate';
      }
    } else if (result.card && result.card.type === 'strategy_list') {
      // 已经进入 generate
      phase = 'generate';
    } else {
      phase = 'generate';
    }
  }

  // Step 3: 生成策略
  console.log('\n⏳ 生成策略中...\n');
  var genResult = await main({ situation: situation, answers: answers, phase: 'generate' });

  if (genResult.card && genResult.card.type === 'strategy_list') {
    console.log('═════════════════════════════');
    console.log('  ' + genResult.card.contextLabel);
    console.log('═════════════════════════════\n');
    console.log(genResult.fact + '\n');

    genResult.card.strategies.forEach(function(s, i) {
      console.log('─── ' + s.typeLabel + ' ───');
      console.log('💬 ' + s.script);
      console.log('⏱ ' + s.rhythm);
      console.log('⚠️ ' + s.risk);
      console.log('');
    });

    if (genResult.card.guideTip) {
      console.log(genResult.card.guideTip);
    }
  } else {
    console.log(JSON.stringify(genResult, null, 2));
  }

  rl.close();
}

run().catch(function(e) {
  console.error('出错了:', e);
  rl.close();
});
