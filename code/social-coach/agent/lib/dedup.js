/**
 * 去重与冲突检测模块
 *
 * 将新规则与已有知识库逐条对比，判定关系：
 *   duplicate | conflict | supplement | new
 */

var { safeParseJSON } = require('../../cloudfunctions/getSocialAdvice/index.js');

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

    // 先做粗筛：同 category 的规则才对比
    var candidates = existingKB.filter(function (r) {
      return r.category === rule.category && r.subcategory === rule.subcategory;
    });

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
      var raw = await deepseek.chat(prompts.PHASE4_DEDUP, userMsg, { maxTokens: 512 });
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
 * 合并两条规则——以现有规则为底，补充新规则的细节
 */
function mergeRules(existing, supplement) {
  var merged = JSON.parse(JSON.stringify(existing));

  // condition: 如果新规则的更具体，采用新的
  if (supplement.condition && supplement.condition.length > merged.condition.length) {
    merged.condition = supplement.condition;
  }

  // implication: 如果新规则有新的洞察角度，追加
  if (supplement.implication && supplement.implication !== merged.implication) {
    merged.implication = merged.implication + '；' + supplement.implication;
  }

  // tactical_note: 保留更具体的
  if (supplement.tactical_note && supplement.tactical_note.length > merged.tactical_note.length) {
    merged.tactical_note = supplement.tactical_note;
  }

  // avoid: 合并去重
  var existingAvoid = merged.avoid || [];
  var newAvoid = supplement.avoid || [];
  newAvoid.forEach(function (item) {
    if (existingAvoid.indexOf(item) === -1) {
      existingAvoid.push(item);
    }
  });
  merged.avoid = existingAvoid;

  merged._mergedFrom = supplement;  // 保留来源追溯

  return merged;
}

module.exports = { dedup, mergeRules };
