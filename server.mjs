import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = 3070;
const rootFiles = new Set(['/index.html', '/styles.css', '/app.js', '/catalog.js', '/state.js', '/views.js']);
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let path;
  try {
    path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (path === '/') path = '/index.html';
  const permitted = rootFiles.has(path) || /^\/assets\/[a-z0-9][a-z0-9-]*\.(svg|jpg|webp|png|woff2)$/.test(path);
  const file = join(root, path.slice(1));
  if (!permitted || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('페이지를 찾을 수 없습니다.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': statSync(file).size,
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).on('error', () => response.destroy()).pipe(response);
});

server.on('error', error => {
  console.error(`미리보기 서버를 시작할 수 없습니다. ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`스마일 포인트 미리보기 http://localhost:${port}/`));
