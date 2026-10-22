#!/bin/bash
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
PROFILE="${DSH_PROFILE:-web}"
case "$PROFILE" in *[!a-zA-Z0-9_-]*|"") echo "Invalid profile" >&2; exit 1;; esac
command -v dsh >/dev/null || { echo '请先安装 DeepSeek Harness (dsh)。' >&2; exit 1; }
command -v node >/dev/null || exit 1
NODE_EXEC="${DSH_NODE:-$(node -p 'process.execPath')}"
DSH_EXEC="$(command -v dsh)"
"$NODE_EXEC" -e 'const [a,b]=process.versions.node.split(".").map(Number);if(!((a===20&&b>=19)||(a===22&&b>=12)||a>=24))throw new Error("需要 Node 20.19 / 22.12 或 24+，可用 DSH_NODE 指定路径")'
export PATH="$(dirname "$NODE_EXEC"):$PATH"
PACKAGES=("$HERE"/dsh-pocket-todo-*.tgz)
if [ "${#PACKAGES[@]}" -ne 1 ] || [ ! -f "${PACKAGES[0]}" ]; then
  echo '安装目录应包含且仅包含一个 dsh-pocket-todo-*.tgz 文件。' >&2
  exit 1
fi
# The DSH CLI manages dependency installation and bundle activation atomically.
"$NODE_EXEC" "$DSH_EXEC" plugin --profile "$PROFILE" add "file:${PACKAGES[0]}" < /dev/null
echo "安装完成。重启 DSH ${PROFILE}，侧栏会出现「随手待办」。主聊天可直接发送指令或截图。"
echo '模型和 Key 沿用 DSH 原有配置，截图需要支持图像输入的云端模型。'
