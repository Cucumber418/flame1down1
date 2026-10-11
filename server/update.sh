#!/usr/bin/env bash
# 更新服务器上的游戏：拉取 GitHub 上的最新代码并重启服务
# 用法：sudo bash /opt/flame1down1/server/update.sh
set -e
if [ "$(id -u)" != "0" ]; then exec sudo bash "$0" "$@"; fi
APP_DIR=/opt/flame1down1
PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/flame1down.service 2>/dev/null)
PORT=${PORT:-80}

echo "当前版本：$(git -C "$APP_DIR" log -1 --format='%h %s')"
echo "正在从 GitHub 下载更新（国内连 GitHub 有时较慢，请耐心等待，最多 5 分钟）…"
# 国内服务器用默认的 HTTP/2 连 GitHub 经常卡住，固定用 HTTP/1.1
git -C "$APP_DIR" config http.version HTTP/1.1
# 用 fetch + reset：开了自动部署后服务器上的文件可能已经比 git 记录的新，直接 pull 会冲突
if ! timeout 300 git -C "$APP_DIR" fetch --progress origin main || ! git -C "$APP_DIR" reset --hard origin/main; then
  echo "✘ 下载更新失败或超时。可能是连 GitHub 不稳定，过几分钟再运行一次。"
  exit 1
fi

echo "正在重启游戏服务…"
systemctl restart flame1down
sleep 2
if curl -fsS "http://127.0.0.1:$PORT/ping" >/dev/null 2>&1; then
  echo "✔ 已更新到最新版：$(git -C "$APP_DIR" log -1 --format='%h %s')"
  echo "  刷新游戏网页即可（电脑上按 Cmd+Shift+R 强制刷新）"
else
  journalctl -u flame1down -n 20 --no-pager
  echo "✘ 更新后服务器没跑起来，请把上面的内容发给 Claude"
  exit 1
fi
