#!/usr/bin/env bash
# 更新服务器上的游戏：拉取 GitHub 上的最新代码并重启服务
# 用法：sudo bash /opt/flame1down1/server/update.sh
set -e
if [ "$(id -u)" != "0" ]; then exec sudo bash "$0" "$@"; fi
APP_DIR=/opt/flame1down1
PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/flame1down.service 2>/dev/null)
PORT=${PORT:-80}
git -C "$APP_DIR" pull --ff-only
systemctl restart flame1down
sleep 2
if curl -fsS http://127.0.0.1:$PORT/ping >/dev/null 2>&1; then
  echo "✔ 已更新到最新版：$(git -C "$APP_DIR" log -1 --format='%h %s')"
else
  journalctl -u flame1down -n 20 --no-pager
  echo "✘ 更新后服务器没跑起来，请把上面的内容发给 Claude"
  exit 1
fi
