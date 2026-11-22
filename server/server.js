/**
 * ============================================================================
 *  奇葩钢琴 Web 版 · server.js
 * ============================================================================
 *  打开浏览器就能弹:HTML 钢琴界面 → 本服务 → adb → 手机注入器
 *  零安装:Node(已有)+ adb(已有)+ 注入器 jar(老项目已构建,自动推)
 *
 *  能力:
 *   - HTML 15 键钢琴,鼠标/PC 键盘弹奏,按住=真长按(多指针真重叠=和弦)
 *   - MIDI 导入自动演奏(复用老 qipa-pc.js 的十指编排管线)
 *   - 截图标定(点哪哪是键)
 *
 *  通道:注入器 jar(app_process,shell 权限自带注入,免 root)
 *   协议:D pid x y / U pid x y / W ms / Q;就绪信号 ".ready"
 * ============================================================================
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile, execFileSync, spawn } = require('child_process');
const { transposeMidi } = require('./_transpose.js');
const Tonic = require('./_tonic.js');
const TONIC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];   // 与 _tonic.nameToMidi 一致
/* 二进制 adb 输出(exec-out cat 等,不走 utf8 编码防损坏) */
function adbBuf(args) {
    return new Promise((resolve, reject) => {
        execFile(ADB, args, { encoding: 'buffer', timeout: 30000, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) reject(Object.assign(err, { stderr }));
            else resolve(stdout);
        });
    });
}
/* 本机歌曲缓存:每首记 起拍止拍(txt,拍)/起音止音(midi,ms)/进度/音轨配置,持久化跨重启 */
function loadSongCache() { try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (e) { return {}; } }
function saveSongCache(cc) { try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cc, null, 1)); } catch (e) {} }

const HERE = __dirname;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8766;
const ADB_CANDIDATES = [
    path.join(HERE, 'adb', 'qipa_adb.exe'),   /* 仓库自带 37.0.3 改名版(躲开按映像名杀 adb.exe 的防护软件) */
    path.join(HERE, 'adb', 'adb.exe'),
    'D:/pc_piano/adb35/qipa_adb.exe',
    'D:/pc_piano/adb35/adb.exe',
    path.join(process.env.APPDATA || '', 'Vrzwk', 'QuestTool', 'adb', 'adb.exe'),
    'C:/adb/platform-tools/adb.exe',
    'adb'
];
const JAR_CANDIDATES = [
    path.join(HERE, '..', 'injector', 'QipaInjector.jar'),   // 仓库内(首选)
    path.join(process.env.USERPROFILE || '', 'Downloads', 'pc_player', 'build_kit', 'QipaInjector.jar')
];
const JAR = JAR_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || JAR_CANDIDATES[0];
function findCoreScript() {
    const cands = [
        path.join(HERE, '..', 'phone', 'QipaPiano.js'),   // 仓库内(首选,开源自包含)
        path.join(process.env.USERPROFILE || '', 'Downloads', 'QipaPiano_最终版.js'),
        path.join(process.env.USERPROFILE || '', 'Downloads', 'QipaPiano_最终版x.js')
    ];
    for (const p of cands) if (fs.existsSync(p)) return p;
    try {
        const D = path.join(process.env.USERPROFILE || '', 'Downloads');
        const legacy = fs.readdirSync(D).filter(x => /^QipaPiano.*.js$/i.test(x));
        if (legacy.length) return D + '/' + legacy[0];
    } catch (e) {}
    throw new Error('找不到核心脚本(仓库 phone/QipaPiano.js)');
}
const SCRIPT = findCoreScript();
const CALIB_PATH = path.join(HERE, 'calib.json');
const CACHE_PATH = path.join(HERE, 'songcache.json');

const ADB = ADB_CANDIDATES.find(p => { try { return fs.existsSync(p) || p === 'adb'; } catch (e) { return false; } });

/* ---------- 注入器桥 ---------- */
const inj = {
    child: null, ready: false, starting: null,
    freePids: Array.from({ length: 10 }, (_, i) => i),
    keyPid: new Map()      // key -> pid(手动按住中的键)
};
function adb(args, opt) {
    return new Promise((resolve, reject) => {
        execFile(ADB, args, Object.assign({ encoding: 'utf8', timeout: 20000 }, opt), (err, stdout, stderr) => {
            if (err) reject(Object.assign(err, { stderr }));
            else resolve(stdout);
        });
    });
}
/* 设备列表缓存(2s):所有调用方共用一次 adb 轮询,不再各起各的进程。
 * 断连/上线即时记日志+推 SSE(网页状态立刻变),USB 心跳 20s 打真实流量防挂起 */
let _devCache = { list: null, ts: 0 };
let _devFirstPoll = true;
function adbDevices() {
    if (_devCache.list && Date.now() - _devCache.ts < 2000) return Promise.resolve(_devCache.list);
    return adb(['devices']).then(out => {
        const list = out.split(/\r?\n/).slice(1).filter(l => l.trim()).map(l => l.split('\t')[0]);
        if (!_devFirstPoll) {
            const prev = _devCache.list || [];
            const lost = prev.filter(d => list.indexOf(d) < 0);
            const back = list.filter(d => prev.indexOf(d) < 0);
            if (lost.length) { slog('[设备] 断开: ' + lost.join(',')); sse({ t: 'log', msg: '⚠ 设备断开: ' + lost.join(',') }); sse({ t: 'injector' }); }
            if (back.length) { slog('[设备] 上线: ' + back.join(',')); sse({ t: 'log', msg: '✓ 设备上线: ' + back.join(',') }); sse({ t: 'injector' }); adb(['-s', back[0], 'reverse', 'tcp:8766', 'tcp:8766']).catch(() => {}); }
        }
        _devFirstPoll = false;
        _devCache = { list, ts: Date.now() };
        return list;
    }).catch(e => {
        if (!_devFirstPoll && _devCache.list && _devCache.list.length) slog('[设备] adb 查询失败: ' + e.message);
        _devFirstPoll = false;
        _devCache = { list: [], ts: Date.now() };
        return [];
    });
}
/* USB 心跳:20s 一次真实流量(adb devices 只查本地服务不碰手机,必须 shell 才走 USB)
 * 顺带维持 adb reverse:手机访问 127.0.0.1:8766 直达本服务器(PC模式通道) */
