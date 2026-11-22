# 🎹 奇葩钢琴 · 开源全家桶

**手机游戏「奇葩战斗家」钢琴自动演奏的完整开源方案** —— AutoX.js 手机脚本 + PC 网页控制器 + 自研 Android 多指触摸注入器 + MIDI 可视化调音播放器。

```
┌──────── PC(浏览器+Node) ────────┐         ┌──────── 手机(AutoX.js) ────────┐
│  server/server.js  (端口 8766)   │         │  phone/QipaPiano.js             │
│   ├ public/index.html 网页控制器 │         │   ├ 本地演奏(悬浮球面板)         │
│   ├ adb/ qipa_adb.exe (改名版)   │  adb    │   ├ PC模式:点歌→PC演奏,手机不弹  │
│   ├ USB 心跳+断连监控            │───────▶ │   ├ 设置备份.json(实时导出)      │
│   └ 注入器进程管理               │         │   └ 设置导入.json(15s 轮询合并)  │
└─────────────────────────────────┘         └─────────────────────────────────┘
          │  adb reverse tcp:8766  │                    │
          └── 手机点歌 ──▶ PC 读手机上的曲谱 ──▶ 注入器多指演奏 ──▶ 游戏 ◀──┘
```

## 三大组件

| 组件 | 位置 | 说明 |
|------|------|------|
| **PC 网页控制器** | `server/` | Node 零依赖 HTTP+SSE 服务器 + 网页：15 键盘鼠标弹奏、MIDI/txt 导入、逐轨选调、可视化裁剪(起音止音/起拍止拍)、进度条拖动、空格/方向键控制、标定、手机曲库直读 |
| **手机脚本** | `phone/QipaPiano.js` | AutoX.js 悬浮球面板：本地演奏(十指编排/真长按/分档长按)、曲库(曲谱/MIDI直读)、PC模式、逐轨调音、设置缓存实时备份 |
| **Android 注入器** | `injector/` | `app_process` 以 shell uid 注入**聚合多指的 MotionEvent**（免 root，scrcpy 同源机制，API 34 适配）——真·多指同时按 = 真·长按和弦 |
| **MIDI 调音播放器** | `phone/奇葩钢琴MIDI调音播放器.html` | 浏览器直开的可视化网页：MIDI→简谱转谱、逐轨调音、起止裁剪、txt 导出 |

## 快速开始

