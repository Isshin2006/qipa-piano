'use strict';
/* 全端点测试(不播放/不碰注入器):手机曲库+直读+选调+裁剪+缓存 */
const http = require('http');
function call(method, path, body, timeout) {
    return new Promise(res => {
        const data = body ? JSON.stringify(body) : null;
        const r = http.request({ hostname: '127.0.0.1', port: 8766, path, method,
            headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
            timeout: timeout || 30000 }, x => {
            let chunks = [];
            x.on('data', d => chunks.push(d));
            x.on('end', () => {
                const buf = Buffer.concat(chunks);
                let j = null; try { j = JSON.parse(buf.toString('utf8')); } catch (e) {}
                res({ code: x.statusCode, json: j, raw: buf });
            });
        });
        r.on('error', e => res({ code: 0, err: e.message }));
        r.on('timeout', () => { r.destroy(); res({ code: 0, err: 'timeout' }); });
        if (data) r.write(data);
        r.end();
    });
}
(async () => {
    let fail = 0;
    const ok = (name, cond, extra) => { console.log((cond ? '✓ ' : '✗ ') + name + (extra ? ' | ' + extra : '')); if (!cond) fail++; };

    /* 1 状态 */
    const st = await call('GET', '/api/status');
    ok('status', st.code === 200 && st.json.device, JSON.stringify({ dev: st.json && st.json.device, inj: st.json && st.json.injectorReady }));

    /* 2 手机曲库列表 */
    const pl = await call('GET', '/api/phone/list');
    ok('phone/list', pl.code === 200 && pl.json.ok && pl.json.songs.length > 0,
        pl.json && pl.json.songs ? (pl.json.songs.length + ' 首, txt=' + pl.json.songs.filter(s => s.kind === 'txt').length + ' midi=' + pl.json.songs.filter(s => s.kind === 'midi').length) : (pl.err || ''));
    const firstTxt = pl.json.songs.find(s => s.kind === 'txt');
    const firstMid = pl.json.songs.find(s => s.kind === 'midi' && s.dir.includes('QipaPiano'));

    /* 3 手机直读 txt */
    const ft = await call('GET', '/api/phone/file?path=' + encodeURIComponent(firstTxt.path));
    ok('phone/file txt', ft.code === 200 && ft.json.ok && ft.json.text && ft.json.text.length > 20,
        ft.json ? (ft.json.name + ' ' + ft.json.text.length + '字') : (ft.err || pl.err));
    /* 含 @from/@to 的 txt 直读 */
    const clipTxt = pl.json.songs.find(s => /裁剪/.test(s.name));
    if (clipTxt) {
        const fc = await call('GET', '/api/phone/file?path=' + encodeURIComponent(clipTxt.path));
        ok('phone/file 裁剪txt', fc.code === 200 && fc.json.ok, fc.json ? fc.json.name : '');
    }

    /* 4 手机直读 midi + 解析(自动选调显示) */
    const fm = await call('GET', '/api/phone/file?path=' + encodeURIComponent(firstMid.path));
    ok('phone/file midi', fm.code === 200 && fm.json.ok && fm.json.b64.length > 100,
        fm.json ? (fm.json.name + ' b64=' + fm.json.b64.length) : '');
    if (fm.json && fm.json.ok) {
        const p1 = await call('POST', '/api/midi/parse', { name: fm.json.name, b64: fm.json.b64, tracks: [{ on: true, tonic: 'auto' }, { on: true, tonic: 'auto' }] });
        ok('parse midi(auto)', p1.code === 200 && p1.json.ok,
            p1.json ? ('dur=' + p1.json.durationSec + 's tracks=' + JSON.stringify(p1.json.tracks.map(t => t.name + ':' + (t.tonicAuto || '-')))) : (p1.json && p1.json.err));
        const t0auto = p1.json.tracks[0].tonicAuto;
        /* 手动换调 C */
        const p2 = await call('POST', '/api/midi/parse', { name: fm.json.name, b64: fm.json.b64, tracks: [{ on: true, tonic: 'C' }, { on: true, tonic: 'auto' }] });
        ok('parse midi(手动C)', p2.code === 200 && p2.json.ok, p2.json ? 'dur=' + p2.json.durationSec : '');
        ok('tonicAuto 有值', !!t0auto, 't0.auto=' + t0auto);
        /* midi 裁剪 30s~60s */
        const p3 = await call('POST', '/api/midi/parse', { name: fm.json.name, b64: fm.json.b64, cutA: 30000, cutB: 60000 });
        ok('parse midi(cut 30-60s)', p3.code === 200 && p3.json.ok && p3.json.durationSec > 25 && p3.json.durationSec < 40,
            p3.json ? 'dur=' + p3.json.durationSec + 's' : '');
    }

    /* 5 txt 起拍止拍覆盖(拍 5~10) */
    if (ft.json && ft.json.ok) {
        const pt = await call('POST', '/api/midi/parse', { name: firstTxt.name, txt: ft.json.text, startBeat: 5, endBeat: 10 });
        ok('parse txt(起5止10拍)', pt.code === 200 && pt.json.ok && pt.json.durationSec >= 2 && pt.json.durationSec <= 8,
            pt.json ? 'dur=' + pt.json.durationSec + 's' : '');
        /* 边界:止拍≤起拍 → 有防护不炸(老播放器同款 1ms 窗) */
        const pe = await call('POST', '/api/midi/parse', { name: firstTxt.name, txt: ft.json.text, startBeat: 10, endBeat: 5 });
        ok('parse txt(止拍<起拍 不炸)', pe.code === 200 && pe.json.ok !== undefined,
            pe.json ? ('ok=' + pe.json.ok + ' chords=' + (pe.json.chords || 0)) : (pe.err || pe.body));
    }

    /* 5b 边界:完全不传 tracks 解析 midi(shifts.some 回归) */
    if (fm.json && fm.json.ok) {
        const pn = await call('POST', '/api/midi/parse', { name: 'notracks', b64: fm.json.b64 });
        ok('parse midi(无tracks)', pn.code === 200 && pn.json.ok, pn.json ? 'dur=' + pn.json.durationSec : (pn.json && pn.json.err));
    }

    /* 5c keyup-all 端点(无按键时应 ok released=0,不炸) */
    const ka = await call('POST', '/api/keyup-all');
    ok('keyup-all', ka.code === 200 && ka.json.ok && ka.json.released === 0, JSON.stringify(ka.json));

    /* 6 缓存读写 */
    const c1 = await call('POST', '/api/cache', { name: '测试曲', mode: 'midi', cutA: 5000, posMs: 42000 });
    ok('cache POST', c1.code === 200 && c1.json.ok);
    const c2 = await call('GET', '/api/cache?name=' + encodeURIComponent('测试曲'));
    ok('cache GET', c2.code === 200 && c2.json.entry && c2.json.entry.posMs === 42000 && c2.json.entry.cutA === 5000,
        JSON.stringify(c2.json.entry));
    const c3 = await call('POST', '/api/cache', { name: '测试曲', posMs: 0 });
    ok('cache 清进度', c3.code === 200 && (await call('GET', '/api/cache?name=' + encodeURIComponent('测试曲'))).json.entry.posMs === 0);

    /* 7 手机脚本缓存识别(预期 ok:false + 提示) */
    const pc = await call('GET', '/api/phone/cache');
    console.log('ℹ phone/cache: ' + (pc.json && pc.json.ok ? '发现备份json! ' + pc.json.from : (pc.json ? pc.json.err.slice(0, 60) : '')));

    console.log('\n=== ' + (fail ? fail + ' 项失败 ✗' : '全部通过 ✓') + ' ===');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.log('测试脚本异常: ' + e.message); process.exit(1); });