setInterval(() => {
    const d = (_devCache.list || [])[0];
    if (!d) return;
    adb(['-s', d, 'shell', 'echo', 'ka']).catch(() => {});
    adb(['-s', d, 'reverse', 'tcp:8766', 'tcp:8766']).catch(() => {});
}, 20000);
function screenSize(dev) {
    return adb(['-s', dev, 'shell', 'wm', 'size']).then(out => {
        const m = /(\d+)x(\d+)/.exec(out);
        return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
    });
}
function injLine(line) {
    if (!inj.child || !inj.ready) throw new Error('注入器未就绪');
    inj.child.stdin.write(line + '\n');
}
function ensureInjector(dev) {
    if (inj.ready) return Promise.resolve();
    if (inj.starting) return inj.starting;
    inj.starting = (async () => {
        if (!inj.pushed) {
            await adb(['-s', dev, 'push', JAR, '/data/local/tmp/qipa_injector.jar']);
            inj.pushed = true;
        }
        sse({ t: 'log', msg: '注入器已推送,启动中…' });
        const child = spawn(ADB, ['-s', dev, 'shell',
            'CLASSPATH=/data/local/tmp/qipa_injector.jar app_process / com.qipa.Injector'],
            { stdio: ['pipe', 'pipe', 'pipe'] });
        inj.child = child;
        inj.ready = false;
        let buf = '';
        child.stdout.on('data', d => {
            buf += d.toString();
            const diag = d.toString().trim();
            if (diag) slog('[注入器] ' + diag.slice(0, 300));
            if (!inj.ready && buf.indexOf('.ready') >= 0) {
                inj.ready = true;
                inj.starting = null;
                sse({ t: 'injector', state: 'ready' });
                sse({ t: 'log', msg: '注入器就绪 ✓' });
            }
        });
        child.stderr.on('data', d => {
            const s = d.toString();
            if (s.trim()) sse({ t: 'log', msg: '[注入器] ' + s.trim().slice(0, 200) });
        });
        child.on('exit', (c, sig) => {
            slog('[注入器退出] code=' + c + ' signal=' + (sig || '无') + ' play.active=' + play.active);
            inj.child = null; inj.ready = false; inj.starting = null;
            inj.keyPid.clear();
            if (play.active) {
                /* 播放中注入器死亡(USB/手机掉线)→ 记断点 + 自动续播待命 */
                play.pausedMs = curPos();
                play.autoResumePending = true;
                stopStream();
                sse({ t: 'play', state: 'paused', pos: play.pausedMs });
                sse({ t: 'log', msg: '⚠ 注入器中断(USB/手机掉线?)进度已记 @ ' + Math.round(play.pausedMs / 1000) + 's,设备回归后自动续播' });
            }
            sse({ t: 'injector', state: 'dead', code: c });
            slog('[注入器退出完毕] play.active=' + play.active + ' pausedMs=' + play.pausedMs);
        });
        await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('注入器 8 秒内未就绪')), 8000);
            const wait = setInterval(() => {
                if (inj.ready) { clearTimeout(t); clearInterval(wait); resolve(); }
            }, 100);
            child.on('exit', () => { clearTimeout(t); clearInterval(wait); reject(new Error('注入器提前退出')); });
        });
    })();
    return Promise.race([
        inj.starting.catch(e => { inj.starting = null; throw e; }),
        new Promise((_, rej) => setTimeout(() => {
            inj.starting = null; inj.ready = false;
            if (inj.child) { try { inj.child.kill(); } catch (e) {} inj.child = null; }
            rej(new Error('注入器准备超时(45s),请重试'));
        }, 45000))
    ]);
}

/* ---------- MIDI 引擎(复用老 pc_player 的 vm 抽取管线) ---------- */
let coreApi = null;
function loadCore() {
    if (coreApi) return coreApi;
    const lines = fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/);
    const secStarts = [];
    lines.forEach((l, i) => { if (/^ \*  \d+[a-z]?\. /.test(l)) secStarts.push([i - 1, l.trim()]); });
    const section = num => {
        const idx = secStarts.findIndex(s => new RegExp('^\\*  ' + num + '\\. ').test(s[1]));
        return [secStarts[idx][0], idx + 1 < secStarts.length ? secStarts[idx + 1][0] - 1 : lines.length - 1];
    };
    let core = 'function log(){};function toast(){};var files={readBytes:p=>require("fs").readFileSync(p),join:(a,b)=>a+"/"+b,write:()=>{},exists:()=>false};function ensureDirs(){};var GRID_OFFSET={dx:0,dy:0};';
    for (const n of ['1', '2', '4', '5', '6', '6b', '7', '9']) {
        const [a, b] = section(n);
        core += lines.slice(a, b + 1).join('\n') + '\n';
    }
    const ctx = { console, require, JSON, Math, Date, isFinite, parseFloat, parseInt, Infinity, NaN,
        setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0, clearTimeout: () => {} };   /* 脚本顶层定时器在 vm 里是空转桩 */
    vm.createContext(ctx);
    vm.runInContext(core + ';this.__api={CONFIG,parseMidi,ensureMidiParsed,midiToSong,parseTxtSong,resolveTrackTonic,pitchToIndex,countsOf,COL_X,ROW_Y,SCALE_ORDER,KEY_LABEL};', ctx, { filename: 'qipa_core.js' });
    coreApi = ctx.__api;
    return coreApi;
}

