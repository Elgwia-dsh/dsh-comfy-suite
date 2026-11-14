/**
 * dsh-comfy-suite — 提示词衣柜单元测试
 * ============================================================================
 * 钉住的是**引擎承诺**，不是具体文案：
 *
 *   · 档位闸门：任何随机抽取都不能出现高于目标档位的选项（唯一准入点）。
 *   · 可复现：同 seed 同参数 → prompt / 报告 / 选中项逐字一致。
 *   · 三层权重：0 = 关闭、3 = 必现，且权重不能越过闸门。
 *   · 场景锁定：锁住的字段一定出现，超档场景一定拒绝。
 *   · 上限裁剪：必现项与锁定项不裁，正文条款数不超过上限（除非显式项已超）。
 *   · 数据自洽：场景声明的档位 ≥ 它锁定的每个选项的档位。
 *
 * 跑法：node test-wardrobe.mjs
 */
import assert from 'node:assert/strict';

const {
    crc32, deriveSeed, draw, formatMeta, levelMeta, loadWardrobe, makeRng,
    parseWeights, reloadWardrobe, resolveLevel,
} = await import(new URL('./lib/wardrobe.js', import.meta.url));

reloadWardrobe();
const model = await loadWardrobe();

const optionOf = (pick) => {
    const layer = model.layers.find((entry) => entry.id === pick.layer);
    const field = layer.fields.find((entry) => entry.key === pick.field);
    return field.options.find((entry) => entry.label === pick.label);
};

/* ------------------------------------------------------------------ 数据 ---- */

assert.equal(model.issues.length, 0, `数据校验不该有问题：${model.issues.join('；')}`);
assert.ok(model.layers.length >= 10, `图层太少：${model.layers.length}`);
assert.ok(model.scenes.length >= 12, `场景太少：${model.scenes.length}`);

for (const scene of model.scenes) {
    for (const lock of scene.locks) {
        assert.ok(lock.option.level <= scene.level,
            `场景 ${scene.id} 锁定了 L${lock.option.level} 的「${lock.option.label}」，但场景声明 L${scene.level}`);
    }
}
console.log(`ok - 数据自洽：${model.layers.length} 段 / ${model.scenes.length} 场景 / 0 校验问题`);

// 每条选项都能被某个档位选中（除刻意登记为 gender/mode 限定的），防止"死词条"。
const dead = [];
for (const layer of model.layers) {
    for (const field of layer.fields) {
        for (const option of field.options) {
            const scope = model.optionScopes.get(`${field.level}=${option.label}`);
            if (scope !== undefined) continue; // 限定项单独由 gender/mode 用例覆盖
            if (option.level > 4) dead.push(option.label);
        }
    }
}
assert.deepEqual(dead, [], `有选项的档位超出 0–4：${dead.join('、')}`);
console.log('ok - 选项档位全部落在 0–4');

/* -------------------------------------------------------------- 档位闸门 ---- */

for (let level = 0; level <= 4; level += 1) {
    let leaks = 0;
    for (let seed = 0; seed < 300; seed += 1) {
        const result = draw(model, { level, seed });
        for (const pick of result.picks) {
            const option = optionOf(pick);
            if (option.level > level) leaks += 1;
        }
    }
    assert.equal(leaks, 0, `L${level} 出现 ${leaks} 次越界`);
}
console.log('ok - 五档 × 300 次：越界 0（闸门在候选池收敛，不是抽完再筛）');

// 权重再大也不能把超档选项拉回来。
const gatedByWeight = draw(model, {
    level: 0, seed: 5, weights: { 'outfit.top=蕾丝内衣': 3, 'identity.expression=情迷': 3 },
});
assert.equal(gatedByWeight.prompt.includes('蕾丝内衣'), false);
assert.equal(gatedByWeight.prompt.includes('迷离'), false);
console.log('ok - 权重不能越过闸门（L2 选项在 L0 下给到 3.0 也进不来）');

/* ------------------------------------------------------------ 可复现性 ---- */

const a = draw(model, { level: 2, seed: 20261112, scene: 'auto', sceneChance: 1 });
const b = draw(model, { level: 2, seed: 20261112, scene: 'auto', sceneChance: 1 });
assert.equal(a.prompt, b.prompt, '同 seed 的 prompt 必须逐字一致');
assert.equal(a.report, b.report, '同 seed 的报告必须逐字一致');
assert.deepEqual(a.picks.map((entry) => entry.label), b.picks.map((entry) => entry.label));
assert.equal(a.scene?.id, b.scene?.id, '场景也必须由同一颗种子决定');
const c = draw(model, { level: 2, seed: 20261113, scene: 'auto', sceneChance: 1 });
assert.notEqual(a.prompt, c.prompt, '不同 seed 应该抽出不同结果');
console.log(`ok - 同 seed 逐字复现（含场景：${a.scene?.zh ?? '无'}）`);

