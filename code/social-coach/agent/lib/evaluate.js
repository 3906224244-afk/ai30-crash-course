/**
 * 7维打分模块
 *
 * 对每条规则进行多维度质量评估，总分 ≥28 自动入库，<28 标记人工审核。
 */

var { safeParseJSON } = require('../../cloudfunctions/getSocialAdvice/index.js');

/**
 * 带重试的 chat 调用——超时/网络抖动时重试1次
 */
async function chatWithRetry(deepseek, systemPrompt, userMsg, opts) {
  try {
    return await deepseek.chat(systemPrompt, userMsg, opts);
  } catch (e) {
    console.log('    首次调用失败 (' + e.message + ')，重试1次...');
    return await deepseek.chat(systemPrompt, userMsg, opts);
  }
}

/**
 * @param {Array} rules     - 待打分的规则数组
 * @param {object} deepseek - LLM调用模块
 * @param {object} prompts  - prompt集
 * @returns {Array} 带 scores + totalScore 的规则数组
 */
async function scoreRules(rules, deepseek, prompts) {
  if (rules.length === 0) return [];

  var scored = [];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    console.log('  打分 [' + (i + 1) + '/' + rules.length + ']:',
      (rule.category || '?') + '/' + (rule.subcategory || '?'));

    var userMsg = [
      '请对以下知识库规则进行7维打分。',
      '',
      '```json',
      JSON.stringify(rule, null, 2),
      '```'
    ].join('\n');

    try {
      // 打分是评价任务而非深度推理，用标准模型（快且不易超时）；失败重试1次
      var raw = await chatWithRetry(deepseek, prompts.PHASE5_EVALUATE, userMsg,
        { maxTokens: 8192, model: deepseek.FAST_MODEL });
      var evaluation = safeParseJSON(raw);

      var scores = evaluation.scores || {};

      // 默认值兜底
      scores.competence = scores.competence || 3;
      scores.warmth = scores.warmth || 3;
      scores.personalized = scores.personalized || 3;
      scores.sycophancy = scores.sycophancy || 3;
      scores.clarity = scores.clarity || 3;
      scores.longTerm = scores.longTerm || 3;
      scores.traceable = scores.traceable || 3;

      var total = scores.competence + scores.warmth + scores.personalized +
                  scores.sycophancy + scores.clarity + scores.longTerm + scores.traceable;

      var scoredRule = Object.assign({}, rule, {
        scores: scores,
        totalScore: total,
        comment: evaluation.comment || '',
        status: total >= 28 ? 'auto_approved' : 'manual_review'
      });
      scored.push(scoredRule);

      console.log('    总分:', total, total >= 28 ? '✅' : '⚠️', '|', evaluation.comment || '');

    } catch (e) {
      console.log('    打分失败:', e.message, '— 默认3分，标记人工');
      var fallbackRule = Object.assign({}, rule, {
        scores: { competence: 3, warmth: 3, personalized: 3, sycophancy: 3, clarity: 3, longTerm: 3, traceable: 1 },
        totalScore: 21,
        comment: '打分失败，默认人工审核',
        status: 'manual_review'
      });
      scored.push(fallbackRule);
    }
  }

  return scored;
}

module.exports = { scoreRules };
