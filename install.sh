#!/usr/bin/env bash
# 安装 / 重装 dsh-comfy-suite。
#
#   PROFILE=/c/Users/you/.dsh/profiles/desktop bash install.sh   # link（推荐，改完即生效）
#   bash install.sh --copy                                      # 物理复制一份到 profile/node_modules
#
# PROFILE 不传时按 $DSH_HOME/profiles/desktop → ~/.dsh/profiles/desktop 取默认值。
#
# 三条硬约束（都是踩过的坑）：
#   ① 先校验源目录，再动目标。旧脚本是「先 rm -rf 目标，再 cp 源」——源不存在
#      时目标已经被删了，插件直接消失。
#   ② 目标目录在覆盖前留一份带时间戳的备份，回滚不必靠记忆。
#   ③ 依赖清单只写一条 dsh-comfy-suite，旧的三条只在回滚时才需要。
set -eu

SELF_DIR=$(cd "$(dirname "$0")" && pwd)
SRC=${SRC:-$SELF_DIR}
STAMP=$(date +%Y%m%dT%H%M%S)
MODE=link
[ "${1:-}" = "--copy" ] && MODE=copy

# DSH_HOME 可能是 Windows 形式（例如 E:\dsh-home），Git Bash 下先转成 /e/... 再用。
if [ -n "${DSH_HOME:-}" ] && command -v cygpath >/dev/null 2>&1; then
  DSH_HOME_W=$(cygpath -u "$DSH_HOME")
else
  DSH_HOME_W=${DSH_HOME:-$HOME/.dsh}
fi
PROFILE=${PROFILE:-"$DSH_HOME_W/profiles/desktop"}
DEST=$PROFILE/node_modules/dsh-comfy-suite

say() { printf '%s\n' "$*"; }

# ── ① preflight：源目录必须真的是一份插件 ────────────────────────────────
for f in package.json lib/index.js client/client.js cordis.patch.yml; do
  if [ ! -f "$SRC/$f" ]; then
    say "install: 源目录 $SRC 缺少 $f —— 中止，未改动任何文件" >&2
    exit 1
  fi
done

if [ ! -f "$PROFILE/package.json" ]; then
  say "install: 找不到 profile（$PROFILE/package.json）—— 用 PROFILE=/path/to/profile 指定" >&2
  exit 1
fi

# 客户端与 _parts 必须一致，避免把手工改过的 client.js 静默装进去。
if command -v node >/dev/null 2>&1 && [ -f "$SRC/scripts/build-client.mjs" ]; then
  if ! (cd "$SRC" && node scripts/build-client.mjs --check >/dev/null 2>&1); then
    say "install: client/client.js 与 client/_parts 不一致 —— 先跑 node scripts/build-client.mjs" >&2
    exit 1
  fi
fi

say "== backup =="
cp "$PROFILE/package.json" "$PROFILE/package.json.bak-suite-$STAMP"
cp "$PROFILE/cordis.patch.yml" "$PROFILE/cordis.patch.yml.bak-suite-$STAMP"
if [ -e "$DEST" ] || [ -L "$DEST" ]; then
  # cp -a 跟随符号链接会复制目标内容；这里只要一份可回滚的副本。
  cp -a "$DEST" "$PROFILE/node_modules/.dsh-comfy-suite.bak-$STAMP"
  say "   previous install -> node_modules/.dsh-comfy-suite.bak-$STAMP"
fi

say "== install ($MODE) =="
if [ -L "$DEST" ] || [ -e "$DEST" ]; then
  rm -rf "$DEST"
fi
if [ "$MODE" = copy ]; then
  mkdir -p "$DEST"
  cp -r "$SRC/." "$DEST/"
  # 源码侧才需要的杂项不进运行副本。
  rm -rf "$DEST/client/_parts" "$DEST/scripts"
else
  ln -s "$SRC" "$DEST" 2>/dev/null || true
  # Git Bash (MSYS) 在未开 winsymlinks 时，`ln -s` 会**静默复制**一份目录。
  # 那种情况下「改源码立即生效」不成立，必须说清楚并退回 copy 语义。
  if [ ! -L "$DEST" ]; then
    say "   ⚠ 本机 ln -s 没有生成符号链接（Git Bash 默认退化为复制）—— 改用 copy 模式"
    rm -rf "$DEST"
    mkdir -p "$DEST"
    cp -r "$SRC/." "$DEST/"
    rm -rf "$DEST/client/_parts" "$DEST/scripts"
    MODE=copy
  fi
fi
if [ "$MODE" = copy ]; then
  say "   $DEST (copy, $(du -sh "$DEST" 2>/dev/null | cut -f1))"
else
  say "   $DEST -> $(readlink "$DEST")"
fi

say "== update bundles + dependencies =="
DEST_DEP=$(cygpath -m "$DEST" 2>/dev/null || printf '%s' "$DEST")
SRC_DEP=$(cygpath -m "$SRC" 2>/dev/null || printf '%s' "$SRC")
node - "$PROFILE/package.json" "$MODE" "$DEST_DEP" "$SRC_DEP" <<'NODE'
const fs = require('node:fs')
const [file, mode, dest, src] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
const drop = new Set(['dsh-comfyui', 'dsh-comfyui-launcher', 'dsh-qwen-paint', 'dsh-comfy-suite'])
const list = (pkg.dsh.profile.bundles || []).filter((name) => !drop.has(name))
list.push('dsh-comfy-suite')
pkg.dsh.profile.bundles = list
pkg.dependencies = pkg.dependencies || {}
pkg.dependencies['dsh-comfy-suite'] = mode === 'copy' ? `file:${dest}` : `link:${src}`
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
console.log('bundles tail:', list.slice(-3).join(', '))
console.log('dependency:', pkg.dependencies['dsh-comfy-suite'])
NODE

say "== verify =="
# Git Bash 的 /e/... 不能直接拼进 file:///（Node 会当成 UNC 路径）。cygpath -m 给出
# E:/... 形式；没有 cygpath 的原生环境按原样用。
DEST_URL=$(cygpath -m "$DEST" 2>/dev/null || printf '%s' "$DEST")
node -e "
import('file:///$DEST_URL/lib/index.js')
  .then((m) => { if (typeof m.apply !== 'function') throw new Error('apply missing'); console.log('   import ok:', Object.keys(m).join(',')) })
  .catch((e) => { console.error('   import FAILED:', e.message); process.exit(1) })
" 2>&1 | sed 's/^/ /'

say "== done =="
say "配置：$PROFILE/cordis.patch.yml 里 comfyui / launcher / qwenPaint 三块的路径要指向你自己的 ComfyUI。"
say "热重载：给 $PROFILE/cordis.patch.yml 末尾追加一行注释即可。"
say "回滚：bash rollback.sh（再用上面打印的 .bak 目录换回旧副本）"