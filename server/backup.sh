#!/usr/bin/env bash
# 备份所有账号和存档（/opt/flame1down-data）到 /opt/flame1down-backups，保留 30 天
# 平时由系统定时任务每 6 小时自动运行一次，每次自动部署前也会先备份一次；也可以手动运行：
#   sudo bash /opt/flame1down1/server/backup.sh
# 恢复用 restore.sh
set -e
if [ "$(id -u)" != "0" ]; then exec sudo bash "$0" "$@"; fi
DATA_DIR=$(sed -n 's/^Environment=DATA_DIR=//p' /etc/systemd/system/flame1down.service 2>/dev/null)
DATA_DIR=${DATA_DIR:-/opt/flame1down-data}
BACKUP_DIR=/opt/flame1down-backups
KEEP_DAYS=30
TAG=${1:-auto}   # 文件名里的标记：auto 定时备份 / deploy 部署前 / manual 等

[ -d "$DATA_DIR" ] || { echo "✘ 找不到存档目录 $DATA_DIR"; exit 1; }
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
NAME="saves-$(date +%Y%m%d-%H%M%S)-$TAG.tar.gz"
# 存档写入是「先写临时文件再改名」，打包时不会读到写了一半的文件
tar -czf "$BACKUP_DIR/$NAME.tmp" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
mv "$BACKUP_DIR/$NAME.tmp" "$BACKUP_DIR/$NAME"
chmod 600 "$BACKUP_DIR/$NAME"
find "$BACKUP_DIR" -name 'saves-*.tar.gz' -mtime +$KEEP_DAYS -delete
USERS=$(ls "$DATA_DIR/users" 2>/dev/null | grep -c '\.json$' || true)
echo "✔ 已备份 $USERS 个账号 → $BACKUP_DIR/$NAME（$(du -h "$BACKUP_DIR/$NAME" | cut -f1)），目前共有 $(ls "$BACKUP_DIR" | grep -c '^saves-') 份备份"