// 随机种子（不传）每次都不同，但要如实回传，才能"记下来复现"。
const r1 = draw(model, { level: 1 });
const r2 = draw(model, { level: 1 });
assert.ok(Number.isInteger(r1.seed) && r1.seed >= 0);
assert.notEqual(r1.seed, r2.seed);
const replay = draw(model, { level: 1, seed: r1.seed });
assert.equal(replay.prompt, r1.prompt, '回填随机种子必须复现');
console.log(`ok - 随机种子回传并可回放（${r1.seed}）`);

/* ------------------------------------------------------------ 三层权重 ---- */

// 段权重 0：整段关闭。
const layerOff = draw(model, { level: 2, seed: 3, weights: { outfit: 0 } });
assert.equal(layerOff.picks.some((pick) => pick.layer === 'outfit'), false);
console.log('ok - 段权重 0 关闭整段');

// 字段权重 0：该字段永不出现。
const fieldOff = draw(model, { level: 2, seed: 3, weights: { 'identity.hair': 0 } });
assert.equal(fieldOff.picks.some((pick) => pick.field === 'hair'), false);
console.log('ok - 字段权重 0 关闭该字段');

// 字段权重 3：必现（多跑几次确认不是运气）。
for (let seed = 0; seed < 20; seed += 1) {
    const forcedField = draw(model, { level: 2, seed, weights: { 'camera.shot': 3 } });
    assert.ok(forcedField.picks.some((pick) => pick.field === 'shot'), `seed ${seed} 缺 camera.shot`);
}
console.log('ok - 字段权重 3 = 必现（不乘概率，绕开密度）');

// 选项权重 0：永不选中；选项权重 3：必选中。
for (let seed = 0; seed < 20; seed += 1) {
    // 用一个**不带性别限定**的选项：带 gender 的选项会被性别收窄挡掉，
    // 那是另一条正确行为，不该混进权重用例里。
    const optionOff = draw(model, { level: 2, seed, weights: { 'identity.eyes=灰蓝眼': 0 } });
    assert.equal(optionOff.picks.some((pick) => pick.label === '灰蓝眼'), false);
    const optionOn = draw(model, { level: 2, seed, weights: { 'identity.eyes=灰蓝眼': 3 } });
    assert.ok(optionOn.picks.some((pick) => pick.label === '灰蓝眼'), `seed ${seed} 没选中必现选项`);
}
console.log('ok - 选项权重 0 = 禁用，3 = 必选中');

// 认不出的权重键要进报告，不能静默吞掉。
const typo = draw(model, { level: 0, seed: 1, weights: { 'identity.hair': 'deep' } });
assert.match(typo.report, /认不出的权重键/);
console.log('ok - 非法权重进报告');

/* -------------------------------------------------------------- 场景锁定 ---- */

const scene = model.scenes.find((entry) => entry.id === 'sc-rain-neon');
const scened = draw(model, { level: 0, seed: 42, scene: 'sc-rain-neon' });
for (const lock of scene.locks) {
    const hit = scened.picks.find((pick) => `${pick.layer}.${pick.field}` === lock.key);
    assert.ok(hit !== undefined, `场景锁定 ${lock.key} 没有生效`);
    assert.equal(hit.label, lock.option.label);
    assert.equal(hit.source, 'scene');
}
console.log(`ok - 场景锁定 ${scene.locks.length} 个字段全部生效（${scene.zh}）`);

// 超档场景必须拒绝并说明，而不是悄悄降级。
const tooHigh = draw(model, { level: 0, seed: 1, scene: 'sc-onsen-night' });
assert.equal(tooHigh.scene, undefined);
assert.match(tooHigh.report, /高于当前档位/);
console.log('ok - 超档场景被拒绝并写明原因');

// 未锁的字段照常随机：同一场景不同 seed 的正文不同。
const s1 = draw(model, { level: 0, seed: 100, scene: 'sc-rain-neon' });
const s2 = draw(model, { level: 0, seed: 200, scene: 'sc-rain-neon' });
assert.notEqual(s1.prompt, s2.prompt, '场景不该把整段写死');
console.log('ok - 场景只锁字段，其余照常随机');

/* ---------------------------------------------------------- 显式项抬档 ---- */

const raised = draw(model, {
    level: 0, seed: 9, forced: { 'outfit.top': '蕾丝内衣' },
});
assert.ok(raised.level >= 2, '显式点了 L2 项，整张图应被抬到 L2');
assert.match(raised.report, /自动上调/);
assert.ok(raised.picks.some((pick) => pick.label === '蕾丝内衣'));
console.log('ok - 显式指定越档项 → 整张图抬档并写明');

// 但"抬档"必须只由显式项触发；随机抽样永不抬档。
for (let seed = 0; seed < 100; seed += 1) {
    assert.equal(draw(model, { level: 0, seed }).level, 0);
}
console.log('ok - 随机抽样永不抬档');

/* -------------------------------------------------------------- 连体款 ---- */