/* 默认键位(老项目实测百分比) */
const DEFAULT_CALIB = {
    cols: [0.3571, 0.4284, 0.4998, 0.5710, 0.6424],
    rows: [0.1713, 0.3288, 0.4863],
    keyRC: { '1': [0, 0], '2': [0, 1], '3': [0, 2], '4': [0, 3], '5': [0, 4], '6': [1, 0], '7': [1, 1], "1'": [1, 2], "2'": [1, 3], "3'": [1, 4], "4'": [2, 0], "5'": [2, 1], "6'": [2, 2], "7'": [2, 3], "1''": [2, 4] },
    offsets: { dx: 0, dy: 0 }
};
function loadCalib() {
    try {
        const c = JSON.parse(fs.readFileSync(CALIB_PATH, 'utf8'));
        return Object.assign({}, DEFAULT_CALIB, c);
    } catch (e) { return DEFAULT_CALIB; }
}

const MAX_FINGERS = 10;
function keyXYF(calib, screen, key) {
    const w = screen.w > screen.h ? screen.w : screen.h;
    const h = screen.w > screen.h ? screen.h : screen.w;
    if (calib.keyPct && calib.keyPct[key])
        return { x: Math.round(calib.keyPct[key][0] * w), y: Math.round(calib.keyPct[key][1] * h) };
    const rc = calib.keyRC[key];
    return { x: Math.round(calib.cols[rc[1]] * w + (calib.offsets.dx || 0)), y: Math.round(calib.rows[rc[0]] * h + (calib.offsets.dy || 0)) };
}
function compileTimeline(A, source, calib, screen, trackCfg, extra) {
    let entry;
    if (source.kind === 'txt') {
        /* txt 谱面(老脚本 parseTxtSong 同款):song.tracks 结构与 MIDI 内部一致,拍→毫秒换算
         * @from/@to 裁剪(老播放器 buildTimeline 同款):cutA/cutB 换算 ms,过滤 [cutA,cutB) 并平移 -cutA */
        const song = A.parseTxtSong(source.text);
        const bpm = song.bpm || 120;
        entry = { name: source.name || song.name || 'txt', bpm: bpm, speed: 1, loop: 1, startBeat: song.startBeat || 0, endBeat: song.endBeat != null ? song.endBeat : null, tracks: song.tracks };
        const sbBeat = extra && extra.startBeat != null ? +extra.startBeat : song.startBeat;
        const ebBeat = extra && extra.endBeat != null ? +extra.endBeat : song.endBeat;
        entry.startBeat = sbBeat || 0; entry.endBeat = ebBeat != null ? ebBeat : null;
        const cutA = (sbBeat || 0) / bpm * 60000;
        let cutB = ebBeat != null ? ebBeat / bpm * 60000 : Infinity;
        if (cutB <= cutA) cutB = cutA + 1;   /* 止拍≤起拍:退化成1ms窗防空时间轴(老播放器同款保护) */
        entry.tracks.forEach(t => {
            if (!t.events) return;
            const out = [];
            for (const e of t.events) {
                const ms = e.beat / bpm * 60000;
                if (ms < cutA || ms >= cutB) continue;
                out.push({ beat: ms - cutA, dur: (e.dur || 0) / bpm * 60000, keys: e.keys, ch: e.ch });
            }
            t.events = out;
        });
    } else {
        const tmp = path.join(HERE, '_upload_' + Date.now() + '.mid');   // 唯一路径:防引擎按路径命中解析缓存
        const shifts = (trackCfg || []).map(t => t.shift || 0);   /* 不传 tracks 也不炸(cannot read 'some' 真凶) */
        fs.writeFileSync(tmp, shifts.some(s => s) ? transposeMidi(source.buf, shifts) : source.buf);
        entry = { name: 'pc' + Date.now(), isMidiFile: true, path: tmp, speed: 1, loop: 1, startBeat: 0, endBeat: null, tracks: [] };
        A.ensureMidiParsed(entry);
    }
    if (trackCfg && trackCfg.length) entry.tracks.forEach((t, i) => { if (trackCfg[i] !== undefined) { t.on = !!trackCfg[i].on; if (trackCfg[i].tonic) t.tonic = trackCfg[i].tonic; } });
    /* 逐轨选调(老播放器同款):每轨原始音高 + 用户调 → pitchToIndex 重映射琴键
     * 仅 MIDI 源(txt 无原始音高,其 keys=简谱直接给定) */
    let rawAuto = null;
    if (source.kind === 'midi') {
    try { rawAuto = Tonic.extractNotesPerTrack(source.buf); } catch (e) { rawAuto = null; }
    entry.tracks.forEach((t, ti) => {
        const cfg = trackCfg && trackCfg[ti];
        if (!cfg || !cfg.tonic || cfg.tonic === 'auto') return;
        const raw = ((rawAuto && rawAuto.tracks[ti]) || { notes: [] }).notes.filter(n => n.on && n.ch !== 9);
        if (!raw.length) return;
        const rt = Tonic.resolveTrackTonic(raw.map(n => [0, 0, n.pitch]), cfg.tonic);
        const rawSorted = raw.slice().sort((a, b) => a.tick - b.tick);
        for (const e of t.events) {
            if (!e.keys || !e.keys.length) continue;
            const near = rawSorted.filter(n => Math.abs(n.tick - Math.round(e.beat * (rawAuto.division || 480) * 1000 / (rawAuto.tempoUs || 500000))) < 60).map(n => n.pitch);
            if (!near.length) {
                let bestN = null, bd = 1e9;
                for (const n of rawSorted) { const d = Math.abs(n.tick - Math.round(e.beat * (rawAuto.division || 480) * 1000 / (rawAuto.tempoUs || 500000))); if (d < bd) { bd = d; bestN = n; } }
                if (bestN) near.push(bestN.pitch);
            }
            if (near.length) e.keys = near.map(p => Tonic.pitchToIndex(p, rt.tonic, rt.baseOct).idx);
        }
    });
    }
    setTimeout(() => { try { fs.unlinkSync(tmp); } catch (e) {} }, 5000);   // 临时文件用完即删
    const tracks = entry.tracks.map((t, ti) => {
        const o = { name: t.name, on: !!t.on, notes: (t.events || []).filter(e => e.keys && e.keys.length).length };
        if (rawAuto && rawAuto.tracks[ti]) {
            const raw = rawAuto.tracks[ti].notes.filter(n => n.on && n.ch !== 9);
            if (raw.length) { const rt = Tonic.resolveTrackTonic(raw.map(n => [0, 0, n.pitch]), null); o.tonicAuto = TONIC_NAMES[((rt.tonic % 12) + 12) % 12]; }
        }
        return o;
    });
    const notes = [];
    for (const t of entry.tracks) {
        if (!t.on) continue;
        for (const e of t.events) {
            if (!e.keys || !e.keys.length) continue;
            notes.push({ t0: e.beat, t1: e.beat + (e.dur || 0), keyIdx: e.keys[0] });
        }
    }
    notes.sort((a, b) => a.t0 - b.t0);
    /* MIDI 直读裁剪(起音/止音,ms):过滤 [cutA,cutB) 并平移 -cutA(老播放器 cut 窗口同款) */
    if (source.kind === 'midi' && extra && (extra.cutA != null || extra.cutB != null)) {
        const cA = extra.cutA != null ? Math.max(0, +extra.cutA) : 0;
        const cB = extra.cutB != null && +extra.cutB > cA ? +extra.cutB : (notes.length ? notes[notes.length - 1].t1 + 1 : cA + 1);
        const clipped = [];
        for (const n of notes) if (n.t0 >= cA && n.t0 < cB) clipped.push({ t0: n.t0 - cA, t1: Math.min(n.t1, cB) - cA, keyIdx: n.keyIdx });
        notes.length = 0;
        for (const n of clipped) notes.push(n);
    }
    const w = screen.w > screen.h ? screen.w : screen.h;
    const h = screen.w > screen.h ? screen.h : screen.w;
    const keyXY = idx => keyXYF(calib, screen, A.SCALE_ORDER[idx]);
    const maxVoices = A.CONFIG.maxVoices || 4;
    const chords = [];
    for (const n of notes) {
        const last = chords[chords.length - 1];
        if (last && n.t0 - last.t0 <= 3) {
            last.dur = Math.max(last.dur, n.t1 - n.t0);
            if (last.keys.indexOf(n.keyIdx) < 0) last.keys.push(n.keyIdx);
        } else chords.push({ t0: n.t0, dur: Math.max(40, n.t1 - n.t0), keys: [n.keyIdx] });
    }
    for (const c of chords) if (c.keys.length > maxVoices) c.keys = c.keys.slice(0, maxVoices);
    const fingers = Array.from({ length: MAX_FINGERS }, (_, i) => ({ id: i, freeAt: 0 }));
    const events = [];
    /* minNoteGap 顺延(手机脚本 buildTimeline 同款):相邻和弦保持最小间隔,
     * 防止零间隙洪水把注入器/游戏打爆 */
    /* 最小间隔顺延(老播放器 buildTimeline 同款):以「前一个和弦的起点」为基准,不是终点。
     * 用终点会把延持重叠的和弦强制串行化,慢曲子(如 Interstellar)总时长被级联拉长近一倍 */
    const minGap = A.CONFIG.minNoteGap !== undefined ? A.CONFIG.minNoteGap : 30;
    for (let ci = 1; ci < chords.length; ci++) {
        const prevStart = chords[ci - 1].t0;
        if (chords[ci].t0 < prevStart + minGap) chords[ci].t0 = prevStart + minGap;
        if (chords[ci].dur < 40) chords[ci].dur = 40;
    }
    for (const c of chords) {
        const chosen = [];
        const pool = fingers.slice();
        for (const k of c.keys) {
            const f = pool.find(ff => ff.freeAt <= c.t0 + 1) || pool.reduce((a, b) => (a.freeAt <= b.freeAt ? a : b));
            pool.splice(pool.indexOf(f), 1);
            chosen.push({ f, xy: keyXY(k) });
        }
        const chordStart = Math.max(c.t0, Math.max(...chosen.map(ch => ch.f.freeAt)));
        const hold = Math.max(40, c.t0 + c.dur - chordStart);
        for (const ch of chosen) {
            events.push({ t: chordStart, type: 'D', pid: ch.f.id, x: ch.xy.x, y: ch.xy.y });
            events.push({ t: chordStart + hold, type: 'U', pid: ch.f.id, x: ch.xy.x, y: ch.xy.y });
            ch.f.freeAt = chordStart + hold;
        }
    }
    events.sort((a, b) => a.t - b.t || (a.type === 'U' ? -1 : 1) - (b.type === 'U' ? -1 : 1));
    const durationSec = Math.round((events.length ? events[events.length - 1].t : 0) / 1000);
    return { chords: chords.length, events, tracks, durationSec };
}

