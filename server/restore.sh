#!/usr/bin/env bash
# 从备份恢复所有账号和存档
#   sudo bash /opt/flame1down1/server/restore.sh            列出所有备份
#   sudo bash /opt/flame1down1/server/restore.sh latest     恢复到最近一份
#   sudo bash /opt/flame1down1/server/restore.sh 文件名      恢复到指定的那份（文件名从列表里复制）
# 恢复前会先把当前存档再备份一次（标记 before-restore），恢复错了还能换回来。
set -e
if [ "$(id -u)" != "0" ]; then exec sudo bash "$0" "$@"; fi
DATA_DIR=$(sed -n 's/^Environment=DATA_DIR=//p' /etc/systemd/system/flame1down.service 2>/dev/null)
DATA_DIR=${DATA_DIR:-/opt/flame1down-data}
PORT=$(sed -n 's/^Environment=PORT=//p' /etc/systemd/system/flame1down.service 2>/dev/null); PORT=${PORT:-80}
BACKUP_DIR=/opt/flame1down-backups
HERE=$(cd "$(dirname "$0")" && pwd)

if [ -z "$1" ]; then
  echo "现有备份（最新的在最下面）："
  ls -1tr "$BACKUP_DIR" 2>/dev/null | grep '^saves-' | while read -r f; do echo "  $f  $(du -h "$BACKUP_DIR/$f" | cut -f1)"; done
  echo; echo "恢复最近一份：sudo bash $HERE/restore.sh latest"
  exit 0
fi
if [ "$1" = latest ]; then F=$(ls -1t "$BACKUP_DIR" | grep '^saves-' | grep -v before-restore | head -1); else F=$(basename "$1"); fi
[ -n "$F" ] && [ -f "$BACKUP_DIR/$F" ] || { echo "✘ 找不到备份 $1"; exit 1; }
tar -tzf "$BACKUP_DIR/$F" >/dev/null || { echo "✘ 备份文件 $F 损坏了，换一份试试"; exit 1; }

echo "==> 先把现在的存档备份一次"
bash "$HERE/backup.sh" before-restore
echo "==> 停止游戏服务"
systemctl stop flame1down
OLD="$DATA_DIR.before-restore-$(date +%Y%m%d-%H%M%S)"
mv "$DATA_DIR" "$OLD"
echo "==> 恢复 $F"
tar -xzf "$BACKUP_DIR/$F" -C "$(dirname "$DATA_DIR")"
systemctl start flame1down; sleep 2
if curl -fsS "http://127.0.0.1:$PORT/ping" >/dev/null 2>&1; then
  echo "✔ 已恢复到 $F，游戏服务已重新启动"
  echo "  恢复前的存档目录留在 $OLD（确认没问题后可以删掉）"
else
  journalctl -u flame1down -n 20 --no-pager
  echo "✘ 恢复后服务没跑起来，请把上面的内容发给 Claude"; exit 1
fi