### PC 端（3 步）
1. 装 [Node.js](https://nodejs.org)（任意近五年版本）
2. 双击 `server/启动钢琴.bat`（或 `cd server && node server.js`）
3. 浏览器打开 `http://127.0.0.1:8766`

adb 已自带（`server/adb/qipa_adb.exe`，改名防误杀），插上 USB 自动识别设备。

### 手机端
1. 装 [AutoX.js v6](https://github.com/kkevsekk1/AutoX)（无障碍+悬浮窗权限全给）
2. 把 `phone/QipaPiano.js` 复制到手机 `/sdcard/脚本/`（USB 直接拖，或 `adb push phone/QipaPiano.js /sdcard/脚本/`）
3. AutoX 里运行 → 蓝色♪悬浮球 → 进游戏、横屏、上钢琴
4. **第一次必须标定**：面板 → 🎯 标定 → 截图后依次点 15 个琴键中心（一次永久）

### MIDI 演奏（两种方式任选）
- **网页**：把 .mid 拖进网页 → 解析 → 逐轨勾选/选调 → ▶
- **手机**：.mid 放进 `/sdcard/QipaPiano/midi/` → 面板 ⚙设置 →「演奏:MIDI直读」

## PC模式（手机点歌，PC 演奏）

手机面板曲目翻页条下方有 **[PC模式]** 按钮：

- 开启 → 曲库切换到 `/sdcard/QipaPiano/pc长按/` 文件夹；点播放 = **PC 程序演奏**（手机只发指令，不弹）
- PC 服务器自动维持 `adb reverse tcp:8766` 通道，手机点歌直达 PC
- PC 网页实时显示手机点播的歌名和进度；网页 ■ 停止可让 PC 停（记断点）
- 再点一次「PC模式✓」→ 列表回到当前演奏模式的曲库

## 关键设计决定（都是踩坑换来的，别"优化"掉）

1. **PC 节奏调度器**：绝对钟控逐事件发送（`targetWall = startWall + (e.t - baseMs)`）。
   历史教训：把整首事件流瞬间灌进注入器 stdin，adb PTY 输入缓冲 ~4KB 溢出丢字节，
   251 秒的曲子 4.5 秒烧完。
2. **注入器 API 34 适配**：`InputManager.getInstance()` 无参签名已废，
   走 `ServiceManager.getService("input") → IInputManager.Stub.asInterface →
   injectInputEvent(InputEvent, int)`。参数是 InputEvent 抽象类——AIDL 签名别猜，枚举代理方法实锤。
3. **多指注入**：聚合全部活跃手指构造单个 MotionEvent（POINTER_DOWN/UP 带索引），
   `source` 必须 0x1002 触摸屏。批量 obtain 用 Android 8+ 的 13 参数版。
4. **minNoteGap 顺延以「前一个和弦的起点」为基准**，不是终点——用终点会把延持重叠的
   和弦强制串行化，慢曲子总时长被级联拉长近一倍（Interstellar 279s→476s 事故）。
5. **注入器退出即抬指**：stdin EOF / Q 命令 / JVM 关闭钩子三条路都先 `releaseAll()`
   ——被杀后不抬指，游戏侧琴键一直压着，老歌停不下来。
6. **暂停幂等 + 待命续播让位**：闪断待命状态下按 ⏸ 必须成功并掐掉 `autoResumePending`，
   否则 0.8s 后自动续播把用户的暂停推翻（切歌打架事故）。
7. **AutoX storages 在应用私有目录**（无 root 读不到）→ 手机脚本把 storages 实时导出为
   `/sdcard/QipaPiano/设置备份.json`（put/remove 即落盘）；PC→手机反向用
   `设置导入.json` + 脚本 15s 轮询 + ts 水印去重。缓存键格式 `模式|乐器|曲名`。
8. **adb 改名 `qipa_adb.exe`**：迅游等防护软件按映像名强杀 adb.exe（SIGTERM 实锤），
   改名躲开；same version 自建 5037 服务器无冲突。
9. **AutoX 浮窗 XML 同一行内按钮 `w="auto"/"-2"` 解析成 0 宽 → 按钮隐形**：
   用独立行 + `w="*" layout_weight="1"`（脚本里被反复验证的模式）。
10. **PC模式通信用表单编码**：JSON 字符串 body 经链路会烂（服务器收到非干净 JSON）；
    服务器宽容解析（JSON→表单双兜底）+ 同文件 6s 幂等 + `_pcBusy` 防抖。
11. **15 键物理限制**：两个八度多一点，音域超宽的曲子必然折叠损失——「调:」换主音
    挑损失最小的版本（映射评分：3×干净 - 变化音 - 越界）。
12. **防棘轮转谱**：简谱每个音的位置=前面所有时值之和，三连音吸附会越推越晚；
    音符书写时值取「最近档」（误差半档内带负反馈），残余空隙 <0.125 拍欠填。

## 断连排障协议

看 `server/_server_log.txt` 的 `[注入器退出]` 行区分断因：

| 日志特征 | 含义 | 处置 |
|----------|------|------|
| `code=null signal=SIGTERM` | adb.exe **被 PC 侧进程强杀**（迅游加速器等防护最爱杀 adb） | 退出迅游；火绒信任区加 `server/adb/`；已自带改名 qipa_adb 躲映像名匹配 |
| `code=255 signal=无` | 真·USB 传输断开 | 换原装短线 / 换主板后置接口；Windows 电源计划禁用 USB 选择性暂停 |
| Kernel-PnP 有重枚举事件 | 总线级断（线材/接口） | 同上，物理层 |
| 无 PnP 事件 + adbd PID 稳定 | adb 会话层断 | 升级 platform-tools；检查防护软件 |

心跳每 20s 打真实 USB 流量 + 自动重建 `adb reverse`；设备断开/上线实时推网页日志。

## 目录结构

```
├── server/            PC 网页控制器
│   ├── server.js         HTTP+SSE 服务器(核心)
│   ├── _transpose.js     MIDI 移调模块(必需,勿删)
│   ├── _tonic.js         选调系统模块(必需,勿删)
│   ├── public/index.html 网页前端
│   ├── adb/              自带 platform-tools 37.0.3(改名 qipa_adb)
│   ├── calib.json        键位标定(百分比,首次使用请重新标定)
│   └── 启动钢琴.bat       一键启动
├── phone/             手机端
│   ├── QipaPiano.js      AutoX.js 主脚本
│   └── 奇葩钢琴MIDI调音播放器.html  可视化裁剪/调校/txt导出网页
├── injector/          Android 注入器
│   ├── Injector.java     源码
│   ├── build_kit.js      无 SDK 构建(自动下载工具链)
│   └── QipaInjector.jar  预编译产物(直接可用)
├── dev-tools/         开发工具(离线时长复刻/端点测试,含机器路径,按需改)
├── README.md
└── LICENSE
```

## 开发指南

- **改注入器**：编辑 `injector/Injector.java` → `cd injector && node build_kit.js`
  （工具链自动下载到 tools/，已有则离线编）→ 产物 QipaInjector.jar，服务器下次
  拉起注入器时自动重推手机。
- **改手机脚本**：直接改 `phone/QipaPiano.js` → 推手机
  `adb push phone/QipaPiano.js /sdcard/脚本/QipaPiano.js` → 重跑脚本。
- **更新 adb**：下载新 platform-tools，替换 `server/adb/` 里的 adb.exe 并同步改名
  副本 qipa_adb.exe（保持同版本，避免 5037 端口版本互杀）。
- **离线验证时长**（不插手机）：`node dev-tools/offline_duration.js`。
- **端点测试**（不播放不碰注入器）：`node dev-tools/test_endpoints.js`。
- **本仓库即唯一真源**：所有改动在仓库内完成，再分发到手机/服务器；不要在
  手机端或 Downloads 里改了再"搬回来"。

## 常见报错速查

| 报错/现象 | 原因 | 处置 |
|-----------|------|------|
| 页面"服务器未响应" | 服务器没起/端口被占 | 跑启动钢琴.bat；`netstat -ano \| findstr 8766` 查占用 |
| PC播放失败: PC连接失败 | USB 没插/服务器没跑 | 插 USB；PC 服务器要在跑 |
| 注入器未就绪 | jar 没推/手机断 | 点「⚡准备注入器」；查 USB |
| 这条时间轴是空的 | 音轨没勾选/裁剪切空 | 勾音轨；清裁剪 |
| 竖屏不播放 | 游戏只能横屏 | 进游戏横屏再按 |
| 解析失败(缺 MThd) | 文件损坏/不是 MIDI | 换文件 |
| POST /api/pcplay 4 连发 | 手机端连点 | 已有幂等+防抖，无需处理 |

## 许可

MIT —— 见 LICENSE。adb 部分为 [Android platform-tools](https://developer.android.com/tools/releases/platform-tools)（Apache 2.0）。
