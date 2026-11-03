/*
 * 打包前的准备（npm start / npm run dist 会自动运行）：
 * 1. 从 @fontsource/long-cang 复制手写字体（只要 woff2），生成 fonts/long-cang.css，
 *    字体地址写成 https://fonts.gstatic.com/f1d/...，由 main.js 截下来换成本地文件。
 * 2. 设置了环境变量 F1D_SERVER（服务器 IP 或网址）时，写进 default-server.json，
 *    装好客户端第一次打开就直接连这台服务器，不用自己填地址。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', '@fontsource', 'long-cang');
const OUT = path.join(ROOT, 'fonts');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let css = fs.readFileSync(path.join(SRC, '400.css'), 'utf8');
let n = 0;
css = css.replace(/src:\s*url\(\.\/files\/([^)]+\.woff2)\)\s*format\('woff2'\)[^;]*;/g, (m, file) => {
  fs.copyFileSync(path.join(SRC, 'files', file), path.join(OUT, file));
  n++;
  return "src: url(https://fonts.gstatic.com/f1d/" + file + ") format('woff2');";
});
if (!n) throw new Error('没在 @fontsource/long-cang 里找到字体文件，字体包的格式可能变了');
fs.writeFileSync(path.join(OUT, 'long-cang.css'), css);
console.log('手写字体：' + n + ' 个文件');

const server = String(process.env.F1D_SERVER || '').trim();
const def = path.join(ROOT, 'default-server.json');
if (server) {
  fs.writeFileSync(def, JSON.stringify({ server: server }) + '\n');
  console.log('已写入默认服务器地址');
} else if (!fs.existsSync(def)) {
  console.log('没有设置 F1D_SERVER：第一次打开客户端时需要自己填服务器地址');
}
