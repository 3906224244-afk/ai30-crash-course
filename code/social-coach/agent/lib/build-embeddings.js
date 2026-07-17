/**
 * 离线 Embedding 预计算脚本
 *
 * 读取知识库 JSON，为每条规则计算智谱AI embedding-3 (1024维) embedding，
 * 写入 {kbType}-embeddings.json，供 RAG 检索时直接使用。
 *
 * 每次修改知识库内容后运行一次：
 *   node lib/build-embeddings.js
 */

const fs = require('fs');
const path = require('path');
const zhipu = require('../../cloudfunctions/getSocialAdvice/zhipu-embedding.js');

const KB_DIR = path.join(__dirname, '..', 'knowledge-base');

async function buildEmbeddings(kbType) {
  var kbPath = path.join(KB_DIR, kbType + '-kb.json');
  var embPath = path.join(KB_DIR, kbType + '-embeddings.json');

  if (!fs.existsSync(kbPath)) {
    console.log(kbType + '-kb.json 不存在，跳过');
    return;
  }

  var rules = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
  if (rules.length === 0) {
    console.log(kbType + '知识库为空，跳过');
    return;
  }

  console.log('正在为 ' + kbType + ' 库的 ' + rules.length + ' 条规则计算 embedding...');

  // 拼接规则的核心信息作为 embedding 输入
  var texts = rules.map(function(r) {
    return (r.category || '') + ' ' + (r.subcategory || '') + ' ' +
           (r.condition || '') + ' ' + (r.compact || r.implication || '');
  });

  try {
    var vectors = await zhipu.embedBatch(texts, 'document');
    fs.writeFileSync(embPath, JSON.stringify(vectors));
    console.log('✅ ' + kbType + '-embeddings.json 已生成 (' + vectors.length + ' 条)');
  } catch (e) {
    console.error('❌ ' + kbType + ' embedding 生成失败:', e.message);
  }
}

async function main() {
  console.log('========================================');
  console.log('  知识库 Embedding 预计算');
  console.log('========================================\n');

  await buildEmbeddings('ask');
  await buildEmbeddings('generate');

  console.log('\n完成。');
}

main().catch(function(e) {
  console.error('失败:', e);
  process.exit(1);
});
