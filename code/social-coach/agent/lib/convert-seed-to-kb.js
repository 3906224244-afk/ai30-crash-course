/**
 * 种子知识库 → Ask KB + Generate KB 转换脚本
 *
 * 读取 seed-rules.json 的 11 个金标案例，按 KB 入库格式拆分为：
 *   - ask-kb.json      （追问维度规则）
 *   - generate-kb.json  （策略生成规则）
 *
 * 格式遵循 PRD 第405行定义：condition → implication → tactical_note → avoid
 *
 * 用法: node lib/convert-seed-to-kb.js
 */

var fs = require('fs');
var path = require('path');

var SEED_PATH = path.join(__dirname, '..', 'knowledge-base', 'seed-rules.json');
var ASK_KB_PATH = path.join(__dirname, '..', 'knowledge-base', 'ask-kb.json');
var GEN_KB_PATH = path.join(__dirname, '..', 'knowledge-base', 'generate-kb.json');

// ========== tactical_note 生成逻辑 ==========

/**
 * 为 Ask 规则合成 tactical_note
 * 从 key_dimensions 提取追问要点，生成一句关键词密集的行动指引
 */
function synthesizeAskTactical(scenario, ask) {
  var dims = (ask.key_dimensions || []).map(function(d) {
    // 取维度名的核心部分（去掉问号，截取前30字作为标签）
    var label = (d.dimension || '').replace(/[？?]/g, '').trim();
    // 如果太长，在逗号或"还是"处截断
    if (label.length > 30) {
      var breakPoint = label.indexOf('，');
      if (breakPoint > 5 && breakPoint < 30) label = label.substring(0, breakPoint);
      else label = label.substring(0, 30) + '…';
    }
    return label;
  });

  if (dims.length === 0) return '根据场景追问关键信息维度';

  var parts = [];
  if (dims.length >= 2) {
    parts.push('先追问：' + dims.slice(0, 2).join('、'));
  } else {
    parts.push('追问：' + dims[0]);
  }
  if (dims.length > 2) {
    parts.push('再判断：' + dims.slice(2).join('、'));
  }

  // 追加 pitfall 关键词
  var pitfalls = (ask.question_pitfalls || []);
  if (pitfalls.length > 0) {
    var pfKeywords = pitfalls.map(function(p) {
      // 提取"不要X"后面的核心意思，去掉"不要"和引号
      var cleaned = p.replace(/不要问?['']?/g, '').replace(/['']/g, '').trim();
      if (cleaned.length > 25) cleaned = cleaned.substring(0, 25) + '…';
      return cleaned;
    }).filter(Boolean).slice(0, 2);
    if (pfKeywords.length > 0) {
      parts.push('避坑：' + pfKeywords.join('；'));
    }
  }

  return parts.join('。');
}

/**
 * 为 Generate 规则合成 tactical_note
 * 从 strategies + avoid 提取策略路径，生成一句博弈姿态指引
 */
function synthesizeGenerateTactical(scenario, generate) {
  var strategies = generate.strategies || [];
  var angles = strategies.map(function(s) {
    var angle = s.angle || '';
    // 取策略角度名的核心词（冒号前、括号前，截取25字）
    var colonIdx = angle.indexOf('——');
    if (colonIdx !== -1) angle = angle.substring(0, colonIdx);
    colonIdx = angle.indexOf('（');
    if (colonIdx !== -1) angle = angle.substring(0, colonIdx);
    return angle.trim().substring(0, 25);
  });

  if (angles.length === 0) return '基于博弈本质选择策略路径';

  var parts = ['策略路径：' + angles.join('、')];

  var avoids = generate.avoid || [];
  if (avoids.length > 0) {
    var avoidKeywords = avoids.map(function(a) {
      // 取雷区的前25字（通常是"不要X——原因"结构，取核心动作）
      var cleaned = a.replace(/['']/g, '').trim();
      // 如果有破折号，取前面部分（核心动作）
      var dashIdx = cleaned.indexOf('——');
      if (dashIdx > 3) cleaned = cleaned.substring(0, dashIdx);
      if (cleaned.length > 30) cleaned = cleaned.substring(0, 30) + '…';
      return cleaned;
    }).filter(Boolean).slice(0, 3);
    if (avoidKeywords.length > 0) {
      parts.push('雷区：' + avoidKeywords.join('；'));
    }
  }

  return parts.join('。');
}

// ========== 主逻辑 ==========

