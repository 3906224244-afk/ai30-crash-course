/**
 * 知识加工Agent — 7步流水线
 *
 * 离线运行。读取一篇社交场景文章/案例，经过：
 *   Phase 1: 质量筛选           — 有没有实质洞察？
 *   Phase 2: 产出预估           — 大概出几条 Ask / Generate 规则？
 *   Phase 3A: 提取 Ask 规则     — 什么场景该追问什么维度
 *   Phase 3B: 提取 Generate 规则 — 什么处境本质是什么博弈，怎么回
 *   Phase 4: 去重与冲突         — 对照已有知识库
 *   Phase 5: 7维打分            — 全部输出到 pending-review.json
 *   Phase 6: 精简压缩           — 每条规则生成~250字 compact，入库时预压
 *
 * 用法: node process-knowledge.js <文章路径>
 */

const fs = require('fs');
const path = require('path');
const deepseek = require('../cloudfunctions/getSocialAdvice/deepseek.js');
const prompts = require('./prompts.js');
const { dedup } = require('./lib/dedup.js');
const { scoreRules } = require('./lib/evaluate.js');
const { loadKB, saveKB, saveConflicts, printKBSummary } = require('./lib/knowledge-store.js');
const { safeParseJSON } = require('../cloudfunctions/getSocialAdvice/index.js');

// ========== 加载种子知识库（金本位） ==========

const SEED_PATH = path.join(__dirname, 'knowledge-base', 'seed-rules.json');

