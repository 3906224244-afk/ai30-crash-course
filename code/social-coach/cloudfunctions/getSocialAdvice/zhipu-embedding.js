/**
 * 智谱AI Embedding 调用封装
 *
 * Embedding: POST https://open.bigmodel.cn/api/paas/v4/embeddings
 *   模型: embedding-3, 维度: 1024 (可调)
 *
 * 接口与 minimax.js 保持相同签名，无缝替换。
 */

var https = require('https');

// 优先读微信云函数环境变量，本地开发回落 secret.js
var ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
if (!ZHIPU_API_KEY) {
  try { ZHIPU_API_KEY = require('./secret.js').ZHIPU_API_KEY; }
  catch (e) { console.log('zhipu-embedding.js: 无 API Key (env 或 secret.js 均缺失)'); }
}

var API_HOST = 'open.bigmodel.cn';
var MODEL = 'embedding-3';
var DIMENSIONS = 1024;

/**
 * 单条文本向量化
 *
 * @param {string} text - 待向量化的文本
 * @returns {Promise<number[]>} - 1024 维向量
 */
function embed(text) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({
      model: MODEL,
      input: text,
      dimensions: DIMENSIONS
    });

    var req = https.request({
      hostname: API_HOST,
      path: '/api/paas/v4/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ZHIPU_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, function (res) {
      res.setEncoding('utf8'); // 防止多字节字符被 chunk 边界切断产生乱码
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.error) {
            reject(new Error('Zhipu Embedding error: ' + JSON.stringify(json.error)));
            return;
          }
          var emb = json.data && json.data[0] && json.data[0].embedding;
          if (!emb) {
            reject(new Error('Zhipu Embedding: no embedding returned'));
            return;
          }
          resolve(emb);
        } catch (e) {
          reject(new Error('Failed to parse Zhipu response: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', function (e) { reject(e); });
    req.on('timeout', function () { req.destroy(); reject(new Error('Zhipu Embedding timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * 批量文本向量化（离线建库）
 *
 * @param {string[]} texts - 文本数组
 * @param {string} type - 保留参数，兼容 minimax 接口（未使用）
 * @returns {Promise<number[][]>}
 */
function embedBatch(texts, type) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({
      model: MODEL,
      input: texts,
      dimensions: DIMENSIONS
    });

    var req = https.request({
      hostname: API_HOST,
      path: '/api/paas/v4/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ZHIPU_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, function (res) {
      res.setEncoding('utf8'); // 防止多字节字符被 chunk 边界切断产生乱码
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.error) {
            reject(new Error('Zhipu Embedding error: ' + JSON.stringify(json.error)));
            return;
          }
          var embeddings = (json.data || []).map(function (item) {
            return item.embedding;
          });
          if (embeddings.length === 0) {
            reject(new Error('Zhipu Embedding: no embeddings returned'));
            return;
          }
          resolve(embeddings);
        } catch (e) {
          reject(new Error('Failed to parse Zhipu response: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', function (e) { reject(e); });
    req.on('timeout', function () { req.destroy(); reject(new Error('Zhipu Embedding timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = { embed, embedBatch, MODEL: MODEL };
