/**
 * 知识库精简压缩 — 入库时预压（非运行时）
 *
 * 为每条 Ask/Generate 规则生成 compact 字段（~250字高密度摘要）。
 * RAG 检索后注入 prompt 时只取 compact，体积降 95%。
 *
 * 用法: node lib/compact-kb.js
 */

var fs = require('fs');
var path = require('path');
var https = require('https');

// 读 API key（绕过 cloudfunction 模块依赖）
var SECRET_PATH = path.join(__dirname, '..', '..', 'cloudfunctions', 'getSocialAdvice', 'secret.js');
var DEEPSEEK_API_KEY = '';
try {
  DEEPSEEK_API_KEY = require(SECRET_PATH).DEEPSEEK_API_KEY;
} catch(e) {
  console.log('❌ 无法读取 API key:', e.message);
  process.exit(1);
}

var KB_DIR = path.join(__dirname, '..', 'knowledge-base');
var ASK_PATH = path.join(KB_DIR, 'ask-kb.json');
var GEN_PATH = path.join(KB_DIR, 'generate-kb.json');

// ========== DeepSeek 调用（精简版，不依赖 cloudfunction 模块） ==========

function chat(systemPrompt, userMessage) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({
      model: 'deepseek-chat',  // 用 fast 模型，便宜且快
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 512,
      stream: false
    });

    var req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, function (res) {
      res.setEncoding('utf8'); // 防止多字节字符被 chunk 边界切断
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.error) { reject(new Error(JSON.stringify(json.error))); return; }
          resolve((json.choices[0].message.content || '').trim());
        } catch (e) { reject(new Error(data.substring(0, 200))); }
      });
    });
    req.on('error', function (e) { reject(e); });
    req.on('timeout', function () { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ========== Prompt ==========

var SYSTEM_PROMPT = [
  '你是知识库编辑。把一条人情世故规则压缩为高密度摘要，保留所有对 LLM 决策关键的信息。',
  '',
  '要求：',
  '- 300字左右',
  '- 保留：场景分类、触发条件、核心洞察、策略方向、关键雷区',
  '- 去掉：具体话术全文、冗余修辞、过渡语句',
  '- 格式：用紧凑的自然语言，不用 JSON',
  '- 中文'
].join('\n');

function buildAskPrompt(rule) {
  return [
    '## Ask 规则（追问维度）',
    '场景: ' + rule.category + ' / ' + rule.subcategory,
    '触发条件: ' + rule.condition,
    '核心洞察: ' + rule.implication,
    '追问维度: ' + (rule.key_dimensions || []).map(function(d) { return d.dimension; }).join('；'),
    '追问禁区: ' + (rule.question_pitfalls || []).join('；'),
    '',
    '请生成精简摘要。'
  ].join('\n');
}

function buildGeneratePrompt(rule) {
  return [
    '## Generate 规则（策略生成）',
    '场景: ' + rule.category + ' / ' + rule.subcategory,
    '触发条件: ' + rule.condition,
    '核心洞察: ' + rule.implication,
    '博弈本质: ' + rule.game_essence,
    '策略方向: ' + (rule.strategies || []).map(function(s) { return s.angle; }).join('、'),
    '雷区: ' + (rule.avoid || []).join('、'),
    '',
    '请生成精简摘要。'
  ].join('\n');
}

// ========== 主逻辑 ==========

async function processFile(filePath, type) {
  if (!fs.existsSync(filePath)) {
    console.log(type + ' 文件不存在，跳过');
    return;
  }

  var rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log('\n处理 ' + type + ' (' + rules.length + ' 条)...\n');

  var updated = 0;
  var skipped = 0;

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    var label = (rule.category || '?') + '/' + (rule.subcategory || '?');
    process.stdout.write('[' + (i + 1) + '/' + rules.length + '] ' + label + ' ... ');

    // 已有 compact 则跳过
    if (rule.compact && rule.compact.length > 50) {
      console.log('(已有)');
      skipped++;
      continue;
    }

    try {
      var userPrompt = type === 'ask' ? buildAskPrompt(rule) : buildGeneratePrompt(rule);
      var compact = await chat(SYSTEM_PROMPT, userPrompt);
      rule.compact = compact;
      console.log('✅ ' + compact.length + '字');
      updated++;
    } catch (e) {
      console.log('❌ ' + e.message);
    }
  }

  // 写回
  fs.writeFileSync(filePath, JSON.stringify(rules, null, 2));
  console.log('\n' + type + ': 新增 ' + updated + ' 条 compact, 跳过 ' + skipped + ' 条');
  console.log('文件大小: ' + Buffer.byteLength(JSON.stringify(rules)) + ' bytes');
}

async function main() {
  console.log('========================================');
  console.log('  知识库精简压缩（入库时预压）');
  console.log('========================================');

  await processFile(ASK_PATH, 'ask');
  await processFile(GEN_PATH, 'generate');

  console.log('\n========================================');
  console.log('  完成。下一步: node lib/build-embeddings.js');
  console.log('========================================');
}

main().catch(function(e) {
  console.error('失败:', e.message);
  process.exit(1);
});