function loadSeed() {
  if (!fs.existsSync(SEED_PATH)) {
    console.log('⚠️  seed-rules.json 不存在，各阶段将无例题参考。');
    return { examples: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
  } catch (e) {
    console.log('⚠️  seed-rules.json 解析失败:', e.message);
    return { examples: [] };
  }
}

// ========== 种子例题注入 ==========

/**
 * 从 seed-rules.json 中取 Phase 3A 例题，序列化为可读文本
 */
function formatAskExamples(seed) {
  var examples = (seed.examples || []).filter(function(e) { return e.ask; });
  if (examples.length === 0) return '（暂无 Ask 规则例题）';
  return examples.map(function(e, i) {
    return '### 例题 ' + (i + 1) + ': ' + (e.scenario || e.category + '/' + e.subcategory) + '\n' +
           JSON.stringify(e.ask, null, 2);
  }).join('\n\n');
}

/**
 * 从 seed-rules.json 中取 Phase 3B 例题
 */
function formatGenerateExamples(seed) {
  var examples = (seed.examples || []).filter(function(e) { return e.generate; });
  if (examples.length === 0) return '（暂无 Generate 规则例题）';
  return examples.map(function(e, i) {
    return '### 例题 ' + (i + 1) + ': ' + (e.scenario || e.category + '/' + e.subcategory) + '\n' +
           JSON.stringify(e.generate, null, 2);
  }).join('\n\n');
}

/**
 * 从 seed-rules.json 中取完整案例（Phase 2 预估用）
 */
function formatFullExamples(seed) {
  var examples = seed.examples || [];
  if (examples.length === 0) return '（暂无参考案例）';
  return examples.map(function(e, i) {
    return '### 案例 ' + (i + 1) + ': ' + (e.scenario || e.category + '/' + e.subcategory) + '\n' +
           '- 场景: ' + (e.category || '') + ' / ' + (e.subcategory || '') + '\n' +
           '- condition: ' + (e.condition || '') + '\n' +
           '- 这是 1 个独立社交场景（单场景深耕），产出了 1 条 Ask 规则 + 1 条 Generate 规则';
  }).join('\n\n');
}

/**
 * 从 seed-rules.json 中取 Phase 1 质量筛选例题
 */
function formatQualityBenchmarks(seed) {
  var benchmarks = seed.phase1_benchmarks;
  if (!benchmarks) return '（暂无质量筛选例题）';
  var parts = [];
  if (benchmarks.pass && benchmarks.pass.length > 0) {
    parts.push('## 通过示例');
    benchmarks.pass.forEach(function(p, i) {
      parts.push('### 通过' + (i + 1) + ': ' + p.reason + '\n' + p.excerpt);
    });
  }
  if (benchmarks.fail && benchmarks.fail.length > 0) {
    parts.push('## 不通过示例');
    benchmarks.fail.forEach(function(f, i) {
      parts.push('### 不通过' + (i + 1) + ': ' + f.reason + '\n' + f.excerpt);
    });
  }
  return parts.join('\n\n');
}

/**
 * 从 seed-rules.json 中取 Phase 4 去重对照例题
 */
function formatDedupBenchmarks(seed) {
  var benchmarks = seed.phase4_benchmarks;
  if (!benchmarks) return '（暂无去重对照例题）';
  return '## duplicate 示例\n' + JSON.stringify(benchmarks.duplicate, null, 2) + '\n\n' +
         '## supplement 示例\n' + JSON.stringify(benchmarks.supplement, null, 2) + '\n\n' +
         '## conflict 示例\n' + JSON.stringify(benchmarks.conflict, null, 2);
}

/**
 * 从 seed-rules.json 中取 Phase 5 打分例题
 */
function formatScoringBenchmarks(seed) {
  var benchmarks = seed.phase5_benchmarks;
  if (!benchmarks) return '（暂无打分例题）';
  var parts = [];
  ['competence', 'warmth', 'personalized', 'sycophancy', 'clarity', 'longTerm', 'traceable'].forEach(function(dim) {
    var b = benchmarks[dim];
    if (!b) return;
    parts.push('## ' + dim);
    parts.push('### 5分示例\n' + JSON.stringify(b.score5, null, 2));
    parts.push('### 1分示例\n' + JSON.stringify(b.score1, null, 2));
  });
  return parts.join('\n\n');
}

/**
 * 注入：把 prompt 模板里的 {{SEED_EXAMPLES}} 替换成种子例题
 */
function injectSeed(template, seedText) {
  return template.replace('{{SEED_EXAMPLES}}', seedText || '（暂无种子例题，请根据通用标准判断）');
}

// ========== Phase 1: 质量筛选 ==========

async function qualityScreen(article, seed) {
  console.log('[Phase 1] 质量筛选...');

  var seedText = formatQualityBenchmarks(seed);
  var systemPrompt = injectSeed(prompts.PHASE1_QUALITY_SCREEN, seedText);

  var userMsg = [
    '请判断以下文章是否有实质性的社交洞察：',
    '',
    '---文章内容（前3000字）---',
    article.substring(0, 3000)
  ].join('\n');

  try {
    var raw = await deepseek.chat(systemPrompt, userMsg, { maxTokens: 2048 });
    var result = safeParseJSON(raw);
    console.log('  判定:', result.pass ? '✅ 通过' : '❌ 跳过 —', result.reason);
    return result;
  } catch (e) {
    console.log('  Phase 1 调用失败:', e.message, '— 默认通过（待人工判断）');
    return { pass: true, reason: 'LLM调用失败，默认放行', summary: '' };
  }
}

// ========== Phase 2: 产出预估 ==========

async function estimateOutput(article, summary, seed) {
  console.log('[Phase 2] 产出预估...');

  var seedText = formatFullExamples(seed);
  var systemPrompt = injectSeed(prompts.PHASE2_ESTIMATION, seedText);

  var userMsg = [
    '请预估以下文章能产出多少 Ask / Generate 规则：',
    '',
    '文章摘要: ' + summary,
    '',
    '前500字: ' + article.substring(0, 500)
  ].join('\n');

  try {
    var raw = await deepseek.chat(systemPrompt, userMsg, { maxTokens: 2048 });
    var result = safeParseJSON(raw);
    console.log('  Ask 预估:', result.askEstimate, '条 | Generate 预估:', result.generateEstimate, '条');
    console.log('  依据:', result.reason);
    return result;
  } catch (e) {
    console.log('  Phase 2 调用失败:', e.message);
    return { askEstimate: 2, generateEstimate: 3, reason: '默认估计' };
  }
}

// ========== Phase 3A: 提取 Ask 规则 ==========

async function extractAskRules(article, estimate, seed) {
  console.log('[Phase 3A] 提取 Ask 规则（信息采集专家）...');

  var seedText = formatAskExamples(seed);
  var systemPrompt = injectSeed(prompts.PHASE3A_ASK_EXTRACT, seedText);

  // 事前：例题已注入，模型理解了格式
  var userMsg = [
    '请从以下文章中提取 Ask 规则——遇到什么场景要追问什么维度。',
    '',
    '---文章内容（前4000字）---',
    article.substring(0, 4000)
  ].join('\n');

  var rules = [];
  try {
    var raw = await deepseek.chat(systemPrompt, userMsg, { maxTokens: 4096 });
    var result = safeParseJSON(raw);
    rules = result.rules || [];
    console.log('  提取到', rules.length, '条 Ask 规则');
  } catch (e) {
    console.log('  Phase 3A 提取失败:', e.message);
    return [];
  }

  // 事后：校验格式是否对 seed 例题
  if (rules.length > 0 && seed.examples && seed.examples.some(function(e) { return e.ask; })) {
    var validated = await validateAskFormat(rules, seed);
    return validated;
  }

  return rules;
}

/**
 * 事后校验：对照种子例题，检查格式和内容深度
 */
async function validateAskFormat(rules, seed) {
  console.log('  校验 Ask 格式...');
  var seedText = formatAskExamples(seed);

  var checkPrompt = [
    '## 任务',
    '以下是刚提取的 Ask 规则。请对照种子例题的格式和内容深度，逐条检查：',
    '',
    '1. condition 是否足够具体（可判断的程度）？',
    '2. key_dimensions 每个维度是否都有 why_critical？',
    '3. suggested_questions 是否是追问方向而非答案？',
    '4. question_pitfalls 是否列出了追问雷区？',
    '',
    '## 种子例题（标准格式）',
    seedText,
    '',
    '## 提取的规则',
    JSON.stringify(rules, null, 2),
    '',
    '## 输出',
    '逐条给出：格式匹配 / 需要修改。如果某条规则格式有缺陷，在 fix 字段中给出修正后的版本。',
    '返回 JSON: { "reviews": [{ "ruleIndex": 0, "status": "ok|fix", "issue": "...", "fix": {...} }] }'
  ].join('\n');

  try {
    var raw = await deepseek.chat(checkPrompt, '请执行校验。', { maxTokens: 3072 });
    var review = safeParseJSON(raw);
    var reviews = review.reviews || [];

    var okCount = reviews.filter(function(r) { return r.status === 'ok'; }).length;
    var fixCount = reviews.filter(function(r) { return r.status === 'fix'; }).length;
    console.log('  校验结果:', okCount, '条通过,', fixCount, '条需修正');

    // 应用修正
    reviews.forEach(function(r) {
      if (r.status === 'fix' && r.fix && rules[r.ruleIndex]) {
        rules[r.ruleIndex] = r.fix;
      }
    });

    return rules;
  } catch (e) {
    console.log('  校验失败:', e.message, '— 保持原样');
    return rules;
  }
}

// ========== Phase 3B: 提取 Generate 规则 ==========

async function extractGenerateRules(article, estimate, seed) {
  console.log('[Phase 3B] 提取 Generate 规则（策略生成专家）...');

  var seedText = formatGenerateExamples(seed);
  var systemPrompt = injectSeed(prompts.PHASE3B_GENERATE_EXTRACT, seedText);

  var userMsg = [
    '请从以下文章中提取 Generate 规则——这个处境本质是什么博弈，可以走哪些策略路径。',
    '',
    '---文章内容（前4000字）---',
    article.substring(0, 4000)
  ].join('\n');

  var rules = [];
  try {
    var raw = await deepseek.chat(systemPrompt, userMsg, { maxTokens: 4096 });
    var result = safeParseJSON(raw);
    rules = result.rules || [];
    console.log('  提取到', rules.length, '条 Generate 规则');
  } catch (e) {
    console.log('  Phase 3B 提取失败:', e.message);
    return [];
  }

  // 事后校验
  if (rules.length > 0 && seed.examples && seed.examples.some(function(e) { return e.generate; })) {
    var validated = await validateGenerateFormat(rules, seed);
    return validated;
  }

  return rules;
}

/**
 * 事后校验：对照种子例题，检查 Generate 规则格式和内容深度
 */
async function validateGenerateFormat(rules, seed) {
  console.log('  校验 Generate 格式...');
  var seedText = formatGenerateExamples(seed);

  var checkPrompt = [
    '## 任务',
    '以下是刚提取的 Generate 规则。请对照种子例题的格式和内容深度，逐条检查：',
    '',
    '1. game_essence 是否点出了博弈的核心矛盾？',
    '2. strategies 是否是多角度（不同博弈姿态，非同一句话换说法）？',
    '3. 每条策略的 script 是否是可直接复制的话术？',
    '4. risk 是否诚实（翻车最可能翻在哪）？',
    '5. avoid 是否是真正的雷区？',
    '',
    '## 种子例题（标准格式）',
    seedText,
    '',
    '## 提取的规则',
    JSON.stringify(rules, null, 2),
    '',
    '## 输出',
    '逐条给出：格式匹配 / 需要修改。如果某条规则格式有缺陷，在 fix 字段中给出修正后的版本。',
    '返回 JSON: { "reviews": [{ "ruleIndex": 0, "status": "ok|fix", "issue": "...", "fix": {...} }] }'
  ].join('\n');

  try {
    var raw = await deepseek.chat(checkPrompt, '请执行校验。', { maxTokens: 3072 });
    var review = safeParseJSON(raw);
    var reviews = review.reviews || [];

    var okCount = reviews.filter(function(r) { return r.status === 'ok'; }).length;
    var fixCount = reviews.filter(function(r) { return r.status === 'fix'; }).length;
    console.log('  校验结果:', okCount, '条通过,', fixCount, '条需修正');

    reviews.forEach(function(r) {
      if (r.status === 'fix' && r.fix && rules[r.ruleIndex]) {
        rules[r.ruleIndex] = r.fix;
      }
    });

    return rules;
  } catch (e) {
    console.log('  校验失败:', e.message, '— 保持原样');
    return rules;
  }
}

// ========== 主入口 ==========

async function main() {
  var articlePath = process.argv[2];

  if (!articlePath) {
    console.log('用法: node process-knowledge.js <文章路径>');
    console.log('示例: node process-knowledge.js ./raw-articles/导师催论文.txt');
    process.exit(1);
  }

  if (!fs.existsSync(articlePath)) {
    console.log('❌ 文件不存在:', articlePath);
    process.exit(1);
  }

  // 加载种子库（金本位）
  var seed = loadSeed();
  console.log('已加载种子知识库:', (seed.examples || []).length, '个场景案例');

  var article = fs.readFileSync(articlePath, 'utf-8').trim();
  if (!article) {
    console.log('❌ 文件为空');
    process.exit(1);
  }

  console.log('========================================');
  console.log('  知识加工Agent — 7步流水线');
  console.log('========================================');
  console.log('文章路径:', articlePath);
  console.log('文章长度:', article.length, '字符\n');

  // Phase 1: 质量筛选
  var quality = await qualityScreen(article, seed);
  if (!quality.pass) {
    console.log('\n⏭️  文章质量不足，跳过。如你认为有价值，可人工提炼。');
    process.exit(0);
  }

  // Phase 2: 产出预估
  var estimate = await estimateOutput(article, quality.summary, seed);

  // Phase 3A: 提取 Ask 规则
  var askRules = await extractAskRules(article, estimate, seed);

  // Phase 3B: 提取 Generate 规则
  var generateRules = await extractGenerateRules(article, estimate, seed);

  var allRules = [...askRules, ...generateRules];
  if (allRules.length === 0) {
    console.log('\n⚠️  未提取到任何规则。');
    process.exit(0);
  }

  console.log('\n提取汇总: Ask ' + askRules.length + ' 条 + Generate ' + generateRules.length + ' 条 = ' + allRules.length + ' 条');

  // Phase 4: 去重与冲突
  console.log('\n[Phase 4] 去重与冲突检测...');

  var askKB = loadKB('ask');
  var genKB = loadKB('generate');

  var seedDedupText = formatDedupBenchmarks(seed);
  // 注入种子去重例题到 prompt
  var dedupPromptWithSeed = injectSeed(prompts.PHASE4_DEDUP, seedDedupText || '');

  var dedupAskResult = await dedupWithPrompt(askRules, askKB, deepseek, dedupPromptWithSeed);
  var dedupGenResult = await dedupWithPrompt(generateRules, genKB, deepseek, dedupPromptWithSeed);

  var allNew = [...(dedupAskResult.newRules || []), ...(dedupGenResult.newRules || [])];
  var allConflict = [...(dedupAskResult.conflicts || []), ...(dedupGenResult.conflicts || [])];
  var allDuplicate = [...(dedupAskResult.duplicates || []), ...(dedupGenResult.duplicates || [])];
  var allSupplement = [...(dedupAskResult.supplements || []), ...(dedupGenResult.supplements || [])];

  console.log('  新规则:', allNew.length, '条');
  console.log('  补充:', allSupplement.length, '条');
  console.log('  冲突:', allConflict.length, '条');
  console.log('  重复:', allDuplicate.length, '条（已跳过）');

  var rulesToScore = [...allNew, ...allSupplement];

  // Phase 5: 7维打分
  console.log('\n[Phase 5] 7维打分...');
  var seedScoreText = formatScoringBenchmarks(seed);
  var evalPrompt = injectSeed(prompts.PHASE5_EVALUATE, seedScoreText);

  // 临时覆盖 evaluate 模块使用的 prompt（通过闭包传入）
  var scorePromptWithSeed = evalPrompt;
  var scoredRules = await scoreRulesWithPrompt(rulesToScore, deepseek, scorePromptWithSeed);

  var autoPass = scoredRules.filter(function(r) { return r.totalScore >= 28; });
  var manualReview = scoredRules.filter(function(r) { return r.totalScore < 28; });

  console.log('  高分 (≥28):', autoPass.length, '条');
  console.log('  低分 (<28):', manualReview.length, '条');
  console.log('  ⚠️  当前模式：全部标记人工审核，不自动入库');

  // Phase 6: 精简压缩（入库时预压）
  console.log('\n[Phase 6] 精简压缩...');
  var compactPrompt = [
    '你是知识库编辑。把一条人情世故规则压缩为高密度摘要，保留所有对 LLM 决策关键的信息。',
    '',
    '要求：',
    '- 300字左右',
    '- 格式：用紧凑的自然语言，不用 JSON',
    '- 保留：场景分类、触发条件、核心洞察、策略方向/追问维度、关键雷区',
    '- 去掉：具体话术全文、冗余修辞、过渡语句'
  ].join('\n');

  for (var i = 0; i < scoredRules.length; i++) {
    var r = scoredRules[i];
    var label = (r.category || '?') + '/' + (r.subcategory || '?');
    process.stdout.write('  压缩 [' + (i + 1) + '/' + scoredRules.length + '] ' + label + ' ... ');

    try {
      var compactInput;
      if (r.key_dimensions) {
        // Ask 规则
        compactInput = [
          '场景: ' + (r.category || '') + ' / ' + (r.subcategory || ''),
          '触发条件: ' + (r.condition || ''),
          '核心洞察: ' + (r.implication || ''),
          '追问维度: ' + (r.key_dimensions || []).map(function(d) { return d.dimension; }).join('；'),
          '追问禁区: ' + (r.question_pitfalls || []).join('；'),
          '请生成精简摘要。'
        ].join('\n');
      } else {
        // Generate 规则
        compactInput = [
          '场景: ' + (r.category || '') + ' / ' + (r.subcategory || ''),
          '触发条件: ' + (r.condition || ''),
          '核心洞察: ' + (r.implication || ''),
          '博弈本质: ' + (r.game_essence || ''),
          '策略方向: ' + (r.strategies || []).map(function(s) { return s.angle; }).join('、'),
          '雷区: ' + (r.avoid || []).join('、'),
          '请生成精简摘要。'
        ].join('\n');
      }

      var compact = await deepseek.chat(compactPrompt, compactInput, { maxTokens: 4096, temperature: 0.3 });
      r.compact = compact;
      console.log('✅ ' + compact.length + '字');
    } catch (e) {
      console.log('❌ ' + e.message);
      // 降级：用 tactical_note 作为 compact
      r.compact = r.tactical_note || '';
    }
  }

  console.log('  压缩完成:', scoredRules.filter(function(r) { return r.compact && r.compact.length > 20; }).length + '/' + scoredRules.length + ' 条');

  // ========== 输出结果 ==========

  console.log('\n========================================');
  console.log('  处理完成 — 结果汇总（全部待人工确认）');
  console.log('========================================\n');

  if (autoPass.length > 0) {
    console.log('✅ 高分规则 (≥28分，建议入库):');
    autoPass.forEach(function(r, i) {
      console.log('  [' + (i + 1) + ']', (r.category || '?') + '/' + (r.subcategory || '?'),
        '| 总分:', r.totalScore, '| 类型:', r.ruleType || '?');
    });
    console.log('');
  }

  if (manualReview.length > 0) {
    console.log('⚠️  低分规则 (<28分，建议修改或丢弃):');
    manualReview.forEach(function(r, i) {
      console.log('  [' + (i + 1) + ']', (r.category || '?') + '/' + (r.subcategory || '?'),
        '| 总分:', r.totalScore);
    });
    console.log('');
  }

  if (allConflict.length > 0) {
    console.log('⚡ 冲突（需人工判决）: ' + allConflict.length + ' 条');
  }

  // 全部规则写入待审核文件
  var pendingPath = path.join(__dirname, 'knowledge-base', 'pending-review.json');
  var pendingData = {
    processedAt: new Date().toISOString(),
    sourceArticle: articlePath,
    estimates: estimate,
    allRules: scoredRules,
    conflicts: allConflict,
    duplicates: allDuplicate,
    summary: {
      askExtracted: askRules.length,
      generateExtracted: generateRules.length,
      totalAfterDedup: scoredRules.length,
      highScore: autoPass.length,
      lowScore: manualReview.length,
      conflict: allConflict.length,
      duplicate: allDuplicate.length
    }
  };

  fs.writeFileSync(pendingPath, JSON.stringify(pendingData, null, 2));
  console.log('📋 全部结果已写入: agent/knowledge-base/pending-review.json');
  console.log('   (' + scoredRules.length + '条规则待你确认后手动入库)');

  if (allConflict.length > 0) {
    saveConflicts(allConflict);
  }

  console.log('\n💡 审核后入库方式:');
  console.log('   1. 打开 pending-review.json');
  console.log('   2. 删除不想入库的规则');
  console.log('   3. Ask 规则 (E-Rule) → 复制到 ask-kb.json');
  console.log('   4. Generate 规则 (I/A-Rule) → 复制到 generate-kb.json');
  console.log('   5. 运行 node lib/build-embeddings.js 更新向量');
}

// ========== Wrapper: 带自定义 prompt 的去重 ==========

/**
 * 去重封装——使用带种子例题注入的 prompt 覆盖默认 PHASE4_DEDUP
 */
async function dedupWithPrompt(newRules, existingKB, deepseekInstance, seedInjectedPrompt) {
  var customPrompts = { PHASE4_DEDUP: seedInjectedPrompt };
  return await dedup(newRules, existingKB, deepseekInstance, customPrompts);
}

/**
 * 打分封装——使用带种子例题注入的 prompt
 */
async function scoreRulesWithPrompt(rules, deepseekInstance, seedInjectedPrompt) {
  var customPrompts = { PHASE5_EVALUATE: seedInjectedPrompt };
  return await scoreRules(rules, deepseekInstance, customPrompts);
}

main().catch(function(e) {
  console.error('Agent 运行失败:', e);
  process.exit(1);
});