/* ---------- SSE 客户端广播 ---------- */
const sseClients = new Set();
const LOGF = path.join(HERE, '_server_log.txt');
function slog(m) {
    const line = '[' + new Date().toISOString().slice(11, 23) + '] ' + m;
    try { fs.appendFileSync(LOGF, line + '\n'); } catch (e) {}
    console.log(line);
}
function sse(obj) {
    const s = 'data: ' + JSON.stringify(obj) + '\n\n';
    for (const res of sseClients) { try { res.write(s); } catch (e) {} }
}

/* ---------- 播放状态(PC 节奏调度器) ---------- */
const play = {
    active: false, tl: null, events: [], idx: 0,
    baseMs: 0, startWall: 0, durationMs: 0,
    timers: [], posTimer: null, pausedMs: null, pushed: false, autoResumePending: false
};
function curPos() {
    if (!play.active) return play.pausedMs || 0;
    return Math.min(Math.round(play.baseMs + (Date.now() - play.startWall)), play.durationMs);
}
function stopStream() {
    play.timers.forEach(clearTimeout); play.timers = [];
    if (play.posTimer) { clearInterval(play.posTimer); play.posTimer = null; }
    play.active = false;
    if (inj.child) { try { inj.child.kill(); } catch (e) {} inj.child = null; inj.ready = false; }
}
function startStream(fromMs) {
    /* 软清理:只清定时器/进度上报,不杀注入器(播放流程刚 ensureInjector 启动它,
     * 误杀=一点播放注入器立马未启动的真凶)。需要杀注入器的调用方显式调 stopStream */
    play.timers.forEach(clearTimeout); play.timers = [];
    if (play.posTimer) { clearInterval(play.posTimer); play.posTimer = null; }
    play.events = play.tl.events;
    let i = 0;
    while (i < play.events.length && play.events[i].t < fromMs) i++;
    play.idx = i;
    play.baseMs = fromMs;
    play.startWall = Date.now();
    play.active = true;
    sse({ t: 'play', state: 'start', from: fromMs, durationSec: Math.round(play.durationMs / 1000) });
    /* 补起音(老播放器同款):跳转点之前按下、之后才抬起的音,立即按剩余时长补 D,
     * 否则跳转后要哑到下一个音才响 */
    const crossing = [];
    const active = [];
    for (const e of play.events) {
        if (e.t >= fromMs) break;
        if (e.type === 'D') active.push(e); else {
            const ai = active.findIndex(a => a.pid === e.pid);
            if (ai >= 0) active.splice(ai, 1);
        }
    }
    for (const a of active) crossing.push(a);
    for (const e of crossing) {
        try { injLine('D ' + e.pid + ' ' + e.x + ' ' + e.y); } catch (err) {}
    }
    const scheduleNext = () => {
        if (!play.active) return;
        if (play.idx >= play.events.length) {
            play.active = false;
            play.pausedMs = play.durationMs;
            sse({ t: 'play', state: 'done' });
            try { injLine('Q'); } catch (e) {}
            setTimeout(() => { if (inj.child) { try { inj.child.kill(); } catch (e) {} inj.child = null; inj.ready = false; } }, 300);
            return;
        }
        const e = play.events[play.idx];
        const targetWall = play.startWall + (e.t - play.baseMs);   // 绝对钟控,无累积漂移
        const delay = Math.max(0, targetWall - Date.now());
        const timer = setTimeout(() => {
            if (!play.active) return;
            try { injLine((e.type === 'D' ? 'D ' : 'U ') + e.pid + ' ' + e.x + ' ' + e.y); }
            catch (err) {
                sse({ t: 'log', msg: '注入失败: ' + err.message });
                play.pausedMs = Math.max(0, e.t - 1);   /* 断点=当前音 */
                play.autoResumePending = true;   /* 注入失败=注入器已死,设备回归自动续播(堵竞态空窗) */
                stopStream();
                sse({ t: 'play', state: 'paused', pos: play.pausedMs });
                return;
            }
            play.idx++;
            scheduleNext();
        }, delay);
        play.timers.push(timer);
    };
    scheduleNext();
    play.posTimer = setInterval(() => { if (play.active) sse({ t: 'progress', ms: curPos(), durationMs: play.durationMs }); }, 250);
}

