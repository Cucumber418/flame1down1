#!/usr/bin/env bash
# 安装存档自动备份的系统定时任务（每 6 小时一次，开机后补跑错过的那次）。重复运行没关系。
# 自动部署时会自动运行这个脚本，一般不用手动跑。
set -e
if [ "$(id -u)" != "0" ]; then exec sudo bash "$0" "$@"; fi
HERE=$(cd "$(dirname "$0")" && pwd)
cat > /etc/systemd/system/flame1down-backup.service <<UNIT
[Unit]
Description=Flame1Down - 1 存档备份

[Service]
Type=oneshot
ExecStart=/bin/bash $HERE/backup.sh auto
UNIT
cat > /etc/systemd/system/flame1down-backup.timer <<UNIT
[Unit]
Description=Flame1Down - 1 存档每 6 小时备份一次

[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now flame1down-backup.timer >/dev/null 2>&1
echo "✔ 自动备份已开启：$(systemctl list-timers flame1down-backup.timer --no-legend 2>/dev/null | awk '{print "下次备份 " $1 " " $2 " " $3}')"
