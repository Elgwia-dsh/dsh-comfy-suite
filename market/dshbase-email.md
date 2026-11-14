Subject: Plugin submission — Elgwia-dsh/dsh-comfy-suite

Repository: https://github.com/Elgwia-dsh/dsh-comfy-suite
Category: vision (ComfyUI image generation / editing)
Author: Elgwia-dsh

What it is:
A personal merge of three MIT-licensed DSH plugins into one bundle — dsh-comfyui 0.5.5,
dsh-qwen-paint 0.17.13, and a small self-written launcher. It provides a workflow library,
local image generation and editing through a local ComfyUI (draw / inpaint / outpaint /
character / upscale), a ComfyUI service launcher, an image gallery, a 62-entry style library
and a prompt wardrobe: 14 tools, one settings section.

It is not an official version of any upstream plugin. Sources, modifications and licenses are
listed in THIRD-PARTY-NOTICES.md; all three upstreams are MIT and their LICENSE files are kept
in the repository.

Notes:
- Requires a local ComfyUI installation; the three config paths in cordis.patch.yml have to be
  pointed at it.
- Windows-first (the zero-window launcher uses wscript/VBS); other platforms are untested.
- Locked to a 2026-11-13 snapshot of the upstreams; it does not track upstream updates.

Thanks.