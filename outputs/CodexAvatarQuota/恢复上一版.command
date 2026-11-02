#!/bin/bash
set -euo pipefail
task_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
"/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node" "$task_dir/restore.cjs"
read -r -p "按回车关闭此窗口…" _reply
