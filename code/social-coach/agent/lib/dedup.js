/**
 * 去重与冲突检测模块
 *
 * 将新规则与已有知识库逐条对比，判定关系：
 *   duplicate | conflict | supplement | new
 */

var { safeParseJSON } = require('../../cloudfunctions/getSocialAdvice/index.js');
var fs = require('fs');
var path = require('path');
var zhipu = require('../../cloudfunctions/getSocialAdvice/zhipu-embedding.js');

var KB_DIR = path.join(__dirname, '..', 'knowledge-base');
var SIM_THRESHOLD = 0.5;  // 低于此相似度不视为候选
var TOP_K = 3;            // 最多送 K 条候选给 LLM 精判

function cosineSim(a, b) {
  var dot = 0, na = 0, nb = 0;
  for (var i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 与 build-embeddings.js 保持一致的 embedding 输入拼接
 */
function embeddingText(r) {
  return (r.category || '') + ' ' + (r.subcategory || '') + ' ' +
         (r.condition || '') + ' ' + (r.compact || r.implication || '');
}

/**
 * 向量粗筛：新规则 embedding vs 知识库预计算 embedding，取相似度 top-K 作候选
 * （原实现为 category+subcategory 字符串精确匹配——提取Agent每次自由命名，
 *   永远匹配不上，导致 LLM 精判从未被触发）
 */
async function vectorCoarseFilter(rule, existingKB) {
  var isAsk = !!rule.suggested_questions;
  var embPath = path.join(KB_DIR, (isAsk ? 'ask' : 'generate') + '-embeddings.json');

  var kbEmbeddings;
  try {
    kbEmbeddings = JSON.parse(fs.readFileSync(embPath, 'utf-8'));
  } catch (e) {
    console.log('    ⚠️ 读取预计算向量失败，降级为无候选:', e.message);
    return [];
  }
  if (kbEmbeddings.length !== existingKB.length) {
    console.log('    ⚠️ 向量数(' + kbEmbeddings.length + ')与规则数(' + existingKB.length + ')不匹配，降级为无候选（请先跑 build-embeddings.js）');
    return [];
  }

  var queryVec = await zhipu.embed(embeddingText(rule));

  var scored = existingKB.map(function (r, idx) {
    return { rule: r, sim: cosineSim(queryVec, kbEmbeddings[idx]) };
  }).sort(function (a, b) { return b.sim - a.sim; });

  var top = scored.slice(0, TOP_K).filter(function (s) { return s.sim >= SIM_THRESHOLD; });
  console.log('    粗筛相似度: ' + scored.slice(0, TOP_K).map(function (s) {
    return s.rule.subcategory + '=' + s.sim.toFixed(3);
  }).join(' | '));

  return top.map(function (s) { return s.rule; });
}

/**
 * @param {Array} newRules       - 新提取的规则数组
 * @param {Array} existingKB     - 已有知识库的规则数组
 * @param {object} deepseek      - LLM调用模块
 * @param {object} prompts       - prompt集
 * @returns {object} { newRules, conflicts, duplicates, supplements }
 */
async function dedup(newRules, existingKB, deepseek, prompts) {
  if (newRules.length === 0) {
    return { newRules: [], conflicts: [], duplicates: [], supplements: [] };
  }

  var result = {
    newRules: [],
    conflicts: [],
    duplicates: [],
    supplements: []
  };

  for (var i = 0; i < newRules.length; i++) {
    var rule = newRules[i];

    // 如果知识库为空，全部算新规则
    if (existingKB.length === 0) {
      console.log('  [' + (i + 1) + '] 知识库为空，直接入库');
      result.newRules.push(rule);
      continue;
    }

    // 粗筛：向量相似度取 top-K 相近规则作为候选
    var candidates = await vectorCoarseFilter(rule, existingKB);

    if (candidates.length === 0) {
      console.log('  [' + (i + 1) + '] 全新场景 → 入库');
      result.newRules.push(rule);
      continue;
    }

    // 用 LLM 精细对比
    var userMsg = [
      '## 新规则',
      JSON.stringify(rule, null, 2),
      '',
      '## 已有知识库（同场景）',
      JSON.stringify(candidates, null, 2),
      '',
      '请判断新规则与已有规则的关系。'
    ].join('\n');

    try {
      // 精判是评价任务，用标准模型（推理模型思考token会吃掉输出额度导致JSON截断）
      var raw = await deepseek.chat(prompts.PHASE4_DEDUP, userMsg, { maxTokens: 2048, model: deepseek.FAST_MODEL });
      var judgment = safeParseJSON(raw);

      switch (judgment.relation) {
        case 'duplicate':
          console.log('  [' + (i + 1) + '] 🔁 重复 → 跳过');
          result.duplicates.push({ rule: rule, matched: judgment.matchedRuleIndex !== null ? candidates[judgment.matchedRuleIndex] : null });
          break;
        case 'conflict':
          console.log('  [' + (i + 1) + '] ⚡ 冲突 → 标记人工');
          result.conflicts.push({
            newRule: rule,
            existingRule: judgment.matchedRuleIndex !== null ? candidates[judgment.matchedRuleIndex] : candidates[0],
            reason: judgment.reason
          });
          break;
        case 'supplement':
          console.log('  [' + (i + 1) + '] ➕ 补充 → 合并');
          var target = judgment.matchedRuleIndex !== null ? candidates[judgment.matchedRuleIndex] : candidates[0];
          var merged = mergeRules(target, rule);
          result.supplements.push(merged);
          break;
        case 'new':
        default:
          console.log('  [' + (i + 1) + '] ✅ 新规则 → 入库');
          result.newRules.push(rule);
          break;
      }
    } catch (e) {
      console.log('  [' + (i + 1) + '] 去重失败:', e.message, '— 默认入库');
      result.newRules.push(rule);
    }
  }

  return result;
}

/**
 * 合并两条规则——以现有规则为底，做"并集"合并，绝不整体替换
 * （condition/tactical_note 拼接保留双方；数组字段按内容去重后追加）
 */
function mergeRules(existing, supplement) {
  var merged = JSON.parse(JSON.stringify(existing));

  // condition: 并集——保留原触发场景，追加新场景（不做长度替换，否则会丢失原入口）
  if (supplement.condition && supplement.condition !== merged.condition) {
    merged.condition = merged.condition + '。另一类触发场景：' + supplement.condition;
  }

  // implication: 如果新规则有新的洞察角度，追加
  if (supplement.implication && supplement.implication !== merged.implication) {
    merged.implication = (merged.implication ? merged.implication + '；' : '') + supplement.implication;
  }

  // tactical_note: 并集追加
  if (supplement.tactical_note && supplement.tactical_note !== merged.tactical_note) {
    merged.tactical_note = (merged.tactical_note ? merged.tactical_note + '；' : '') + supplement.tactical_note;
  }

  // 数组字段: 按内容去重后追加（avoid/雷区、Ask三件套、Generate策略）
  ['avoid', 'key_dimensions', 'suggested_questions', 'question_pitfalls', 'strategies'].forEach(function (field) {
    var newItems = supplement[field] || [];
    if (newItems.length === 0) return;
    var existingItems = merged[field] || [];
    var seen = existingItems.map(function (x) { return JSON.stringify(x); });
    newItems.forEach(function (item) {
      if (seen.indexOf(JSON.stringify(item)) === -1) {
        existingItems.push(item);
      }
    });
    merged[field] = existingItems;
  });

  merged._mergedFrom = supplement;  // 保留来源追溯

  return merged;
}

module.exports = { dedup, mergeRules };
