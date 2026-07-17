/**
 * 本地开发服务器 — 包装云函数 main() 为 HTTP 接口
 *
 * 云函数部署到微信云之前，小程序前端通过此服务器调用 RAG + LLM。
 * 在微信开发者工具中开启"不校验合法域名"即可连 localhost。
 *
 * 用法: node dev-server.js [端口号，默认 3001]
 */

const http = require('http');
const { main } = require('./index.js');

const PORT = parseInt(process.argv[2]) || 3001;

const server = http.createServer(async function (req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('getSocialAdvice dev server OK');
    return;
  }

  // 读取请求体
  var body = '';
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', async function () {
    var startTime = Date.now();
    try {
      var event = JSON.parse(body);
      var result = await main(event, {});
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('✅ ' + (event.phase || 'auto') + ' | ' + elapsed + 's');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('❌ ' + elapsed + 's — ' + e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message, elapsed: elapsed }));
    }
  });
});

server.listen(PORT, function () {
  console.log('========================================');
  console.log('  getSocialAdvice 本地开发服务器');
  console.log('  http://localhost:' + PORT);
  console.log('========================================');
  console.log('');
  console.log('前端调用方式（wx.request）:');
  console.log('  POST http://localhost:' + PORT + '/');
  console.log('  Body: { situation, answers, phase, profile }');
  console.log('');
});