function convert() {
  console.log('========================================');
  console.log('  种子知识库 → KB 格式转换');
  console.log('========================================\n');

  // 1. 读取种子库
  if (!fs.existsSync(SEED_PATH)) {
    console.log('❌ seed-rules.json 不存在');
    process.exit(1);
  }

  var seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  var examples = seed.examples || [];

  if (examples.length === 0) {
    console.log('❌ seed-rules.json 中无 examples');
    process.exit(1);
  }

  console.log('读取到 ' + examples.length + ' 个种子案例\n');

  // 2. 转换
  var askEntries = [];
  var genEntries = [];
  var stats = { ask: { fields: {} }, generate: { fields: {} } };

  examples.forEach(function(ex, i) {
    var scenario = ex.scenario || ('案例' + (i + 1));
    console.log('[' + (i + 1) + '/' + examples.length + '] ' + scenario);

    // --- Ask 规则 ---
    if (ex.ask && ex.ask.key_dimensions && ex.ask.key_dimensions.length > 0) {
      var askEntry = {
        category: ex.category || '',
        subcategory: ex.subcategory || '',
        condition: ex.condition || '',
        implication: ex.scene_essence || '',
        tactical_note: synthesizeAskTactical(scenario, ex.ask),
        key_dimensions: ex.ask.key_dimensions.map(function(d) {
          return {
            dimension: d.dimension || '',
            why_critical: d.why_critical || ''
          };
        }),
        suggested_questions: ex.ask.suggested_questions || [],
        question_pitfalls: ex.ask.question_pitfalls || []
      };

      // 验证必填字段
      var missingAsk = [];
      if (!askEntry.category) missingAsk.push('category');
      if (!askEntry.condition) missingAsk.push('condition');
      if (!askEntry.implication) missingAsk.push('implication');
      if (!askEntry.tactical_note) missingAsk.push('tactical_note');
      if (missingAsk.length > 0) {
        console.log('  ⚠️  Ask 缺少字段: ' + missingAsk.join(', '));
      } else {
        console.log('  ✅ Ask: ' + askEntry.key_dimensions.length + '个维度, ' + askEntry.suggested_questions.length + '个追问, ' + askEntry.question_pitfalls.length + '个禁区');
      }

      askEntries.push(askEntry);
    } else {
      console.log('  ⏭️  Ask: 无有效 key_dimensions，跳过');
    }

    // --- Generate 规则 ---
    if (ex.generate && ex.generate.strategies && ex.generate.strategies.length > 0) {
      var genEntry = {
        category: ex.category || '',
        subcategory: ex.subcategory || '',
        condition: ex.condition || '',
        implication: ex.scene_essence || '',
        tactical_note: synthesizeGenerateTactical(scenario, ex.generate),
        game_essence: ex.generate.game_essence || '',
        strategies: ex.generate.strategies.map(function(s) {
          return {
            angle: s.angle || '',
            script: s.script || '',
            rhythm: s.rhythm || '',
            risk: s.risk || ''
          };
        }),
        avoid: ex.generate.avoid || []
      };

      var missingGen = [];
      if (!genEntry.category) missingGen.push('category');
      if (!genEntry.condition) missingGen.push('condition');
      if (!genEntry.implication) missingGen.push('implication');
      if (!genEntry.tactical_note) missingGen.push('tactical_note');
      if (!genEntry.game_essence) missingGen.push('game_essence');
      if (missingGen.length > 0) {
        console.log('  ⚠️  Generate 缺少字段: ' + missingGen.join(', '));
      } else {
        console.log('  ✅ Generate: ' + genEntry.strategies.length + '条策略, ' + genEntry.avoid.length + '个禁区');
      }

      genEntries.push(genEntry);
    } else {
      console.log('  ⏭️  Generate: 无有效 strategies，跳过');
    }

    console.log('');
  });

  // 3. 写入文件
  console.log('----------------------------------------');
  console.log('写入文件...');

  fs.writeFileSync(ASK_KB_PATH, JSON.stringify(askEntries, null, 2));
  console.log('✅ ask-kb.json: ' + askEntries.length + ' 条规则 (' + Buffer.byteLength(JSON.stringify(askEntries)) + ' bytes)');

  fs.writeFileSync(GEN_KB_PATH, JSON.stringify(genEntries, null, 2));
  console.log('✅ generate-kb.json: ' + genEntries.length + ' 条规则 (' + Buffer.byteLength(JSON.stringify(genEntries)) + ' bytes)');

  // 4. 统计
  console.log('\n========================================');
  console.log('  转换完成');
  console.log('========================================');
  console.log('Ask KB:     ' + askEntries.length + ' 条');
  console.log('Generate KB: ' + genEntries.length + ' 条');
  console.log('');

  // 检查每个条目的字段完整性
  var askFields = ['category', 'subcategory', 'condition', 'implication', 'tactical_note', 'key_dimensions', 'suggested_questions', 'question_pitfalls'];
  var genFields = ['category', 'subcategory', 'condition', 'implication', 'tactical_note', 'game_essence', 'strategies', 'avoid'];

  console.log('字段完整性检查:');
  askEntries.forEach(function(e, i) {
    askFields.forEach(function(f) {
      var val = e[f];
      var isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        console.log('  ⚠️  ask[' + i + '].' + f + ' 为空');
      }
    });
  });

  genEntries.forEach(function(e, i) {
    genFields.forEach(function(f) {
      var val = e[f];
      var isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
      if (isEmpty) {
        console.log('  ⚠️  generate[' + i + '].' + f + ' 为空');
      }
    });
  });

  console.log('\n💡 下一步: node lib/build-embeddings.js 生成向量');
}

try {
  convert();
} catch(e) {
  console.error('转换失败:', e);
  process.exit(1);
}
