/* MIDI 字节层移调器:按轨移调 Note On/Off(跳过鼓轨 ch10 和元事件)
 * 原理:走 SMF 轨块,Note On/Off 的音高字节 ± 半音;支持 running status */
'use strict';
function transposeMidi(buf, trackShifts) {
    /* trackShifts: 按音乐轨序号(与 parseMidi 的轨序一致)的半音偏移数组 */
    const out = Buffer.from(buf);
    if (buf.length < 14 || buf.toString('ascii', 0, 4) !== 'MThd') throw new Error('不是 MIDI 文件');
    const fmt = buf.readUInt16BE(8);
    const ntrks = buf.readUInt16BE(10);
    let pos = 14; // MThd 头 4 + 长度 4 + 数据 6
    let trkIdx = 0;
    const getShift = idx => (trackShifts && trackShifts[idx] !== undefined && trackShifts[idx] !== null) ? trackShifts[idx] : 0;
    while (pos + 8 <= buf.length && trkIdx < ntrks) {
        const type = buf.toString('ascii', pos, pos + 4);
        const len = buf.readUInt32BE(pos + 4);
        const dataStart = pos + 8;
        if (type === 'MTrk') {
            const shift = getShift(trkIdx);
            if (shift !== 0) {
                /* 走轨内事件,移调 Note On/Off */
                let p = dataStart;
                const end = dataStart + len;
                let running = 0;
                while (p < end) {
                    /* delta-time varlen */
                    let dt = 0, b;
                    do { b = out[p++]; dt = (dt << 7) | (b & 0x7F); } while (b & 0x80);
                    let st = out[p];
                    if (st < 0x80) { st = running; } else { running = st; p++; }
                    if (st === 0xFF) { /* meta: type + varlen + data */
                        p++; let ml = 0, mb;
                        do { mb = out[p++]; ml = (ml << 7) | (mb & 0x7F); } while (mb & 0x80);
                        p += ml;
                    } else if (st === 0xF0 || st === 0xF7) { /* sysex: varlen + data */
                        let ml = 0, mb;
                        do { mb = out[p++]; ml = (ml << 7) | (mb & 0x7F); } while (mb & 0x80);
                        p += ml;
                    } else if ((st & 0xF0) === 0x90 || (st & 0xF0) === 0x80) {
                        /* Note On/Off:移调音高字节(鼓轨 ch10 = 0x99/0x89 不移) */
                        const ch = st & 0x0F;
                        if (ch !== 9 && out[p] !== undefined) {
                            const np = Math.max(0, Math.min(127, out[p] + shift));
                            out[p] = np;
                        }
                        p += 2;
                    } else if ((st & 0xF0) === 0xA0 || (st & 0xF0) === 0xB0 || (st & 0xF0) === 0xE0) {
                        p += 2;
                    } else if ((st & 0xF0) === 0xC0 || (st & 0xF0) === 0xD0) {
                        p += 1;
                    } else { p = end; } /* 未知状态:停走 */
                }
            }
            trkIdx++;
        }
        pos = dataStart + len;
    }
    return out;
}
module.exports = { transposeMidi };
