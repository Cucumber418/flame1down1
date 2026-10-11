#!/usr/bin/env bash
# Flame1Down - 1 一键安装（在腾讯云服务器上运行一次即可）
#
# 做的事：装 Node.js → 把游戏放到 /opt/flame1down1 → 注册成系统服务（开机自启、崩溃自动重启）→ 自检
# 用法：sudo bash /opt/flame1down1/server/setup.sh
set -e

APP_DIR=/opt/flame1down1
REPO=https://github.com/Cucumber418/flame1down1
SERVICE=flame1down
PORT=80

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✘ %s\033[0m\n' "$1"; exit 1; }

if [ "$(id -u)" != "0" ]; then exec sudo bash "$0" "$@"; fi

# ---------- 1. 安装 git 和 Node.js ----------
say "检查 git 和 Node.js"
install_pkg() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1; then dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1; then yum install -y "$@"
  else fail "不认识这个系统的安装命令，请把这段报错发给 Claude"; fi
}
command -v git  >/dev/null 2>&1 || install_pkg git
command -v node >/dev/null 2>&1 || install_pkg nodejs
NODE_BIN=$(command -v node || command -v nodejs || true)
[ -n "$NODE_BIN" ] || fail "Node.js 没装上，请把上面的报错发给 Claude"
ok "Node.js $("$NODE_BIN" -v)"

# ---------- 2. 下载 / 更新游戏代码 ----------
say "下载游戏代码到 $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only || fail "更新代码失败（可能是连 GitHub 不稳定，过几分钟再试一次）"
else
  git clone --depth 1 "$REPO" "$APP_DIR" || fail "从 GitHub 下载失败（国内服务器连 GitHub 有时不稳定，过几分钟再试一次）"
fi
[ -f "$APP_DIR/server/node_modules/ws/package.json" ] || fail "缺少 server/node_modules/ws，请告诉 Claude"
ok "代码已就位"

# ---------- 3. 检查 80 端口 ----------
say "检查 $PORT 端口"
if command -v ss >/dev/null 2>&1 && ss -ltnp 2>/dev/null | grep -q ":$PORT " && ! ss -ltnp 2>/dev/null | grep ":$PORT " | grep -q node; then
  ss -ltnp | grep ":$PORT " || true
  fail "$PORT 端口被别的程序占着（常见是 nginx 或宝塔面板）。把上面这行发给 Claude"
fi
ok "$PORT 端口可用"

# ---------- 4. 注册系统服务 ----------
say "注册系统服务 $SERVICE"
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Flame1Down - 1 game server
After=network.target

[Service]
WorkingDirectory=$APP_DIR/server
ExecStart=$NODE_BIN $APP_DIR/server/server.js
Environment=PORT=$PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $SERVICE >/dev/null 2>&1
systemctl restart $SERVICE
sleep 2

# ---------- 5. 自检 ----------
say "自检"
if curl -fsS "http://127.0.0.1:$PORT/ping" >/dev/null 2>&1; then
  ok "服务器在运行"
else
  journalctl -u $SERVICE -n 20 --no-pager || true
  fail "服务器没跑起来，请把上面的内容发给 Claude"
fi

IP=$(curl -fsS --max-time 3 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 2>/dev/null || true)
echo
echo "=============================================="
if [ -n "$IP" ]; then
  echo "  装好了！用浏览器打开： http://$IP"
else
  echo "  装好了！用浏览器打开： http://你的服务器公网IP"
fi
echo "  以后更新游戏只需运行： sudo bash $APP_DIR/server/update.sh"
echo "=============================================="
