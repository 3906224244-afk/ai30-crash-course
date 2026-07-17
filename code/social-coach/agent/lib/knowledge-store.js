/**
 * 知识库读写模块
 *
 * 知识库 = Ask库 + Generate库，各自是一个 JSON 数组。
 * 文件位置：./knowledge-base/ask-kb.json、./knowledge-base/generate-kb.json
 */

var fs = require('fs');
var path = require('path');

var KB_DIR = path.join(__dirname, '..', 'knowledge-base');

var ASK_KB_PATH = path.join(KB_DIR, 'ask-kb.json');
var GEN_KB_PATH = path.join(KB_DIR, 'generate-kb.json');
var CONFLICTS_PATH = path.join(KB_DIR, 'conflicts.json');

/**
 * 加载知识库
 * @param {'ask' | 'generate'} kbType
 * @returns {Array}
 */
function loadKB(kbType) {
  var filePath = kbType === 'ask' ? ASK_KB_PATH : GEN_KB_PATH;

  if (!fs.existsSync(filePath)) {
    // 首次运行，初始化空知识库
    fs.writeFileSync(filePath, '[]');
    return [];
  }

  try {
    var content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.log('  知识库读取失败，重置为空:', e.message);
    return [];
  }
}

/**
 * 追加规则到知识库
 * @param {'ask' | 'generate'} kbType
 * @param {Array} rules - 要追加的规则（去重后的纯新规则）
 */
function saveKB(kbType, rules) {
  var existing = loadKB(kbType);
  var filePath = kbType === 'ask' ? ASK_KB_PATH : GEN_KB_PATH;

  // 追加（去重已在 Phase 4 完成，这里直接 concat）
  var updated = existing.concat(rules);

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  console.log('  已写入 ' + filePath + ' (' + updated.length + ' 条总)');
}

/**
 * 保存冲突记录
 * @param {Array} conflicts
 */
function saveConflicts(conflicts) {
  if (conflicts.length === 0) return;

  var existing = [];
  if (fs.existsSync(CONFLICTS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(CONFLICTS_PATH, 'utf-8'));
    } catch (e) { /* ignore */ }
  }

  var updated = existing.concat(conflicts.map(function(c) {
    return { timestamp: new Date().toISOString(), ...c };
  }));

  fs.writeFileSync(CONFLICTS_PATH, JSON.stringify(updated, null, 2));
}

/**
 * 打印知识库概况
 */
function printKBSummary() {
  var askKB = loadKB('ask');
  var genKB = loadKB('generate');

  console.log('\n📊 知识库概况:');
  console.log('  Ask库:', askKB.length, '条规则 (E-Rule)');
  console.log('  Generate库:', genKB.length, '条规则 (I-Rule + A-Rule)');
  console.log('  合计:', askKB.length + genKB.length, '条');

  // 按场景分布
  var categories = {};
  askKB.concat(genKB).forEach(function(r) {
    var cat = r.category || '未分类';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log('  场景分布:', JSON.stringify(categories));
}

module.exports = { loadKB, saveKB, saveConflicts, printKBSummary };
