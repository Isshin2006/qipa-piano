/* 选调系统 v2:+ SMF 音符提取(带 tick→ms, tempo 捕获) */
'use strict';
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function nameToMidi(name) {
    const i = NOTE_NAMES.indexOf(name);
    return i < 0 ? null : 60 + i;
}
function pitchToIndex(pitch, tonic, baseOct) {
    const rel = pitch - tonic, octv = Math.floor(rel / 12), rem = rel - octv * 12;
    let best = 0, bestD = 99;
    for (let d = 0; d < 7; d++) { const dd = Math.abs(rem - MAJOR_SCALE[d]); if (dd < bestD) { bestD = dd; best = d; } }
    const accidental = rem !== MAJOR_SCALE[best];
    let idx = best + 7 * (octv + (baseOct || 0));
    if (idx >= 0 && idx <= 14) return { idx: idx, accidental: accidental, moved: false };
    while (idx < 0) idx += 7;
    while (idx > 14) idx -= 7;
    return { idx: idx, accidental: accidental, moved: true };
}
function countsOf(notes) {
    const c = {};
    for (const n of notes) c[n[2]] = (c[n[2]] || 0) + 1;
    return c;
}
function rawIndex(pitch, tonic, baseOct) {
    const rel = pitch - tonic, octv = Math.floor(rel / 12), rem = rel - octv * 12;
    let best = 0, bestD = 99;
    for (let d = 0; d < 7; d++) { const dd = Math.abs(rem - MAJOR_SCALE[d]); if (dd < bestD) { bestD = dd; best = d; } }
    return [best + 7 * (octv + (baseOct || 0)), rem !== MAJOR_SCALE[best]];
}
function mappingStats(counts, tonic, baseOct) {
    const keys = [];
    for (const p in counts) keys.push(parseInt(p, 10));
    if (!keys.length) return { clean: 0, accidental: 0, outOfRange: 0, total: 0 };
    let clean = 0, acc = 0, oor2 = 0, total = 0;
    for (const k of keys) {
        const w = counts[k];
        const m = pitchToIndex(k, tonic, baseOct);
        if (m.accidental) acc += w; else clean += w;
        if (m.moved) oor2 += w;
    }
    return { clean: clean, accidental: acc, outOfRange: oor2, total: total };
}
function chooseTonic(counts) {
    const keys = [];
    for (const p in counts) keys.push(parseInt(p, 10));
    if (!keys.length) return { tonic: 60, baseOct: 0 };
    keys.sort((a, b) => a - b);
    const lo = keys[0], hi = keys[keys.length - 1];
    let best = null;
    for (let tonic = Math.max(0, lo - 12); tonic <= Math.min(127, hi + 12); tonic++) {
        for (let bo = -1; bo <= 1; bo++) {
            let clean = 0, acc = 0, oorN = 0;
            for (const k of keys) {
                const w = counts[k];
                const ri = rawIndex(k, tonic, bo);
                if (ri[0] >= 0 && ri[0] <= 14) { if (ri[1]) acc += w; else clean += w; }
                else { oorN += w; if (ri[1]) acc += w; }
            }
            const score = 3 * clean - acc - oorN;
            const key = [score, -Math.abs(bo), -Math.abs(tonic - 60)];
            if (!best || key[0] > best[0] || (key[0] === best[0] && (key[1] > best[1] || (key[1] === best[1] && key[2] > best[2])))) {
                best = key.concat([tonic, bo]);
            }
        }
    }
    return { tonic: best[3], baseOct: best[4] };
}
function resolveTrackTonic(notes, manual) {
    const counts = countsOf(notes);
    if (manual && manual !== 'auto') {
        const pc = nameToMidi(manual);
        if (pc !== null) {
            const pcn = pc % 12;
            let best = null;
            for (let t = pcn; t <= 127; t += 12) {
                for (let bo = -1; bo <= 1; bo++) {
                    const st = mappingStats(counts, t, bo);
                    const score = 3 * st.clean - st.accidental - st.outOfRange;
                    if (!best || score > best.score) best = { tonic: t, baseOct: bo, score: score };
                }
            }
            if (best) return { tonic: best.tonic, baseOct: best.baseOct };
        }
    }
    const pick = chooseTonic(counts);
    return { tonic: pick.tonic, baseOct: pick.baseOct };
}
/* SMF 音符提取(带时间):每轨 [{tick, pitch, ms, ch, on}] + division/tempo */
function extractNotesPerTrack(buf) {
    if (buf.length < 14 || buf.toString('ascii', 0, 4) !== 'MThd') throw new Error('不是 MIDI 文件');
    const division = buf.readUInt16BE(12) & 0x7FFF;
    const ntrks = buf.readUInt16BE(10);
    let pos = 14;
    let trkIdx = 0;
    let tempoUs = 500000;   // 默认 120bpm
    const tracks = [];
    while (pos + 8 <= buf.length && trkIdx < ntrks) {
        const type = buf.toString('ascii', pos, pos + 4);
        const len = buf.readUInt32BE(pos + 4);
        const dataStart = pos + 8;
        if (type === 'MTrk') {
            const notes = [];
            let p = dataStart, end = dataStart + len, tick = 0, running = 0;
            while (p < end) {
                let dt = 0, b;
                do { b = buf[p++]; dt = (dt << 7) | (b & 0x7F); } while (b & 0x80);
                tick += dt;
                let st = buf[p];
                if (st < 0x80) { st = running; } else { running = st; p++; }
                if (st === 0xFF) {
                    const mt = buf[p];
                    p++; let ml = 0, mb;
                    do { mb = buf[p++]; ml = (ml << 7) | (mb & 0x7F); } while (mb & 0x80);
                    if (mt === 0x51 && ml === 3) tempoUs = (buf[p] << 16) | (buf[p + 1] << 8) | buf[p + 2];
                    p += ml;
                } else if (st === 0xF0 || st === 0xF7) {
                    let ml = 0, mb;
                    do { mb = buf[p++]; ml = (ml << 7) | (mb & 0x7F); } while (mb & 0x80);
                    p += ml;
                } else if ((st & 0xF0) === 0x90 && buf[p + 1] > 0) {
                    notes.push({ tick, pitch: buf[p], ch: st & 0x0F, on: true, ms: tick * tempoUs / division / 1000 });
                    p += 2;
                } else if ((st & 0xF0) === 0x80 || ((st & 0xF0) === 0x90 && buf[p + 1] === 0)) {
                    notes.push({ tick, pitch: buf[p], ch: st & 0x0F, on: false, ms: tick * tempoUs / division / 1000 });
                    p += 2;
                } else if ((st & 0xF0) === 0xA0 || (st & 0xF0) === 0xB0 || (st & 0xF0) === 0xE0) {
                    p += 2;
                } else if ((st & 0xF0) === 0xC0 || (st & 0xF0) === 0xD0) {
                    p += 1;
                } else { p = end; }
            }
            tracks.push({ idx: trkIdx, notes, division, tempoUs });
            trkIdx++;
        } else { trkIdx++; }
        pos = dataStart + len;
    }
    return { tracks, division, tempoUs };
}
module.exports = { MAJOR_SCALE, pitchToIndex, countsOf, rawIndex, mappingStats, chooseTonic, resolveTrackTonic, nameToMidi, extractNotesPerTrack };
