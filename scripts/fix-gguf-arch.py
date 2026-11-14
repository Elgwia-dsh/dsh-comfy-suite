"""给缺元数据的 GGUF 补一条 general.architecture（不碰数据区）。

背景：<ComfyUI>/models/diffusion_models/Qwen-Image-2.1-Turbo-AD-Q6_K.gguf 的 tensor 名是 ComfyUI 格式
（model.diffusion_model.*），但 kv_count = 0 —— 没有 general.architecture。
ComfyUI-GGUF 的 loader.py 因此在 arch_str is None 分支里退回 detect_arch()，
猜不出架构就抛 "This model is not currently supported - (Unknown model architecture!)"。

做法：把一条 {"general.architecture": "<arch>"} 插到 kv 区末尾，其余内容
（tensor info 表 + 数据区）按原字节整体后移；tensor info 里的 offset 是相对
数据区起点的，所以不用改。数据区起点重新按 32 字节对齐。

用法：python gguf_add_arch.py <src> <dst> [arch]
"""
import struct
import sys
import os

ALIGN = 32


def parse(path):
    f = open(path, 'rb')
    magic = f.read(4)
    if magic != b'GGUF':
        raise SystemExit(f'不是 GGUF: {magic!r}')
    version = struct.unpack('<I', f.read(4))[0]
    n_tensors = struct.unpack('<Q', f.read(8))[0]
    n_kv = struct.unpack('<Q', f.read(8))[0]
    # kv 区：本文件 n_kv = 0，但为了通用还是按格式跳
    kvs = []
    for _ in range(n_kv):
        ln = struct.unpack('<Q', f.read(8))[0]
        key = f.read(ln).decode('utf-8')
        vtype = struct.unpack('<I', f.read(4))[0]
        if vtype != 8:
            raise SystemExit(f'只支持字符串 kv，遇到 {key} type={vtype}')
        lv = struct.unpack('<Q', f.read(8))[0]
        val = f.read(lv).decode('utf-8')
        kvs.append((key, val))
    tensor_infos = []
    for _ in range(n_tensors):
        ln = struct.unpack('<Q', f.read(8))[0]
        name = f.read(ln)
        nd = struct.unpack('<I', f.read(4))[0]
        dims = [struct.unpack('<Q', f.read(8))[0] for _ in range(nd)]
        ttype = struct.unpack('<I', f.read(4))[0]
        off = struct.unpack('<Q', f.read(8))[0]
        tensor_infos.append((name, dims, ttype, off))
    info_end = f.tell()
    data_start = (info_end + ALIGN - 1) // ALIGN * ALIGN
    size = os.path.getsize(path)
    return {
        'version': version, 'n_tensors': n_tensors, 'kvs': kvs,
        'tensor_infos': tensor_infos, 'info_end': info_end,
        'data_start': data_start, 'size': size,
    }


def kv_bytes(key, value):
    k = key.encode('utf-8')
    v = value.encode('utf-8')
    return (struct.pack('<Q', len(k)) + k + struct.pack('<I', 8)
            + struct.pack('<Q', len(v)) + v)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    arch = sys.argv[3] if len(sys.argv) > 3 else 'qwen_image'
    info = parse(src)
    print(f'源: {src}')
    print(f'  version={info["version"]} tensors={info["n_tensors"]} kv={len(info["kvs"])}')
    print(f'  tensor info 结束于 {info["info_end"]}, 数据区起点 {info["data_start"]}, 文件 {info["size"]}')
    if any(k == 'general.architecture' for k, _ in info['kvs']):
        raise SystemExit('已经有 general.architecture，不用补')
    extra = kv_bytes('general.architecture', arch)
    new_info_end = info['info_end'] + len(extra)
    new_data_start = (new_info_end + ALIGN - 1) // ALIGN * ALIGN
    pad = new_data_start - new_info_end
    print(f'  插入 {extra!r}')
    print(f'  新数据区起点 {new_data_start}（原 {info["data_start"]}，位移 {new_data_start - info["data_start"]} 字节，填充 {pad}）')

    tmp = dst + '.tmp'
    with open(src, 'rb') as f, open(tmp, 'wb') as out:
        f.seek(0, 0)
        f.read(4)                     # magic
        f.read(4)                     # version
        f.read(8)                     # n_tensors
        f.read(8)                     # n_kv（旧值 0）
        # 新头
        out.write(b'GGUF')
        out.write(struct.pack('<I', info['version']))
        out.write(struct.pack('<Q', info['n_tensors']))
        out.write(struct.pack('<Q', len(info['kvs']) + 1))
        # 原有 kv（本文件没有）+ 新增那条
        for key, val in info['kvs']:
            out.write(kv_bytes(key, val))
        out.write(extra)
        # tensor info 表：原字节复制
        f.seek(24 + sum(len(kv_bytes(k, v)) for k, v in info['kvs']))
        out.write(f.read(info['info_end'] - f.tell()))
        # 对齐填充
        out.write(b'\x00' * pad)
        # 数据区：从原数据起点整段搬到新数据起点
        f.seek(info['data_start'])
        copied = 0
        while True:
            chunk = f.read(64 * 1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            copied += len(chunk)
        print(f'  数据区复制 {copied / 1024**3:.2f} GB')
    os.replace(tmp, dst)
    check = parse(dst)
    print(f'完成: {dst}  ({os.path.getsize(dst) / 1024**3:.2f} GB, kv={len(check["kvs"])}, '
          f'kv[0]={check["kvs"][0] if check["kvs"] else None}, tensors={check["n_tensors"]})')


if __name__ == '__main__':
    main()