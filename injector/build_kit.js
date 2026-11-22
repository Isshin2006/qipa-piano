/**
 * QipaInjector 构建脚本（在任意装了 Node 的电脑上运行，自动下载工具链）：
 *   node build_kit.js
 * 产出：QipaInjector.jar（可在手机上以 app_process 加载的 dex jar）
 *
 * 工具链（自动下载到 tools/）：
 *   - Temurin JRE 17（本机没有 java 时）      adoptium API
 *   - android.jar（编译classpath）           maven central: com.google.android:android:4.1.1.4
 *   - ECJ（Eclipse 编译器，单 jar）           maven central: org.eclipse.jdt:ecj
 *   - D8/r8（.class → dex）                  Google Maven: com.android.tools:r8
 *
 * 注入器运行时全部走反射调隐藏 API（InputManager.injectInputEvent），
 * 编译期只需要 android.jar 里有 MotionEvent/PointerCoords 这些公开类。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync, spawnSync } = require('child_process');

const HERE = __dirname;
const TOOLS = path.join(HERE, 'tools');
const OUT = path.join(HERE, 'QipaInjector.jar');
try { fs.mkdirSync(TOOLS); } catch (e) {}

function get(url, dest, redirects) {
    return new Promise((resolve, reject) => {
        const follow = (u, n) => {
            if (n > 6) return reject(new Error('重定向过多: ' + u));
            https.get(u, r => {
                if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
                    r.resume();
                    return follow(r.headers.location, n + 1);
                }
                if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' ' + u)); }
                const f = fs.createWriteStream(dest);
                r.pipe(f);
                f.on('finish', () => f.close(resolve));
            }).on('error', reject);
        };
        follow(url, 0);
    });
}
const exists = p => { try { fs.accessSync(p); return true; } catch (e) { return false; } };
function findJava() {
    try { execFileSync('java', ['-version'], { stdio: 'ignore' }); return 'java'; } catch (e) {}
    // 找 tools/ 下解压好的 JRE
    if (exists(TOOLS)) {
        for (const d of fs.readdirSync(TOOLS)) {
            const p = path.join(TOOLS, d, 'bin', 'java.exe');
            if (exists(p)) return p;
        }
    }
    return null;
}
async function ensureJava() {
    let j = findJava();
    if (j) return j;
    console.log('本机没有 Java，下载 Temurin JRE 17（约 45MB，一次性）…');
    const zip = path.join(TOOLS, 'jre.zip');
    await get('https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse', zip);
    console.log('解压 JRE…');
    const r = spawnSync('tar', ['-xf', zip, '-C', TOOLS], { encoding: 'utf8' });
    if (r.status !== 0 && !findJava()) throw new Error('解压失败（需要 Windows 10 1803+ 自带 tar）: ' + r.stderr);
    try { fs.unlinkSync(zip); } catch (e) {}
    j = findJava();
    if (!j) throw new Error('JRE 解压后找不到 java.exe');
    return j;
}
async function ensure(url, dest) {
    if (exists(dest)) { console.log('已有 ' + path.basename(dest)); return; }
    console.log('下载 ' + path.basename(dest) + ' …');
    await get(url, dest);
}

/* 最小 zip 打包（stored 不压缩，dex 加载没问题） */
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(entries) {   // entries: [{name, data:Buffer}]
    const chunks = [], central = [];
    let offset = 0;
    for (const e of entries) {
        const name = Buffer.from(e.name, 'utf8');
        const crc = crc32(e.data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(e.data.length, 18);
        local.writeUInt32LE(e.data.length, 22); local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        chunks.push(local, name, e.data);
        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
        cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(e.data.length, 20);
        cd.writeUInt32LE(e.data.length, 24); cd.writeUInt16LE(name.length, 28);
        cd.writeUInt32LE(offset, 42);
        central.push(Buffer.concat([cd, name]));
        offset += 30 + name.length + e.data.length;
    }
    const cdBuf = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...chunks, cdBuf, eocd]);
}

async function main() {
    const java = await ensureJava();
    console.log('Java: ' + java);
    const androidJar = path.join(TOOLS, 'android-all.jar');
    const ecjJar = path.join(TOOLS, 'ecj.jar');
    const r8Jar = path.join(TOOLS, 'r8.jar');
    // Robolectric 的 android-all = 完整框架 jar（含隐藏 API），MotionEvent 批量
    // obtain / InputManager.injectInputEvent 都能编译；运行时由反射兼容新旧签名
    await ensure('https://repo1.maven.org/maven2/org/robolectric/android-all/8.1.0-robolectric-4611349/android-all-8.1.0-robolectric-4611349.jar', androidJar);
    await ensure('https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.33.0/ecj-3.33.0.jar', ecjJar);
    let r8Ok = false;
    for (const v of ['8.3.37', '8.2.42', '8.1.7', '3.3.48']) {
        try { await ensure('https://dl.google.com/dl/android/maven2/com/android/tools/r8/' + v + '/r8-' + v + '.jar', r8Jar); r8Ok = true; break; }
        catch (e) { console.log('r8 ' + v + ' 下载失败，试下一个版本'); }
    }
    if (!r8Ok) throw new Error('r8 各版本都下载失败（Google Maven 不可达？）');

    const outDir = path.join(HERE, 'classes');
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) {}
    fs.mkdirSync(outDir, { recursive: true });
    console.log('编译 QipaInjector.java …');
    const c = spawnSync(java, ['-jar', ecjJar,
        '-source', '1.8', '-target', '1.8',
        '-cp', androidJar, '-d', outDir,
        path.join(HERE, 'Injector.java')], { encoding: 'utf8' });
    if (c.status !== 0) throw new Error('编译失败:\n' + (c.stdout + c.stderr).slice(0, 3000));
    console.log('转 dex（r8）…');
    const classFiles = [];
    (function walk(d) {
        for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.class')) classFiles.push(p);
        }
    })(outDir);
    const dexDir = path.join(HERE, 'dexout');
    try { fs.rmSync(dexDir, { recursive: true, force: true }); } catch (e) {}
    fs.mkdirSync(dexDir);
    const d = spawnSync(java, ['-cp', r8Jar, 'com.android.tools.r8.D8',
        '--release', '--lib', androidJar, '--min-api', '21',
        '--output', dexDir, ...classFiles], { encoding: 'utf8' });
    if (d.status !== 0) throw new Error('dex 失败:\n' + (d.stdout + d.stderr).slice(0, 3000));
    const dex = fs.readFileSync(path.join(dexDir, 'classes.dex'));
    if (dex.slice(0, 4).toString() !== 'dex\n') throw new Error('dex 魔数不对');
    fs.writeFileSync(OUT, makeZip([{ name: 'classes.dex', data: dex }]));
    console.log('✓ 产出 ' + OUT + '（' + dex.length + ' 字节 dex）');
    console.log('部署：adb push ' + OUT + ' /data/local/tmp/qipa_injector.jar');
}

main().catch(e => { console.error('构建失败: ' + e.message); process.exit(1); });