let seenOnePiece = 0;
for (let seed = 0; seed < 200; seed += 1) {
    const onePiece = draw(model, { level: 0, seed, gender: 'female', weights: { 'outfit.top=连身长裙': 3 } });
    assert.ok(onePiece.picks.some((pick) => pick.label === '连身长裙'));
    assert.equal(onePiece.picks.some((pick) => pick.field === 'bottom'), false, '连身长裙还在抽下装');
    seenOnePiece += 1;
}
assert.ok(seenOnePiece > 0);
console.log('ok - 连体款压掉下装（omit 规则）');

/* -------------------------------------------------------------- 上限裁剪 ---- */

const tight = draw(model, { level: 2, seed: 77, tagCap: 8 });
const body = tight.picks.filter((pick) => pick.layer !== 'negative');
assert.ok(body.length <= 8 || body.every((pick) => pick.required || pick.protected),
    `上限 8 时正文还有 ${body.length} 条，且有可裁项`);
for (const pick of tight.picks) {
    if (pick.layer === 'scene') assert.ok(pick.protected === true, '场景锁定项必须受保护');
}
console.log(`ok - 上限裁剪保留了必现/锁定项（正文 ${body.length} 条）`);

const noCap = draw(model, { level: 2, seed: 77, tagCap: 0 });
assert.ok(noCap.picks.length >= tight.picks.length);
console.log('ok - tagCap=0 不限条数');

/* ---------------------------------------------------------- 模式与性别 ---- */

const objectMode = draw(model, { level: 2, seed: 6, mode: 'object', subject: '一只橘猫坐在窗台' });
assert.equal(objectMode.picks.some((pick) => ['identity', 'outfit', 'pose'].includes(pick.layer)), false);
assert.ok(objectMode.prompt.startsWith('一只橘猫坐在窗台'));
console.log('ok - object 模式不抽人物段落，主体沿用用户给的');

const sceneMode = draw(model, { level: 2, seed: 6, mode: 'scene' });
assert.equal(sceneMode.picks.some((pick) => ['identity', 'outfit', 'pose'].includes(pick.layer)), false);
assert.ok(sceneMode.picks.some((pick) => pick.field === 'place'), '空镜模式必须有地点');
console.log('ok - scene 模式必须出地点，且无人物');

// 性别收窄：男性主体不该抽到"低盘发/双麻花辫"这类女性项。
for (let seed = 0; seed < 60; seed += 1) {
    const male = draw(model, { level: 3, seed, gender: 'male' });
    assert.equal(male.picks.some((pick) => ['低盘发', '双麻花辫', '比基尼上衣', '蕾丝内衣'].includes(pick.label)), false,
        `seed ${seed} 男性抽到了女性限定项`);
}
// 不指定性别时不过滤（猜错比不猜更糟）。
const unknown = draw(model, { level: 3, seed: 12 });
assert.ok(unknown.prompt.length > 0);
console.log('ok - 性别收窄只作用于明确指定的场合');

/* -------------------------------------------------------------- 其它 ---- */

assert.equal(resolveLevel('L2'), 2);
assert.equal(resolveLevel('明确'), 2);
assert.equal(resolveLevel(3), 3);
assert.equal(resolveLevel('乱七八糟', 1), 1);
console.log('ok - 档位别名解析');

// 种子派生必须跨进程稳定（crc32 而不是带盐的 hash）。
assert.equal(deriveSeed('a', 'b'), crc32('a|b'));
assert.equal(makeRng(42)(), makeRng(42)());
assert.equal(crc32('dsh-comfy-suite'), crc32('dsh-comfy-suite'));
console.log('ok - 种子派生与 PRNG 都是确定性的');

const weights = parseWeights({ outfit: 0.5, 'outfit.top': 3, 'outfit.top=蕾丝内衣': 0, bogus: 'x' });
assert.equal(weights.layers.get('outfit'), 0.5);
assert.equal(weights.fields.get('outfit.top'), 3);
assert.equal(weights.options.get('outfit.top=蕾丝内衣'), 0);
assert.equal(weights.unknown.length, 1);
console.log('ok - 权重解析：段 / 字段 / 选项三种键都认，非法键单独记');

const meta = formatMeta(model);
assert.match(meta, /场景搭配/);
assert.match(meta, /档位：L0/);
console.log('ok - meta 输出包含档位与场景清单');

// 负面词永远可用：即使抽到负面条目失败，也有数据兜底。
for (let seed = 0; seed < 20; seed += 1) {
    const result = draw(model, { level: 0, seed, weights: { negative: 0 } });
    assert.ok(result.negative.length > 0, '负面词不能为空');
}
console.log('ok - 负面词始终有兜底');

const label = levelMeta(2, model.levels);
assert.equal(label.num, 2);
assert.ok(label.label.length > 0);
console.log(`ok - 档位标签：L${label.num} ${label.label}`);

console.log(`\nOK wardrobe tests passed（${model.layers.length} 段 / ${model.scenes.length} 场景）`);