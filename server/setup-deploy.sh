#!/usr/bin/env bash
# 一次性设置自动部署：生成一把只给 GitHub 用的部署钥匙，并打印出来让你填进 GitHub。
# 用法（用 ubuntu 账号运行，不要加 sudo）：bash /opt/flame1down1/server/setup-deploy.sh
set -e
if [ "$(id -u)" = "0" ]; then echo "请用 ubuntu 账号运行，不要加 sudo：bash $0"; exit 1; fi
KEY="$HOME/.ssh/flame_deploy"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$KEY" ]; then ssh-keygen -t ed25519 -N "" -C "github-deploy-flame1down" -f "$KEY" >/dev/null; fi
touch "$HOME/.ssh/authorized_keys" && chmod 600 "$HOME/.ssh/authorized_keys"
grep -qF "$(cat "$KEY.pub")" "$HOME/.ssh/authorized_keys" || cat "$KEY.pub" >> "$HOME/.ssh/authorized_keys"
command -v rsync >/dev/null 2>&1 || sudo apt-get install -y rsync >/dev/null
IP=$(curl -fsS --max-time 3 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 2>/dev/null || echo "你的服务器公网IP")
echo
echo "================ 复制下面两样东西到 GitHub ================"
echo "（仓库 → Settings → Secrets and variables → Actions → New repository secret）"
echo
echo "第 1 个  Name: DEPLOY_HOST"
echo "         Secret: $IP"
echo
echo "第 2 个  Name: DEPLOY_KEY"
echo "         Secret: 下面从 -----BEGIN 到 -----END 的整段（包括这两行）"
echo
cat "$KEY"
echo
echo "==========================================================="
echo "这把钥匙只能登录这台服务器，不要发给任何人（包括 Claude）。"
