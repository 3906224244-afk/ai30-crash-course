/**
 * RAG 检索模块
 *
 * searchKnowledge(query, kbType) → 语义检索知识库 → 返回 top-N 匹配规则
 *
 * 检索流程：
 *   1. 将 query 用智谱AI embedding-3 向量化
 *   2. 与指定知识库中所有规则的预计算 embedding 做余弦相似度计算
 *   3. 返回 top-3（默认）最相关的规则
 *
 * 知识库来源: agent/knowledge-base/{kbType}-kb.json
 * 预计算 embedding 通过离线脚本 build-embeddings.js 生成，存在同目录下的 {kbType}-embeddings.json
 */

const fs = require('fs');
const path = require('path');
const zhipu = require('./zhipu-embedding.js');

// 知识库文件路径：优先云函数本地 kb/ 目录，回落 agent/knowledge-base（本地开发）
const KB_DIR_LOCAL = path.join(__dirname, 'kb');
const KB_DIR_DEV = path.join(__dirname, '..', '..', 'agent', 'knowledge-base');
const KB_DIR = fs.existsSync(KB_DIR_LOCAL) ? KB_DIR_LOCAL : KB_DIR_DEV;

// 缓存：运行时加载一次，避免每次检索都读文件
var _cache = {};

/**
 * 加载知识库及其预计算 embedding
 * @param {'ask' | 'generate'} kbType
 */
function loadKBWithEmbeddings(kbType) {
  if (_cache[kbType]) return _cache[kbType];

  var kbPath = path.join(KB_DIR, kbType + '-kb.json');
  var embPath = path.join(KB_DIR, kbType + '-embeddings.json');

  var rules = [];
  var embeddings = [];

  try {
    if (fs.existsSync(kbPath)) {
      rules = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    }
    if (fs.existsSync(embPath)) {
      embeddings = JSON.parse(fs.readFileSync(embPath, 'utf-8'));
    }
  } catch (e) {
    console.log('RAG: 知识库加载失败 — ' + e.message);
    rules = [];
    embeddings = [];
  }

  // 如果 embedding 数量与规则数量不一致（新增了规则但还没重新 build embedding）
  // 降级：用关键词匹配
  if (embeddings.length !== rules.length) {
    console.log('RAG: embedding 与规则数量不匹配 (' + embeddings.length + ' vs ' + rules.length + ')，降级关键词匹配');
    embeddings = [];
  }

  _cache[kbType] = { rules: rules, embeddings: embeddings };
  return _cache[kbType];
}

/**
 * 清空缓存（知识库更新后调用）
 */
function clearCache() {
  _cache = {};
}

/**
 * 余弦相似度
 */
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  var dot = 0, normA = 0, normB = 0;
  for (var i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 关键词降级匹配（当 embedding 不可用时）
 */
function keywordMatch(query, rules, topN) {
  var keywords = query.toLowerCase().split(/[\s,，。！？、]+/).filter(function(w) { return w.length > 0; });

  var scored = rules.map(function(rule, idx) {
    var text = (rule.category + ' ' + rule.subcategory + ' ' + rule.condition + ' ' + rule.tactical_note).toLowerCase();
    var score = 0;
    keywords.forEach(function(kw) {
      if (text.indexOf(kw) !== -1) score += 1;
    });
    return { index: idx, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, topN).filter(function(s) { return s.score > 0; }).map(function(s) { return rules[s.index]; });
}

/**
 * 语义检索知识库
 *
 * @param {string} query           - 检索查询文本
 * @param {'ask' | 'generate'} kbType - 知识库类型
 * @param {number} topN            - 返回规则数，默认 3
 * @returns {Promise<Array>}       - 匹配的规则数组
 */
async function searchKnowledge(query, kbType, topN) {
  topN = topN || 3;
  var kb = loadKBWithEmbeddings(kbType);

  if (kb.rules.length === 0) {
    console.log('RAG: ' + kbType + '知识库为空，返回 []');
    return [];
  }

  // 如果有预计算 embedding，走语义检索
  if (kb.embeddings.length === kb.rules.length) {
    try {
      var queryVec = await zhipu.embed(query);

      var scored = kb.rules.map(function(rule, idx) {
        return { rule: rule, score: cosineSim(queryVec, kb.embeddings[idx]) };
      });

      scored.sort(function(a, b) { return b.score - a.score; });

      var results = scored.slice(0, topN).filter(function(s) { return s.score > 0.35; }).map(function(s) {
        console.log('RAG: 匹配 [' + s.rule.category + '/' + s.rule.subcategory + '] 相似度=' + s.score.toFixed(3));
        return s.rule;
      });

      return results;
    } catch (e) {
      console.log('RAG: 语义检索失败 — ' + e.message + '，降级关键词');
    }
  }

  // 降级：关键词匹配
  return keywordMatch(query, kb.rules, topN);
}

module.exports = { searchKnowledge, clearCache };
