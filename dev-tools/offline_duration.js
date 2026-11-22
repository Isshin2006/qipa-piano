'use strict';
/* 离线复刻 server.js 的 loadCore + compileTimeline 时序,算每个文件真实 durationSec */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Tonic = require('D:/pc_piano/_tonic.js');

const SCRIPT = path.join(__dirname, '..', 'phone', 'QipaPiano.js');   // 仓库内核心
function loadCore() {
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
    const ctx = { console, require, JSON, Math, Date, isFinite, parseFloat, parseInt, Infinity, NaN };
    vm.createContext(ctx);
    vm.runInContext(core + ';this.__api={CONFIG,parseMidi,ensureMidiParsed,midiToSong,parseTxtSong,resolveTrackTonic,pitchToIndex,countsOf,COL_X,ROW_Y,SCALE_ORDER,KEY_LABEL};', ctx, { filename: 'qipa_core.js' });
    return ctx.__api;
}
const A = loadCore();

/* 复刻 compileTimeline 的时序部分(不依赖键位) */
function calcDuration(source) {
    let entry;
    if (source.kind === 'txt') {
        const song = A.parseTxtSong(source.text);
        const bpm = song.bpm || 120;
        entry = { name: source.name || song.name, bpm, speed: 1, loop: 1, startBeat: song.startBeat || 0, endBeat: song.endBeat != null ? song.endBeat : null, tracks: song.tracks };
        const cutA = (song.startBeat || 0) / bpm * 60000;
        const cutB = song.endBeat != null ? song.endBeat / bpm * 60000 : Infinity;
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
        entry = { name: source.name, isMidiFile: true, path: 'x.mid', speed: 1, loop: 1, startBeat: 0, endBeat: null, tracks: [] };
        const tmp = 'D:/pc_piano/_calc_' + Date.now() + '.mid';
        fs.writeFileSync(tmp, source.buf);
        entry.path = tmp;
        A.ensureMidiParsed(entry);
    }
    const notes = [];
    for (const t of entry.tracks) {
        if (!t.on) continue;
        for (const e of t.events) {
            if (!e.keys || !e.keys.length) continue;
            notes.push({ t0: e.beat, t1: e.beat + (e.dur || 0), keyIdx: e.keys[0] });
        }
    }
    notes.sort((a, b) => a.t0 - b.t0);
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
    const minGap = A.CONFIG.minNoteGap !== undefined ? A.CONFIG.minNoteGap : 30;
    for (let ci = 1; ci < chords.length; ci++) {
        const prevStart = chords[ci - 1].t0;
        if (chords[ci].t0 < prevStart + minGap) chords[ci].t0 = prevStart + minGap;
        if (chords[ci].dur < 40) chords[ci].dur = 40;
    }
    const events = [];
    const fingers = Array.from({ length: 10 }, (_, i) => ({ id: i, freeAt: 0 }));
    for (const c of chords) {
        const chosen = [];
        const pool = fingers.slice();
        for (const k of c.keys) {
            const f = pool.find(ff => ff.freeAt <= c.t0 + 1) || pool.reduce((a, b) => (a.freeAt <= b.freeAt ? a : b));
            pool.splice(pool.indexOf(f), 1);
            chosen.push({ f });
        }
        const chordStart = Math.max(c.t0, Math.max(...chosen.map(ch => ch.f.freeAt)));
        const hold = Math.max(40, c.t0 + c.dur - chordStart);
        for (const ch of chosen) {
            events.push({ t: chordStart, type: 'D' });
            events.push({ t: chordStart + hold, type: 'U' });
            ch.f.freeAt = chordStart + hold;
        }
    }
    events.sort((a, b) => a.t - b.t);
    const durationSec = Math.round((events.length ? events[events.length - 1].t : 0) / 1000);
    try { fs.unlinkSync(entry.path); } catch (e) {}
    return { durationSec, chords: chords.length, events: events.length, notes: notes.length };
}

const D = path.join(process.env.USERPROFILE || '', 'Downloads');
const files = ['fade.mid', 'interstellar Day one.mid', 'Interstellar.mid', 'interstellar Day one·裁剪.txt'];
for (const f of files) {
    const full = D + '/' + f;
    try {
        const isTxt = f.endsWith('.txt');
        const source = isTxt ? { kind: 'txt', text: fs.readFileSync(full, 'utf8'), name: f } : { kind: 'midi', buf: fs.readFileSync(full), name: f };
        const r = calcDuration(source);
        console.log(f + ' => durationSec=' + r.durationSec + ' (' + Math.floor(r.durationSec / 60) + '分' + (r.durationSec % 60) + '秒)  chords=' + r.chords + ' events=' + r.events + ' notes=' + r.notes);
    } catch (e) {
        console.log(f + ' => ERR ' + e.message);
    }
}
