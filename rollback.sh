#!/usr/bin/env bash
# 回滚 dsh-comfy-suite：恢复最近一次 install.sh 备份的 profile package.json 与 cordis.patch.yml。
#
#   PROFILE=/c/Users/you/.dsh/profiles/desktop bash rollback.sh
#
# 它只恢复「配置层」。要把运行副本也换回去，用 install.sh 打印的
# node_modules/.dsh-comfy-suite.bak-<时间戳> 覆盖回 node_modules/dsh-comfy-suite。
set -eu

if [ -n "${DSH_HOME:-}" ] && command -v cygpath >/dev/null 2>&1; then
  DSH_HOME_W=$(cygpath -u "$DSH_HOME")
else
  DSH_HOME_W=${DSH_HOME:-$HOME/.dsh}
fi
PROFILE=${PROFILE:-"$DSH_HOME_W/profiles/desktop"}

PKG=$(ls -t "$PROFILE"/package.json.bak-suite-* 2>/dev/null | head -1 || true)
PATCH=$(ls -t "$PROFILE"/cordis.patch.yml.bak-suite-* 2>/dev/null | head -1 || true)

if [ -z "$PKG" ]; then
  echo "找不到 $PROFILE/package.json.bak-suite-*，无法回滚（先跑 install.sh 才会有备份）" >&2
  exit 1
fi

cp "$PKG" "$PROFILE/package.json"
echo "已恢复 $PKG"
if [ -n "$PATCH" ]; then
  cp "$PATCH" "$PROFILE/cordis.patch.yml"
  echo "已恢复 $PATCH"
fi

cat <<'TIP'

下一步：
  - 想回到三个独立插件：装上游即可
      dsh plugin --profile <name> add dsh-comfyui
      dsh plugin --profile <name> add dsh-qwen-paint
  - 只想停用套件：把 profile 的 node_modules/dsh-comfy-suite 移走，再给
    cordis.patch.yml 末尾追加一行注释触发热重载。
TIP