/* ---------- HTTP 处理 ---------- */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', d => chunks.push(d));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}
function json(res, obj, code) {
    const s = JSON.stringify(obj);
    res.writeHead(code || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(s);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    slog('[请求] ' + req.method + ' ' + url.pathname);
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }
    try {
        /* SSE */
        if (url.pathname === '/api/events') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
            res.write('data: {"t":"hello"}\n\n');
            sseClients.add(res);
            req.on('close', () => sseClients.delete(res));
            return;
        }
        /* 设备/屏幕/注入器状态 */
        if (url.pathname === '/api/status') {
            const devs = await adbDevices();
            const dev = devs[0] || null;
            const screen = dev ? await screenSize(dev) : null;
            json(res, { device: dev, screen, injectorReady: inj.ready, calib: loadCalib() });
            return;
        }
        /* 手动按键 */
        if (url.pathname === '/api/keydown' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            await ensureInjector(dev);
            const calib = loadCalib();
            const rc = calib.keyRC[body.key];
            if (!rc) return json(res, { ok: false, err: '未知键 ' + body.key }, 400);
            const screen = await screenSize(dev);
            const w = screen.w > screen.h ? screen.w : screen.h, h = screen.w > screen.h ? screen.h : screen.w;
            const xy = keyXYF(calib, screen, body.key);
            const x = xy.x, y = xy.y;
            const pid = inj.freePids.shift();
            if (pid === undefined) return json(res, { ok: false, err: '十指全忙' }, 400);
            inj.keyPid.set(body.key, pid);
            injLine('D ' + pid + ' ' + x + ' ' + y);
            json(res, { ok: true, pid, x, y });
            return;
        }
        if (url.pathname === '/api/keyup' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            const pid = inj.keyPid.get(body.key);
            if (pid === undefined) return json(res, { ok: false, err: '该键未按下' }, 400);
            const calib = loadCalib();
            const rc = calib.keyRC[body.key];
            const dev = (await adbDevices())[0];
            const screen = dev ? await screenSize(dev) : { w: 2400, h: 1080 };
            const w = screen.w > screen.h ? screen.w : screen.h, h = screen.w > screen.h ? screen.h : screen.w;
            const xy = keyXYF(calib, screen, body.key);
            const x = xy.x, y = xy.y;
            injLine('U ' + pid + ' ' + x + ' ' + y);
            inj.keyPid.delete(body.key);
            if (inj.freePids.indexOf(pid) < 0) inj.freePids.push(pid);
            json(res, { ok: true });
            return;
        }
        /* MIDI 上传 + 预演(返回统计/轨道列表) */
        if (url.pathname === '/api/midi/parse' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            const screen = await screenSize(dev);
            const A = loadCore();
            const source = body.txt ? { kind: 'txt', text: body.txt, name: body.name || 'txt谱' } : { kind: 'midi', buf: Buffer.from(body.b64 || '', 'base64') };
            const tl = compileTimeline(A, source, loadCalib(), screen, body.tracks, { startBeat: body.startBeat, endBeat: body.endBeat, cutA: body.cutA, cutB: body.cutB });
            json(res, { ok: true, chords: tl.chords, durationSec: tl.durationSec, tracks: tl.tracks, eventCount: tl.events.length });
            return;
        }
        /* MIDI 播放(支持续播:stop/暂停后 ▶ 从断点继续) */
        if (url.pathname === '/api/midi/play' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            if (play.active) return json(res, { ok: false, err: '已在播放中' }, 400);
            const resume = (body.resume === true) && play.pausedMs !== null && play.tl;   // 有断点且曲子还在内存 → 续播
            if (!resume) {
                play.autoResumePending = false;   /* 播放新歌=用户明确意图,待命续播作废 */
                const source = body.txt ? { kind: 'txt', text: body.txt, name: body.name || 'txt谱' } : { kind: 'midi', buf: Buffer.from(body.b64 || '', 'base64') };
                if (source.kind === 'midi' && !source.buf.length) return json(res, { ok: false, err: '请先选择 MIDI 或 TXT 文件' }, 400);
                await ensureInjector(dev);
                const screen = await screenSize(dev);
                const A = loadCore();
                const tl = compileTimeline(A, source, loadCalib(), screen, body.tracks, { startBeat: body.startBeat, endBeat: body.endBeat, cutA: body.cutA, cutB: body.cutB });
                play.tl = tl; play.durationMs = tl.durationSec * 1000;
                play.pausedMs = Math.max(0, Math.round(+body.startMs || 0)) || 0;   /* ▶ 可带起始位置(缓存续播) */
                if (play.durationMs) play.pausedMs = Math.min(play.pausedMs, play.durationMs);   /* 裁剪后旧进度可能越界 */
            }
            await ensureInjector(dev);
            startStream(play.pausedMs || 0);
            play.pausedMs = null;
            json(res, { ok: true, resumed: resume });
            return;
        }
        if (url.pathname === '/api/midi/pause' && req.method === 'POST') {
            if (!play.active) {
                /* 空闲/闪断待命状态下按⏸ = 幂等成功,并掐掉待命自动续播
                 * (修:闪断待命中⏸返回"未在播放",0.8s后老歌又被自动续播,停不下来) */
                play.autoResumePending = false;
                const pos0 = play.pausedMs != null ? play.pausedMs : 0;
                play.pausedMs = pos0;
                sse({ t: 'play', state: 'paused', pos: pos0 });
                json(res, { ok: true, pos: pos0 });
                return;
            }
            play.autoResumePending = false;   /* 用户明确暂停,待命续播作废 */
            const pos = curPos();
            stopStream();
            play.pausedMs = pos;
            sse({ t: 'play', state: 'paused', pos });
            json(res, { ok: true, pos });
            return;
        }
        if (url.pathname === '/api/midi/seek' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            if (!play.tl) return json(res, { ok: false, err: '尚未载入 MIDI(先解析/播放一次)' }, 400);
            const ms = Math.max(0, Math.min(body.ms | 0, play.durationMs));
            play.autoResumePending = false;   /* 用户明确跳转,待命续播作废 */
            const wasActive = play.active;
            stopStream();
            play.pausedMs = ms;
            if (wasActive) {
                const dev = (await adbDevices())[0];
                await ensureInjector(dev);
                startStream(ms);
                play.pausedMs = null;
            }
            json(res, { ok: true, ms, playing: wasActive });
            return;
        }
        if (url.pathname === '/api/midi/pos' && req.method === 'GET') {
            json(res, { ok: true, active: play.active, ms: curPos(), durationMs: play.durationMs, hasTrack: !!play.tl });
            return;
        }
        if (url.pathname === '/api/stop' && req.method === 'POST') {
            play.autoResumePending = false;
            if (play.active) { const pos = curPos(); stopStream(); play.pausedMs = pos; }
            sse({ t: 'play', state: 'stopped', pos: play.pausedMs });
            json(res, { ok: true, pos: play.pausedMs });
            return;
        }
        /* 截图标定 */
        if (url.pathname === '/api/screenshot') {
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            const out = await adb(['-s', dev, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 30 * 1024 * 1024 });
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(out);
            return;
        }
        if (url.pathname === '/api/calib/reset' && req.method === 'POST') {
            try {
                const cur = JSON.parse(fs.readFileSync(CALIB_PATH, 'utf8'));
                delete cur.keyPct;
                fs.writeFileSync(CALIB_PATH, JSON.stringify(cur, null, 1));
                json(res, { ok: true });
            } catch (e) { json(res, { ok: false, err: e.message }, 500); }
            return;
        }
        if (url.pathname === '/api/calib' && req.method === 'POST') {
            const body = await readBody(req);
            fs.writeFileSync(CALIB_PATH, body);
            json(res, { ok: true });
            return;
        }
        if (url.pathname === '/api/keyup-all' && req.method === 'POST') {
            /* 全键释放:必须走 keyXYF(先查 keyPct 标定)——之前只查 keyRC,
             * keyPct 标定下一键都查不到 → released 永远 0,兜底形同虚设 */
            let released = 0;
            try {
                const calib = loadCalib();
                const dev = (await adbDevices())[0];
                const screen = dev ? await screenSize(dev).catch(() => null) : null;
                const SW = screen ? Math.max(screen.w, screen.h) : 2652, SH = screen ? Math.min(screen.w, screen.h) : 1200;
                for (const [key, pid] of inj.keyPid) {
                    try {
                        const xy = keyXYF(calib, { w: SW, h: SH }, key);
                        injLine('U ' + pid + ' ' + xy.x + ' ' + xy.y);
                        released++;
                    } catch (e) {}
                }
            } catch (e) {}
            inj.keyPid.clear();
            json(res, { ok: true, released });
            return;
        }
        /* ---------- 手机曲库(直读 sdcard,不落盘) ---------- */
        if (url.pathname === '/api/phone/list' && req.method === 'GET') {
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            /* 只扫脚本认的两个文件夹 + 用户自建 pc长按;Download 不扫(用户点名去掉) */
            const DIRS = [
                { dir: '/sdcard/QipaPiano/songs/', re: /\.(txt|json)$/i },
                { dir: '/sdcard/QipaPiano/midi/', re: /\.(mid|midi)$/i },
                { dir: '/sdcard/QipaPiano/pc长按/', re: /\.(mid|midi|txt|json)$/i }
            ];
            const songs = [];
            for (const d of DIRS) {
                try {
                    const ls = await adb(['-s', dev, 'shell', 'ls', '-1', d.dir]);
                    const names = ls.split(/\r?\n/).map(s => s.trim()).filter(n => d.re.test(n));
                    for (const n of names) {
                        songs.push({ name: n.replace(/\.(mid|midi|txt|json)$/i, ''), file: n, path: d.dir + n, kind: /\.(txt|json)$/i.test(n) ? 'txt' : 'midi', dir: d.dir });
                    }
                } catch (e) {}
            }
            json(res, { ok: true, songs });
            return;
        }
        if (url.pathname === '/api/phone/file' && req.method === 'GET') {
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            const p = decodeURIComponent((req.url.split('?')[1] || '').replace(/^path=/, ''));
            if (!/^\/sdcard\/(QipaPiano|Download)\//.test(p) || p.includes('..')) return json(res, { ok: false, err: '路径不允许: ' + p }, 400);
            try {
                const buf = await adbBuf(['-s', dev, 'exec-out', 'cat', p]);
                if (!buf || !buf.length) return json(res, { ok: false, err: '手机端读取为空: ' + p }, 500);
                const name = p.split('/').pop();
                const isTxt = /\.(txt|json)$/i.test(name);
                json(res, isTxt
                    ? { ok: true, name, kind: 'txt', text: buf.toString('utf8').replace(/^\uFEFF/, '') }
                    : { ok: true, name, kind: 'midi', b64: buf.toString('base64') });
            } catch (e) {
                json(res, { ok: false, err: '读取失败: ' + e.message }, 500);
            }
            return;
        }
        if (url.pathname === '/api/phone/cache' && req.method === 'GET') {
            /* 手机端脚本缓存(storages QipaPianoStore_v1)在应用私有目录,无 root/run-as 读不到。
             * 若手机端将来导出设置备份 .json 到 /sdcard/QipaPiano/,这里自动识别合并 */
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            try {
                const ls = await adb(['-s', dev, 'shell', 'ls', '-1', '/sdcard/QipaPiano/']);
                const jsonFiles = ls.split(/\r?\n/).map(s => s.trim()).filter(n => /\.json$/i.test(n));
                for (const fn of jsonFiles) {
                    const buf = await adbBuf(['-s', dev, 'exec-out', 'cat', '/sdcard/QipaPiano/' + fn]);
                    try {
                        const o = JSON.parse(buf.toString('utf8'));
                        if (o && (o.songTweaks || o.progressSuper)) {
                            json(res, { ok: true, from: fn, songTweaks: o.songTweaks || {}, progressSuper: o.progressSuper || {} });
                            return;
                        }
                    } catch (e) {}
                }
            } catch (e) {}
            json(res, { ok: false, err: '手机端脚本缓存是应用私有数据(无 root 读不到);网页版用本机 songcache.json 记忆,手机端导出备份 json 后点此可导入' });
            return;
        }
        /* ---------- 本机歌曲缓存(songcache.json) ---------- */
        if (url.pathname === '/api/cache' && req.method === 'GET') {
            const cc = loadSongCache();
            const name = decodeURIComponent((req.url.split('?')[1] || '').replace(/^name=/, ''));
            if (name) return json(res, { ok: true, entry: cc[name] || null });
            json(res, { ok: true, cache: cc });
            return;
        }
        /* PC→手机 双向同步:缓存一变就推 设置导入.json,手机脚本每 15s 检查合并 */
        function pushImportToPhone() {
            (async () => {
                try {
                    const dev = (await adbDevices())[0];
                    if (!dev) return;
                    const tmp = path.join(HERE, '_pc_import.json');
                    fs.writeFileSync(tmp, JSON.stringify({ ts: Date.now(), cache: loadSongCache() }));
                    await adb(['-s', dev, 'push', tmp, '/sdcard/QipaPiano/设置导入.json']);
                    slog('[双向同步] 已推送 设置导入.json → 手机');
                } catch (e) { slog('[双向同步] 推送失败(下次缓存变更重试): ' + e.message); }
            })();
        }
        if (url.pathname === '/api/cache' && req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString() || '{}');
            if (!body.name) return json(res, { ok: false, err: '缺 name' }, 400);
            const cc = loadSongCache();
            const e0 = cc[body.name] || {};
            for (const k of ['mode', 'startBeat', 'endBeat', 'cutA', 'cutB', 'posMs', 'tracks']) {
                if (body[k] !== undefined) e0[k] = body[k];
            }
            e0.updated = Date.now();
            cc[body.name] = e0;
            saveSongCache(cc);
            pushImportToPhone();
            json(res, { ok: true });
            return;
        }
        /* ---------- 手机脚本 PC模式:手机点歌,PC 演奏(手机只发指令) ---------- */
        if (url.pathname === '/api/pcplay' && req.method === 'POST') {
            const raw = (await readBody(req)).toString() || '';
            slog('[pcplay] 原始body: ' + raw.slice(0, 120));   /* 诊断 AutoX→reverse 的编码路径 */
            let body = {};
            try { body = JSON.parse(raw); } catch (e) {
                body = {};
                const sp = new URLSearchParams(raw);
                if (sp.get('file')) body.file = sp.get('file');
                if (sp.get('kind')) body.kind = sp.get('kind');
            }
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备(PC 与手机需 USB 相连)' }, 400);
            if (!body.file || /[\\/]|\.\./.test(body.file)) return json(res, { ok: false, err: '文件名不合法' }, 400);
            if (play.active && play.tl && play.pcLastFile === body.file && Date.now() - (play.pcLastTs || 0) < 6000) {
                return json(res, { ok: true, name: body.file, durationSec: play.durationMs / 1000, dup: true });   /* 同歌重复请求幂等:不打断正在播的 */
            }
            if (play.active) {   /* 点歌=换播:先停当前的(断点已由停止路径语义记下) */
                play.autoResumePending = false;
                const p2 = curPos(); stopStream(); play.pausedMs = p2;
            }
            const fpath = '/sdcard/QipaPiano/pc长按/' + body.file;
            let buf;
            try { buf = await adbBuf(['-s', dev, 'exec-out', 'cat', fpath]); }
            catch (e) { return json(res, { ok: false, err: '读取手机文件失败: ' + e.message }, 500); }
            if (!buf || !buf.length) return json(res, { ok: false, err: '手机端文件为空: ' + body.file }, 500);
            const isTxt = /\.(txt|json)$/i.test(body.file);
            if (!isTxt && buf.slice(0, 4).toString('latin1') !== 'MThd') return json(res, { ok: false, err: '文件不存在或损坏(缺 MThd): ' + body.file }, 500);
            if (isTxt && !/[@\[]/.test(buf.toString('utf8').slice(0, 60))) return json(res, { ok: false, err: '文件不存在或不是谱面: ' + body.file }, 500);
            const source = isTxt
                ? { kind: 'txt', text: buf.toString('utf8').replace(/^\uFEFF/, ''), name: body.file }
                : { kind: 'midi', buf, name: body.file };
            await ensureInjector(dev);
            const screen = await screenSize(dev);
            const A = loadCore();
            const tl = compileTimeline(A, source, loadCalib(), screen, body.tracks || null, {});
            play.autoResumePending = false;
            play.tl = tl; play.durationMs = tl.durationSec * 1000;
            play.pausedMs = 0;
            await ensureInjector(dev);
            startStream(0);
            play.pausedMs = null;
            play.pcLastFile = body.file; play.pcLastTs = Date.now();
            sse({ t: 'pcplay', name: body.file, durationSec: tl.durationSec, chords: tl.chords });   /* 网页实时显示手机点播的歌 */
            json(res, { ok: true, name: body.file, durationSec: tl.durationSec, chords: tl.chords });
            return;
        }
        if (url.pathname === '/api/pcstop' && req.method === 'POST') {
            play.autoResumePending = false;
            if (play.active) { const pos = curPos(); stopStream(); play.pausedMs = pos; }
            sse({ t: 'play', state: 'stopped', pos: play.pausedMs });
            json(res, { ok: true, pos: play.pausedMs });
            return;
        }
        if (url.pathname === '/api/pcpos' && req.method === 'GET') {
            json(res, { ok: true, active: play.active, ms: curPos(), durationMs: play.durationMs, hasTrack: !!play.tl });
            return;
        }
        /* 显式准备注入器(推 jar + 启动) */
        if (url.pathname === '/api/prep' && req.method === 'POST') {
            const dev = (await adbDevices())[0];
            if (!dev) return json(res, { ok: false, err: '无设备' }, 400);
            if (!fs.existsSync(JAR)) return json(res, { ok: false, err: '找不到注入器 jar: ' + JAR }, 400);
            try {
                await ensureInjector(dev);
                json(res, { ok: true, ready: inj.ready });
            } catch (e) {
                json(res, { ok: false, err: e.message }, 500);
            }
            return;
        }
        /* 静态文件 */
        let fp = url.pathname === '/' ? '/index.html' : url.pathname;
        fp = path.join(HERE, 'public', path.normalize(fp).replace(/^(\.\.[\/\\])+/, ''));
        if (fp.indexOf(path.join(HERE, 'public')) !== 0) { res.writeHead(403); res.end(); return; }
        const ext = path.extname(fp).toLowerCase();
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
        if (fs.existsSync(fp)) {
            res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
            fs.createReadStream(fp).pipe(res);
        } else { res.writeHead(404); res.end('not found'); }
    } catch (e) {
        json(res, { ok: false, err: e.message }, 500);
    }
});

/* USB 回归自动续播监视器 */
setInterval(() => {
    if (!play.autoResumePending) return;
    adbDevices().then(devs => {
        if (!devs.length || play.active || !play.autoResumePending) return;
        const pos = play.pausedMs;
        play.autoResumePending = false;
        ensureInjector(devs[0]).then(() => {
            if (play.pausedMs !== null && play.tl) {
                startStream(play.pausedMs);
                play.pausedMs = null;
                sse({ t: 'log', msg: '✓ 设备回归,自动从断点续播 @ ' + Math.round(pos / 1000) + 's' });
            }
        }).catch(e => { play.autoResumePending = true; sse({ t: 'log', msg: '自动续播失败将重试: ' + e.message }); });
    }).catch(() => {});
}, 800);   /* 断后恢复更快,听感断点更短(原 2000) */

/* 全键释放统一走 /api/keyup-all 端点(keyXYF 先查 keyPct 标定) */
process.on('uncaughtException', e => { slog('[异常兜底] ' + e.message); });
process.on('unhandledRejection', e => { slog('[Promise兜底] ' + (e && e.message ? e.message : e)); });

server.listen(PORT, '127.0.0.1', () => {
    console.log('奇葩钢琴 Web 版已启动 → http://127.0.0.1:' + PORT);
    console.log('手机插上 USB 后,页面上会自动检测到设备。');
});
