/**
 * ============================================================================
 *  奇葩战斗家 · 钢琴自动演奏脚本  (AutoX.js)
 * ============================================================================
 *
 *  键位布局（3 行 × 5 列，共 15 键）：
 *      行1:  1   2   3   4   5
 *      行2:  6   7   1'  2'  3'
 *      行3:  4'  5'  6'  7'  1''
 *      （ ' = 高音点，'' = 倍高音点 ）
 *
 *  坐标来源：游戏实机截图 2652×1200，经网格边缘检测 + 视觉双重校验，
 *  以「屏幕百分比」记录，自动适配任意手机分辨率与横屏比例。
 *
 *  ------------------------------------------------------------------------
 *  使用步骤
 *  ------------------------------------------------------------------------
 *   1. 用 AutoX.js（或 Auto.js Pro / Autojs6）打开本文件，授予
 *      【无障碍服务】+【悬浮窗权限】+【后台运行】。
 *   2. 运行脚本 → 屏幕出现蓝色♪悬浮球 → 进游戏、上钢琴。
 *   3. 面板里选曲目、勾选音轨、调速度 → 点「▶ 开始」，面板会自动收起
 *      不再挡住琴键（不想自动收就关掉 CONFIG.autoHideOnPlay）。
 *
 *   悬浮球三种手势：
 *     单击 = 面板开着 → 只收面板（再点一下悬浮球就开始播放）
 *           面板收着 → 播放 / 停止当前曲目
 *     长按 = 正在播放 → 停止 + 打开面板
 *           空闲     → 开关面板
 *     拖动 = 挪位置（按住 0.48 秒即触发长按，带震动，不用等松手）
 *
 *   音量键（只在【正在播放】时有效，暂停/停止时按键无动作）：
 *     音量↑ = 实时切上一曲并马上播放        音量↓ = 实时切下一曲并马上播放
 *     （切换的是当前乐器文件夹里的曲目；退出脚本用 ⚙设置 →「⏏ 退出脚本」，
 *       音量键退出功能已移除）
 *
 *  ------------------------------------------------------------------------
 *  面板布局（只有一套，转屏不重排）
 *  ------------------------------------------------------------------------
 *   · 宽度按【竖屏屏宽】算，而且第一次排版时就冻结下来（panelRefWdp()），
 *     之后和当前方向脱钩。竖屏排出来的面板（例如 284×364dp）进游戏转横屏
 *     还是同样宽、同样排法，等于「把竖屏那块 UI 转过来」；转屏时窗口重建一次
 *     （面板闪一下再出现，没有旋转动画），控件位置不会来回抽动。
 *   · 高度按「参考宽 / 当前真实屏高」取小：横屏下系统栏吃掉十几 dp 的机型上
 *     面板会长得矮一点点（中间滚动区少显示一行），但固定底栏永远在屏内。
 *   · 标题栏 + 底栏（▶开始 / ■停止 / 状态行）是【固定】的，永远在屏内，
 *     中间区域才是唯一可上下滑动的部分 —— 横屏再矮也够得着播放键。
 *   · 控件一律紧凑尺寸，参数两列并排（用宽度换高度）。
 *   · 曲目、音轨、编辑器都用【[◀上页][下页▶] …… 页码】分页显示，不做滚动列表。
 *     （外层滚动容器里再套滚动列表，Android 会互相吃掉手势，
 *       这就是之前"只有曲目能滑、下面滑不动"的原因。）
 *     翻页按钮是【固定窄宽 + 紧挨着排在最左边】，页码右对齐吃掉剩余宽度 ——
 *     这样面板再窄也挤不掉「下页▶」（详见 pageBar() 里的注释）。
 *   · 低频操作（输入导入、重扫目录、点击方式、按压时长、偏移微调、
 *     导出、清除标定）都收进「⚙ 设置」抽屉，主界面更清爽。
 *   · 面板窗口固定为「小」档（CONFIG.panelScale，默认 0.78），没有大小
 *     切换按钮；小档下面板内 UI（控件高度 + 文字）还会再缩一档
 *     （CONFIG.uiShrink，默认 0.85），面板窗口大小不变、每页能多显示几行。
 *   · 两种乐器：「⚙设置 → 乐器」切换 15键钢琴 / 7键琴。7键琴的 7 个键
 *     依次对应音 1~7，谱子里的高音/倍高音等超出 1~7 的音播放时自动跳过。
 *   · 定位方式（两琴独立、互不干扰）：
 *       15键琴 —— 「🎯 标定」两点标定（快，假设 3×5 均匀网格）或
 *                  「🔢 全键标定」逐键标 15 次（不假设网格，防游戏改键位），
 *                  两种只生效最后使用的那种；
 *       7键琴  —— 只能「🔢 全键标定」逐键标 7 次，切过去没标定过会自动引导。
 *
 *   ⚠ 改布局时务必保证每个进 XML 的尺寸都是【整数 dp】。
 *     Auto.js 解析 XML 尺寸走 Integer.parseInt()，一个小数就会让它抛
 *     NumberFormatException 并连锁炸出 InterruptedException，整个悬浮窗
 *     建不出来（这个坑踩过，已在 computeLayout 末尾统一取整 +
 *     fixXmlDimensions 兜底）。
 *
 *  ------------------------------------------------------------------------
 *  怎么编辑曲谱 / 调整歌曲长度
 *  ------------------------------------------------------------------------
 *   · 直接改下面 SONGS 里每首歌的 notes 字符串（改音符个数 = 改长度）。
 *   · 或者只改这 4 个字段，不动谱子就能裁长度：
 *        startBeat : 从第几拍开始播（0 = 从头）
 *        endBeat   : 播到第几拍结束（留空 = 播到谱子结尾）
 *        loop      : 循环几遍（1 = 播一遍）
 *        speed     : 速度倍率（0.5 = 慢一倍，2 = 快一倍）
 *   · 也可以在游戏外把谱子丢进  /sdcard/QipaPiano/songs/  目录
 *     （.txt 简谱 或 .json），脚本启动时自动扫描导入，无需改代码。
 *     谱子就是「1 2 3 4 5 / 6 7 1' 2' 3' / 4' 5' 6' 7' 1''」这 15 个键的写法，
 *     第一次运行脚本还会在 /sdcard/QipaPiano/README.txt 写一份格式说明。
 *   · 配套的两个电脑端工具（都是零依赖 Python 3）：
 *        midi2jianpu.py  MIDI -> .txt 简谱    python3 midi2jianpu.py 曲子.mid -o 曲子.txt
 *        jianpu_tool.py  check 逐个报"哪个记号看不懂"、各轨拍数齐不齐
 *                        bundle 把整个曲谱目录打包进本文件的 SONGS（见下面打包区）
 *     谱子在电脑上先 `check` 过一遍，比在手机面板上看一句被截断的 ⚠ 省事得多。
 *   · 面板里点「✎ 编辑谱」直接改当前曲目各音轨的简谱（每页一条轨，
 *     底栏会变成 保存/取消），改完即时生效。
 *   · 进编辑页会【自动换成一套紧凑矮面板并顶到屏幕最上面】：横屏游戏只有
 *     ~370dp 高，输入法一弹出就吃掉下半屏，满屏高的面板必然把谱框盖住。
 *     矮面板只留「标题 → 音轨名 → 谱框 → 翻页条 → 保存/取消 → 一行提示」，
 *     退出编辑页自动换回原来的满屏面板并回到原来的位置。
 *   · 打字：【点一下谱框】即呼出系统输入法。
 *     原理是 floaty 悬浮窗默认带 FLAG_NOT_FOCUSABLE，这种窗口拿不到输入焦点，
 *     所以点谱框时会先 panel.requestFocus() 清掉它，退出时再 disableFocus()
 *     还回去（不还的话窗口是模态的，会把游戏触摸全吃掉）。详见 _showIme()。
 *     键盘挡住底下的保存/取消时，先按一次系统【返回键】收起键盘再点。
 *   · 谱框高度想调就改 CONFIG.editInputH（默认按屏高自动给一小截）。
 *   · 「⚙ 设置 → ⌨ 输入导入曲谱」：不读剪贴板，直接用系统输入法打简谱
 *     （支持 @name/@bpm、多音轨 [轨名] 写法）。打完二选一：
 *        「✓ 确认」    = 进曲库并设为当前曲目，▶开始/悬浮球/音量键默认
 *                        播放这份输入内容，直到你在曲目里另选一首；
 *        「📄 导出.txt」= 写成 .txt 存进 /sdcard/QipaPiano/songs/，点
 *                        「↺ 重扫目录」即可载入。
 *   · 「⚙ 设置 → 📄 导出选中曲.txt」只导出曲目列表里当前选中的那一首；
 *     在「✎ 编辑谱」里改过的话，导出的就是改后的版本。
 *
 *  ------------------------------------------------------------------------
 *  演奏模式（⚙设置 →「演奏:」切换，两种各有取舍）
 *  ------------------------------------------------------------------------
 *   · 演奏:曲谱(.txt) —— 曲库 = songs/ 里的 .txt/.json。可编辑谱、可调
 *     BPM/起止拍/倍速，导入MIDI 也是转成这种。
 *   · 演奏:MIDI直读 —— 曲库 = midi 目录里扫到的 .mid，选中即解析、播放时
 *     直接按 MIDI 原始毫秒时序点击【不经简谱转换】：节奏、延音完全忠实
 *     原曲（txt 转谱会把时值吸附到固定档位，密集曲子会被拖慢）。
 *     不能编辑、BPM 不可调（时序来自 .mid 本身）；但可以设【起音/止音】
 *     ——按「第几个音」裁剪播放范围，同样进参数缓存（倍速/循环/音轨勾选可用）。
 *     逐轨调性：每条音轨的主音(1=do)各自独立挑（auto=本轨最优），
 *     ⚙设置里的「轨1调/轨2调/轨3调」按钮逐个循环切换 —— 旋律和贝斯
 *     各用各的调，不再互相牵连（完整编曲的 MIDI 也能对上主旋律）。
 *     「📄 转化选中MIDI」按当前各轨的调转成 .txt 存进 songs/，
 *     文件名/歌名带各轨调性后缀，如「xxx（A，C，F）.txt」。
 *     ⚠ 音域超过琴键范围的音仍要折叠（15键琴只有 2 个八度），换「调:」
 *       挑损失最小的版本。
 *
 *  点击方式（⚙设置 →「点击:」）：press按住 / click / root 三选一。
 *   · 无障碍手势一次只有一根手指（下一次手势会取消没抬起的上一次），
 *     所以「长按不松手 + 同时点其他键」在这个机制下物理上做不到，
 *     奇葩战斗家实测也不认无障碍多指手势（多指方案试过，已砍）。
 *     Shizuku 之类的免 root 提权工具给的是 shell 权限，`input` 命令
 *     同样做不了多指触摸，帮不上忙。
 *   · 单指下的上限就是「长按:分档」：按压时长按音符实际时长定档，
 *     能按多久按多久，但永不把下一个音挤晚 —— 要真延音只能靠游戏
 *     自己的延音逻辑或 MIDI直读的原始时长。
 *
 *  延音手感（⚙设置 →「长按:分档」）：
 *   · 分档：按压时长按音符时长定档（30/60/90/…/3000ms 共 13 档，见
 *     CONFIG.pressTiers），长音按得久、短音点一下，且永不挤晚下一个音
 *     （自动限制在「到下一音的间隔-30ms」以内）；和弦保持短按齐响。
 *   · 固定：所有音统一按 tapDuration（默认 30ms）点一下。
 *
 *  ------------------------------------------------------------------------
 *  手上只有 .mid、身边又没有电脑？—— 面板里直接转，不用 Termux
 *  ------------------------------------------------------------------------
 *   把 .mid / .midi 放进下面任意一个位置（用文件管理器或者随便什么 App 存进去都行）：
 *        /sdcard/QipaPiano/midi/     ← 专门放 MIDI 的，脚本第一次运行会自动建
 *        /sdcard/QipaPiano/songs/    ← 和 .txt 混着放也行
 *        /sdcard/Download/           ← 懒得挪文件的话，直接留在「下载」里也会被扫到
 *   然后：面板 → ⚙ 设置 → 点「🎼 导入MIDI」。
 *
 *   它会自己挑主音、按时值表量化、把同一时刻的音合成和弦、给短轨补休止符对齐，
 *   然后转成简谱、写一份同样内容的 .txt 到 songs/（重启脚本后还在）、进曲库，
 *   并自动选中它 —— 回到主界面就能直接 ▶ 开始弹。
 *   本文件第 6b 节就是电脑上那个 midi2jianpu.py 的 JS 版，两边算法一致，
 *   同一个 .mid 转出来的谱子逐音相同（有对比测试守着）。
 *
 *   转得好不好去看 AutoX.js 的日志，重点这两行：
 *        主音 1(do) = D3（自动挑的，面板「调:」可切）
 *        共 1179 个音：原样弹对 1144 (97%)，35 个是升降音已就近折算，399 个超出 15 键已折叠
 *   「原样弹对」低于 85% 就说明调没挑好：点旁边的「调:」按钮换一个主音
 *   （自动 → C → C# → D → Eb → … 循环），再点一次「🎼 导入MIDI」重转，
 *   挑百分比最高的那版。
 *
 *   ⚠ 曲库里已有同名曲目时，导入一律【跳过不覆盖】——你在面板里调好的
 *     起拍/止拍、编辑过的谱子全部保留。想重转某一首：
 *     删掉 songs/同名.txt →「↺ 重扫目录」→ 再点「🎼 导入MIDI」。
 *
 *   几个开关在 CONFIG 里：midiDir（扫哪个目录）、midiScanDownload（要不要扫下载）、
 *   midiMono（压成单声部，音太密点不过来时用）、midiOor（超范围音怎么处理）、
 *   midiSkipDrums（丢掉鼓轨，默认丢）、midiWriteTxt（要不要写 .txt）。
 *
 *   重复点导入不会重复加歌：同一个文件 + 同一个主音 + 已经在曲库里 → 跳过，
 *   这样你在「✎ 编辑谱」里手改过的版本不会被冲掉；想重转就先换个「调:」。
 *
 *  ------------------------------------------------------------------------
 *  简谱语法（本脚本支持）
 *  ------------------------------------------------------------------------
 *   1 ~ 7        中音
 *   1' ~ 7'      高音（音符后加一个单引号）
 *   1''          倍高音（两个单引号，本键盘只有 1'' 这一个）
 *   ^1  ^^1      等同 1' 和 1''（不想打引号时用）
 *   0            休止符（占时值但不发声）
 *   -            延音线：让前一个音再延续「一个基本时值」，这段延音自身也占时间
 *                1 - → 2拍     1 - - - → 4拍     _1 - → 1拍
 *   _1           前缀一个下划线 = 八分音符（0.5 拍）
 *   __1          两个 = 十六分（0.25 拍），___1 = 三十二分（0.125 拍）
 *   1.           音符后加点 = 附点，时值 ×1.5    例: 1. = 1.5 拍
 *   _1.          附点八分 = 0.75 拍
 *   [1 3 5]      方括号 = 和弦，同时按下（内部每个音还能带 _ 和 '）
 *   |            小节线，仅做视觉分隔，不影响时值
 *   ( ) { } 空格 换行    全部忽略
 *   //…           行注释（从 // 到行尾被忽略；# 不作注释，可留给升号 #4）
 *
 *   超出键盘 15 键范围的音会被自动就近折算到范围内（不会报错中断），
 *   折算规则见 CONFIG.octaveFallback。
 *
 * ============================================================================
 */

// 说明：不用 "ui"; 模式。悬浮窗(floaty) + setInterval 保活是游戏辅助脚本的标准写法，
// 播放引擎跑在独立线程里，不会卡住面板。

/* ==========================================================================
 *  1. 用户配置区  ——  一般只需要动这里
 * ========================================================================== */

var CONFIG = {
    // ---- 播放 ----
    defaultBpm: 96,          // 未标 bpm 的曲子的默认速度
    minNoteGap: 12,          // 两次点击之间的最小间隔(ms)，太小游戏不响应就调大
    tapDuration: 30,         // 单音按压时长(ms)；游戏没反应就加到 50~80
    chordTap: 8,             // 和弦内每个键的按压时长(ms)，越小和弦越"齐"
    chordSpread: 6,          // 和弦内相邻两键之间的额外间隔(ms)
    maxVoices: 4,            // 和弦最多同时按几个键（超出的丢弃，防止卡顿）

    // ---- 点击方式: 'press' | 'click' | 'root' ----
    // press = 无障碍手势按住（对 Unity 游戏兼容性最好，默认）
    // click = 无障碍点击
    // root  = shell input tap（需已 root，某些机型反而更稳）
    // 注意：无障碍手势一次只能有一根手指（下一次 dispatchGesture 会取消
    // 还没抬起的上一次），所以「长按不松手 + 同时点其他键」在这个机制下
    // 做不到 —— 分档长按（pressByDuration）已经是单指的上限：能按多久
    // 按多久，但不会把下一个音挤晚。奇葩战斗家实测也不认无障碍多指手势。
    clickMode: 'press',

    // ---- 按压时长（延音）：按音符实际时长【分档】按压，不做逐毫秒实时计算 ----
    // false = 所有音统一按 tapDuration（固定 30ms 点一下，长音听不出延音）
    // true  = 按压时长取 pressTiers 里「不超过 min(音符时长, 到下一音的间隔-30ms)」
    //         的最大一档，长音按得久、短音点一下就走 —— 延音/长音符有了手感。
    //         和弦仍用短按（chordTap），保证多键落得齐。
    // 想调档位就改 pressTiers 数组（毫秒，从小到大）。
    pressByDuration: true,
    pressTiers: [30, 60, 90, 120, 180, 250, 400, 600, 900, 1200, 1800, 2400, 3000],

    // ---- 乐器 ----
    instrument: 'piano15',  // 'piano15' = 15键钢琴（默认）
                            // 'lute7'   = 7键乐器：7 个键依次对应音 1~7，
                            //             谱子里其他音（高音/倍高音）播放时自动跳过。
                            //             ⚙设置 →「乐器」切换；7键琴首次使用
                            //             要先做一次 7 键全键标定。

    // ---- 播放模式 ----
    playSource: 'txt',      // 'txt'  = 读曲谱库（songs/*.txt，经简谱转换，可编辑/裁剪）
                             // 'midi' = MIDI 直读（曲目列表=当前乐器 midi/ 目录的 .mid，
                             //          播放时直接按 MIDI 原始毫秒时序点击，不经简谱
                             //          时值量化/吸附，节奏和延音完全忠实原曲）
                             //          面板 ⚙设置 →「演奏:」切换；「调:」同样有效。
                             //          直读模式下 起拍/止拍 变成 起音/止音（按第几个音裁剪，
                             //          同样进参数缓存），BPM 仍显示 .mid 自带的。

    // ---- 播放进度记录模式（⚙设置 →「播放进度」开关）----
    // 亚缓存 = 内存单槽：只记当前歌的暂停位置，播放别的音乐即覆盖，退出脚本失效；
    // 超缓存 = 持久化到 storages：每首歌各记各的进度，切歌/重启都在；
    //         唯一清除办法 = 切回亚缓存（全部清空），另外自然播完一首清一首。
    // 两种模式互斥：切换时把对方的记录全部清空（见 progBtn 处理器）。
    progressMode: 'sub',

    // ---- 悬浮窗 ----
    useRawWindow: false,     // true = floaty.rawWindow（触摸穿透，需自行 openPanel）
                             // false = floaty.window（默认，可直接点）
    panelScale: 0.78,        // 面板窗口缩放，固定为「小」档（已删掉面板大小切换按钮，
                             //  也不再从 storages 里读旧值，永远用这里的默认）
    uiShrink: 0.85,          // 「小」档下面板内 UI（控件高度 + 文字）再缩小的比例，
                             // 面板窗口大小不变，每页能多显示几行曲目/音轨
    autoHideOnPlay: true,    // 点「▶ 开始」后自动把面板收起来，避免挡住琴键
                             // （面板宽按竖屏屏宽算，横屏下偏窄、一般只占画面左侧，
                             //   不过收起来弹着更清爽）
    hideDelayMs: 350,        // 收面板前留一点时间，让你看清 toast 里报的曲目/时长

    // ---- 编辑谱 ----
    // 谱框的高度(dp)。留空 = 按屏幕高度自动给一小截（横屏 ~40dp）。
    // 进编辑页 / 输入导入页时面板会自动换成紧凑矮布局并顶到屏幕最上面，
    // 这样呼出的输入法就不会把谱框盖住；如果你的输入法特别高、
    // 谱框还是被压住一点，把这个值调小即可（重启脚本生效）。
    editInputH: 0,

    // ---- 越界音处理: 'clamp' 就近折算 | 'drop' 直接丢弃 | 'octave' 强制换八度 ----
    octaveFallback: 'clamp',

    // ---- MIDI 导入（面板 ⚙设置 →「🎼 导入MIDI」，不需要电脑/Termux）----
    // 把 .mid 扔进当前乐器的 midi/ 目录（或 songs/、15键琴另扫「下载」），点一下按钮就转成
    // 简谱、写好 .txt、进曲库。逻辑和电脑上的 midi2jianpu.py 一致。
    // ⚠ 目录按乐器自动切换（见下面的 INSTR_DIR），7键琴只认 QipaHarp 里的文件。
    midiScanDownload: true,  // 15键琴顺手也扫一下 /sdcard/Download/（7键琴只认自己的文件夹）
    midiTonic: 'auto',       // 主音(1=do)：'auto' 自动挑 | 'C' 'C#' 'D' 'Eb' 'F' ... 手动指定
                             // 等价于 midi2jianpu.py 的 --tonic；面板里「调:」按钮可以循环切
    midiMono: false,         // true = 所有轨压成一条单声部（只适合纯旋律曲）
    midiOor: 'fold',         // 超出 15 键的音：'fold' 整八度折叠 | 'clamp' 压边界 | 'drop' 丢掉
    midiSkipDrums: true,     // 丢掉 MIDI 第 10 通道（GM 标准里的鼓），鼓没有音高，
                             // 转出来是一堆乱七八糟的键
    midiBeatsPerBar: 0,      // 每小节几拍，0 = 读 MIDI 里的拍号（读不到按 4/4）
    midiWriteTxt: true,      // 转完顺手写一份 .txt 到 songDir，重启脚本后还在

    // ---- 外部曲谱目录 ----
    // 目录按乐器自动切换（见 CONFIG 后面的 INSTR_DIR），不要在这里写死：
    //   15键钢琴 → /sdcard/QipaPiano/{songs,midi}/
    //   7键琴    → /sdcard/QipaHarp/{songs,midi}/
    // 两个乐器的曲谱、MIDI、产出的 .txt 完全隔离，互不识别、互不覆盖。

    // ---- 调试 ----
    verbose: true,           // toast/log 输出解析细节
    clickFlash: false,       // 点击时闪红点（校准/测试时开，正式演奏建议关，省性能）
};

/**
 * 两个乐器各自的工作目录（互相独立）：
 *   piano15 → /sdcard/QipaPiano/   songs/ 放 .txt/.json 曲谱，midi/ 放 .mid
 *   lute7   → /sdcard/QipaHarp/    songs/、midi/ 作用完全一样，供 7键琴专用
 * 每个乐器只识别自己文件夹里的曲谱和 MIDI；所有产出 .txt 的操作
 * （导出选中曲 / 导入MIDI / 输入导入）也只写进自己文件夹的 songs/。
 */
var INSTR_DIR = {
    piano15: { root: '/sdcard/QipaPiano/', songs: '/sdcard/QipaPiano/songs/', midi: '/sdcard/QipaPiano/midi/' },
    lute7:   { root: '/sdcard/QipaHarp/',  songs: '/sdcard/QipaHarp/songs/',  midi: '/sdcard/QipaHarp/midi/' }
};

/** 当前乐器的曲谱目录（.txt / .json）。 */
function songDirOf() { return INSTR_DIR[CONFIG.instrument || 'piano15'].songs; }
/** 当前乐器的 MIDI 目录（.mid）。 */
function midiDirOf() { return INSTR_DIR[CONFIG.instrument || 'piano15'].midi; }
/** 当前乐器的工作根目录（README 写在这里）。 */
function saveDirOf() { return INSTR_DIR[CONFIG.instrument || 'piano15'].root; }

/* ==========================================================================
 *  2. 键位定义  ——  除非游戏改版，否则不用动
 * ========================================================================== */

/**
 * 15 个键的屏幕百分比坐标（左上角为原点，x/y 均为 0~1）。
 * 由 2652×1200 实机截图中键框边缘网格反算得出，键距均匀。
 *
 *   cols x: 0.3571  0.4284  0.4998  0.5710  0.6424
 *   rows y: 0.1713  0.3288  0.4863
 */
var COL_X = [0.3571, 0.4284, 0.4998, 0.5710, 0.6424];
var ROW_Y = [0.1713, 0.3288, 0.4863];

/**
 * 键名 → 网格 [行, 列]。
 * 键名语法与简谱一致：中音 "1".."7"，高音 "1'".."7'"，倍高音 "1''"。
 * 同时给出别名（^ 写法、数字编号），解析器统一走 resolveKey()。
 */
var KEYMAP = {
    '1':   [0, 0], '2':   [0, 1], '3':   [0, 2], '4':   [0, 3], '5':   [0, 4],
    '6':   [1, 0], '7':   [1, 1],
    "1'":  [1, 2], "2'":  [1, 3], "3'":  [1, 4],
    "4'":  [2, 0], "5'":  [2, 1], "6'":  [2, 2], "7'":  [2, 3],
    "1''": [2, 4],
};

/** 从低到高排列的键序，用于越界音「就近折算」。15 个音级。 */
var SCALE_ORDER = [
    '1', '2', '3', '4', '5', '6', '7',
    "1'", "2'", "3'", "4'", "5'", "6'", "7'",
    "1''"
];

/** 面板/日志里显示的键名（用 ♪ 点号更好认）。 */
var KEY_LABEL = {
    '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    "1'": '1̇', "2'": '2̇', "3'": '3̇', "4'": '4̇', "5'": '5̇', "6'": '6̇', "7'": '7̇',
    "1''": '1̈'
};

/**
 * 键位标定结果（自动持久化，两琴【独立】保存、互不干扰）：
 *   CALIB15 —— 15键钢琴。mode 决定当前生效的定位方式：
 *     'twopoint' 两点标定（grid: {colX:[5], rowY:[3]}，假设 3×5 均匀网格）
 *     'fullkey'  全键标定（keys: 15 个 {x,y} 屏幕百分比，逐键记录，
 *                不假设网格，游戏改键位布局也不怕）
 *     两种只能生效一种：最后一次做的是哪种，就以哪种为准（后做的覆盖）。
 *   CALIB7 —— 7键乐器，只支持全键标定（keys: 7 个 {x,y}）。
 * 都为空 = 用内建默认百分比（仅 15 键琴有默认值；7键琴必须先标定才能播）。
 */
var CALIB15 = { mode: null, grid: null, keys: null };
var CALIB7  = { keys: null };

/** 7键琴是否已完成 7 键全键标定（没标定就不能播放/测试）。 */
function calib7Ready() {
    return !!(CALIB7.keys && CALIB7.keys.length === 7 && CALIB7.keys[6]);
}

/** 启动提示用：当前乐器用的是哪种定位。 */
function calibStatusText() {
    if (CONFIG.instrument === 'lute7') {
        return calib7Ready() ? '已用7键全键标定' : '7键琴未标定（⚙设置→🔢全键标定）';
    }
    if (CALIB15.mode === 'fullkey')  return '已用15键全键标定';
    if (CALIB15.mode === 'twopoint') return '已用两点标定';
    return '内建键位（偏移大就点「🎯 标定」）';
}

/**
 * 取某个键的中心像素坐标（基于当前屏幕实际宽高）。
 * @param {number} idx  音级下标：15键琴 0~14（SCALE_ORDER），7键琴 0~6（= 音 1~7）
 * @returns {{x:number,y:number}|null}  7键琴未标定时返回 null（调用方要拦）
 */
function keyPos(idx) {
    var s = gameScreen();
    var px = null, py = null;
    if (CONFIG.instrument === 'lute7') {
        var k7 = CALIB7.keys ? CALIB7.keys[idx] : null;
        if (k7) { px = k7.x + (GRID_OFFSET.dx || 0); py = k7.y + (GRID_OFFSET.dy || 0); }
    } else if (CALIB15.mode === 'fullkey' && CALIB15.keys && CALIB15.keys[idx]) {
        px = CALIB15.keys[idx].x + (GRID_OFFSET.dx || 0);
        py = CALIB15.keys[idx].y + (GRID_OFFSET.dy || 0);
    } else {
        var rc = KEYMAP[SCALE_ORDER[idx]];
        var g = (CALIB15.mode === 'twopoint' && CALIB15.grid) ? CALIB15.grid : null;
        px = (g ? g.colX[rc[1]] : COL_X[rc[1]]) + (GRID_OFFSET.dx || 0);
        py = (g ? g.rowY[rc[0]] : ROW_Y[rc[0]]) + (GRID_OFFSET.dy || 0);
    }
    if (px == null || py == null) return null;
    return { x: Math.round(px * s.w), y: Math.round(py * s.h) };
}

/* ==========================================================================
 *  3. 内置曲库
 * ==========================================================================
 *  默认为空 —— 曲子全部从各乐器自己的文件夹读取（15键琴 QipaPiano/songs/、
 *  7键琴 QipaHarp/songs/），或在面板里「⌨ 输入导入曲谱」现打现用。
 *  想给脚本自带一套曲库方便分享，用下面的打包区（jianpu_tool.py bundle）。
 */

/**
 * 每首歌的字段（打包工具写进来的曲子也用这个格式）：
 *   name      显示名
 *   bpm       每分钟拍数（越大越快）。改这里就能整体变速。
 *   speed     速度倍率，1 = 原速，0.5 = 慢一倍，2 = 快一倍
 *   loop      循环遍数，1 = 播一遍
 *   startBeat 从第几拍开始（0 = 从头）      ← 裁长度
 *   endBeat   播到第几拍收尾（null = 到谱尾）← 裁长度
 *   tracks    音轨数组，每条 { name, on, notes }
 *             on = true  表示默认勾选，面板里可随时改
 *
 * 谱子里的 `|` 只是小节线方便你数拍子，不影响时值。
 * 一个 4/4 小节 = 4 拍。所以：想砍掉最后 4 小节，把 endBeat 减去 16 即可。
 */
var SONGS = [
    /* ======================================================================
     * 打包区 —— 别手改这里，也别删这两行标记。
     *   python3 jianpu_tool.py bundle QipaPiano.js --songs 曲谱目录 -o QipaPiano.js
     * 会把目录里所有 .txt / .json 转成 15 键简谱、规整对齐，然后写进这两个标记
     * 之间，产出一个「自带曲库、不依赖 /sdcard 目录」的单文件脚本。
     * （其实不打包也能用：把 .txt 丢进 songs/ 文件夹脚本启动就自动导入。
     *   打包只是为了方便整份分享。）
     * ==================================================================== */
    /* >>>> QIPA_SONGS_INJECT_START >>>> */
    /* <<<< QIPA_SONGS_INJECT_END <<<< */
];

/* ==========================================================================
 *  4. 工具函数
 * ========================================================================== */

var _screenCache = { w: 0, h: 0, dp: 3, ts: 0 };

/**
 * 当前屏幕的真实宽高（随横竖屏旋转实时更新）+ 像素密度。
 * UI 排版一律用它，绝不能假设方向。
 */
function screenSize() {
    var now = new Date().getTime();
    if (_screenCache.w && now - _screenCache.ts < 400) return _screenCache;
    try {
        var res = context.getResources();
        var dm = res.getDisplayMetrics();
        var w = dm.widthPixels, h = dm.heightPixels, d = dm.density;
        if (!(w > 0 && h > 0)) throw new Error('dm 无效');
        _screenCache = { w: w, h: h, dp: d > 0 ? d : 3, ts: now,
                         wdp: w / d, hdp: h / d };
    } catch (e) {
        var d2 = 3;                                // 拿不到 DisplayMetrics 时的保守密度
        _screenCache = { w: device.width, h: device.height, dp: d2, ts: now,
                         wdp: device.width / d2, hdp: device.height / d2 };
    }
    return _screenCache;
}

/**
 * 键位坐标系：奇葩战斗家是横屏游戏，钢琴键位百分比是按横屏实机截图标的。
 * 这里强制按「横屏那一边」解释百分比，保证脚本在竖屏下启动、进游戏转横屏后
 * 点击坐标依然正确。UI 排版不要用它。
 */
function gameScreen() {
    var s = screenSize();
    return s.h > s.w ? { w: s.h, h: s.w, dp: s.dp, wdp: s.hdp, hdp: s.wdp } : s;
}

/** 现在是不是已经横过来了（= 在游戏里）。只用于界面提示文案。 */
function isLandscapeNow() {
    var s = screenSize();
    return s.w >= s.h;
}

function logd(m) { if (CONFIG.verbose) log(m); }
function say(m)   { toast(m); }

/** 简易持久化（校准结果、用户改过的谱子）。 */
var _store = null;
var _BACKUP_OK = true;
function store() {
    if (!_store) {
        var raw = null;
        try { raw = storages.create('QipaPianoStore_v1'); _BACKUP_OK = true; }
        catch (e) { raw = { get: function (k, d) { return d; }, put: function () {}, remove: function () {} }; _BACKUP_OK = false; }
        /* 包装:put/remove 即同步导出设置备份 json(PC 网页经 adb 直读,实时同步) */
        _store = {
            get: function (k, d) { return raw.get(k, d); },
            put: function (k, v) { raw.put(k, v); try { backupStoreNow(); } catch (e) {} },
            remove: function (k) { if (raw.remove) raw.remove(k); try { backupStoreNow(); } catch (e) {} }
        };
        try { backupStoreNow(); } catch (e) {}   // 启动时先导一份
    }
    return _store;
}

/* ---- 设置备份(实时同步):storages 全量 -> /sdcard/QipaPiano/设置备份.json ----
 * PC 网页版(pc_piano)/api/phone/cache 经 adb 直读识别合并 */
var _BACKUP_PATH = '/sdcard/QipaPiano/设置备份.json';
var _BACKUP_KEYS = ['calib15', 'calib7', 'midiTonic', 'songTweaks', 'lastSelName', 'progressSuper'];
function backupStoreNow() {
    if (!_BACKUP_OK) return;   // storages 不可用时(兜底壳)不导出,免得写误导性空文件
    try {
        if (!files.exists(_BACKUP_PATH)) files.createWithDirs(_BACKUP_PATH);
        var s = store(), dump = {};
        for (var i = 0; i < _BACKUP_KEYS.length; i++) {
            var v = s.get(_BACKUP_KEYS[i], null);
            if (v !== null && v !== undefined) dump[_BACKUP_KEYS[i]] = v;
        }
        files.write(_BACKUP_PATH, JSON.stringify(dump));
    } catch (e) { try { logd('设置备份导出失败: ' + e); } catch (e2) {} }
}

/* ---- PC->手机 设置导入:PC 网页改的 起拍止拍/起音止音/进度 经 adb 推到
 * /sdcard/QipaPiano/设置导入.json,脚本每 15s 检查一次,按 ts 去重后合并。
 * 键格式与脚本一致: txt|piano15|曲名 / midi|piano15|曲名(txt 拍, midi 毫秒) ---- */
var _PC_IMPORT_PATH = '/sdcard/QipaPiano/设置导入.json';
function importSettingsFromPC() {
    try {
        if (!files.exists(_PC_IMPORT_PATH)) return;
        var o = JSON.parse(files.read(_PC_IMPORT_PATH));
        if (!o || !o.cache || !(o.ts > 0)) return;
        var s = store();
        var lastTs = s.get('pcImportTs', 0) || 0;
        if (o.ts <= lastTs) return;                       // 这份已合并过
        var tw = s.get('songTweaks', null) || {};
        var ps = s.get('progressSuper', null) || {};
        var n1 = 0, n2 = 0;
        for (var name in o.cache) {
            var e = o.cache[name] || {};
            var mode = e.mode === 'midi' ? 'midi' : 'txt';
            var key = mode + '|piano15|' + name;
            var v = tw[key] || { bpm: 0, speed: 1, loop: 1, startBeat: 0, endBeat: null };
            if (mode === 'txt') {
                if (e.startBeat != null) v.startBeat = e.startBeat;
                if (e.endBeat != null) v.endBeat = e.endBeat;
            } else {
                if (e.cutA != null) v.startBeat = e.cutA;
                if (e.cutB != null) v.endBeat = e.cutB;
            }
            tw[key] = v; n1++;
            if (e.posMs != null) {
                if (e.posMs > 0) { ps[key] = Math.max(0, Math.round(e.posMs)); n2++; }
                else delete ps[key];                      // PC 记 0 = 播完/已清,手机同步清
            }
        }
        s.put('songTweaks', tw);
        s.put('progressSuper', ps);
        s.put('pcImportTs', o.ts);                        // 记 watermark,下次不再重复合并
        logd('PC设置导入: 参数 ' + n1 + ' 首, 进度 ' + n2 + ' 首 (ts=' + o.ts + ')');
    } catch (e) { try { logd('PC设置导入失败: ' + e); } catch (e2) {} }
}
try { importSettingsFromPC(); } catch (e) {}              // 启动先查一次
try { setInterval(importSettingsFromPC, 15000); } catch (e) {}   // 服务器 vm 无 setInterval,吞掉(AutoX 真机有)

/** 把毫秒 sleep 拆成片段，便于随时中断。返回 false 表示被中止。 */
function interruptibleSleep(ms, isAlive) {
    var end = Date.now() + ms;
    while (Date.now() < end) {
        if (!isAlive()) return false;
        sleep(Math.min(8, end - Date.now()));
    }
    return isAlive();
}

/** 浮点数格式化（面板显示用）。 */
function fnum(n, d) {
    d = d || 2;
    var p = Math.pow(10, d);
    return Math.round(n * p) / p;
}

/** 是否在 UI 线程。 */
function onUi() {
    try { return !!(threads && threads.isUiThread && threads.isUiThread()); } catch (e) { return false; }
}

/** 安全地执行一段 UI 代码：已在 UI 线程就直接跑，否则 post 过去。 */
function uiRun(fn) {
    if (onUi()) { fn(); return; }
    try { ui.run(fn); } catch (e) { try { fn(); } catch (e2) { logd('uiRun 失败: ' + e2); } }
}

/**
 * 全局像素级微调（百分比）。标定完还差一点点时用面板里的 +/- 修。
 * 存在 storages 里，重启脚本仍然生效。
 */
var GRID_OFFSET = { dx: 0, dy: 0 };

/** 读取上次保存的标定与偏好（两琴标定独立存取）。 */
function loadCalibration() {
    try {
        var s = store();
        // 15键琴：新版 'calib15' 优先；老版本存的 'grid'（两点标定）自动迁入
        var c15 = s.get('calib15', null);
        if (c15 && c15.mode === 'fullkey' && c15.keys && c15.keys.length === 15) {
            CALIB15 = { mode: 'fullkey', grid: null, keys: c15.keys };
            logd('已载入 15键全键标定');
        } else {
            var g = (c15 && c15.mode === 'twopoint' && c15.grid) ? c15.grid : s.get('grid', null);
            if (g && g.colX && g.colX.length === 5 && g.rowY && g.rowY.length === 3) {
                CALIB15 = { mode: 'twopoint', grid: { colX: g.colX.slice(), rowY: g.rowY.slice() }, keys: null };
                logd('已载入 15键两点标定');
            }
        }
        // 7键琴标定（独立保存，切乐器也不会丢）
        var c7 = s.get('calib7', null);
        if (c7 && c7.keys && c7.keys.length === 7) {
            CALIB7 = { keys: c7.keys };
            logd('已载入 7键琴标定');
        }
        // 乐器模式 / 播放模式
        var inst = s.get('instrument', null);
        if (inst === 'lute7' || inst === 'piano15') CONFIG.instrument = inst;
        var ps2 = s.get('playSource', null);
        if (ps2 === 'midi' || ps2 === 'txt') CONFIG.playSource = ps2;
        var o = s.get('offset', null);
        if (o) { GRID_OFFSET.dx = o.dx || 0; GRID_OFFSET.dy = o.dy || 0; }
        var cm = s.get('clickMode', null);
        if (cm) CONFIG.clickMode = cm;
        var td = s.get('tapDuration', null);
        if (td) CONFIG.tapDuration = td;
        // panelScale 不再读存储：面板大小已固定为「小」档，
        // 免得以前切过「大」的机器把 1.0 又读回来。
        var mt = s.get('midiTonic', null);
        if (mt) CONFIG.midiTonic = mt;
        var pm = s.get('progressMode', null);
        if (pm === 'super' || pm === 'sub') CONFIG.progressMode = pm;
    } catch (e) { logd('载入标定失败: ' + e); }
}

function saveCalibration() {
    try {
        var s = store();
        if (CALIB15.mode) s.put('calib15', CALIB15); else s.remove('calib15');
        if (CALIB7.keys) s.put('calib7', CALIB7); else s.remove('calib7');
        s.put('instrument', CONFIG.instrument);
        s.put('playSource', CONFIG.playSource);
        s.put('offset', { dx: GRID_OFFSET.dx, dy: GRID_OFFSET.dy });
        s.put('clickMode', CONFIG.clickMode);
        s.put('tapDuration', CONFIG.tapDuration);
        s.put('midiTonic', CONFIG.midiTonic);
        s.put('progressMode', CONFIG.progressMode);
    } catch (e) { logd('保存标定失败: ' + e); }
}

/** 清除【当前乐器】的标定（7键琴清掉后需重新全键标定才能播放）。 */
function clearCalibration() {
    if (CONFIG.instrument === 'lute7') CALIB7 = { keys: null };
    else CALIB15 = { mode: null, grid: null, keys: null };
    GRID_OFFSET.dx = 0; GRID_OFFSET.dy = 0;
    saveCalibration();
}

/* ==========================================================================
 *  5. 简谱解析器
 * ========================================================================== */

/**
 * 解析告警的临时累加器（越界音、无法识别的记号等）。
 * ⚠ 它是【全局且会被每次 parseJianpu 清零】的，所以只能在 coerceTrack() 里
 *   解析完一条轨之后立刻用 summarizeWarns() 抄一份存到 track.warn 上。
 *   千万别在别处直接读它 —— 之前 buildTimeline() 直接读的就是它，
 *   读到的是"启动时扫曲库最后一条轨"留下的残渣，于是每一首曲子播起来
 *   都顶着同一句「无法识别的记号："_"」，跟当前曲子毫无关系。
 */
var PARSE_WARN = [];

/**
 * 把一堆告警压成人能看的几行：同一种「无法识别的记号」合并成一条带次数的，
 * 剩下的（越界音、和弦超复音数）去重保留。
 */
function summarizeWarns(list) {
    if (!list || !list.length) return [];
    var bad = {}, badN = 0, badKeys = [], others = {}, out = [];
    for (var i = 0; i < list.length; i++) {
        var m = /^无法识别的记号："(.*)"$/i.exec(list[i]);
        if (m) {
            var c = m[1] === '' ? '(空白)' : m[1];
            if (bad[c] == null) { bad[c] = 0; badKeys.push(c); }
            bad[c]++; badN++;
            continue;
        }
        if (!others[list[i]]) { others[list[i]] = 1; out.push(list[i]); }
    }
    if (badN) {
        var parts = [];
        for (var j = 0; j < badKeys.length; j++) parts.push('"' + badKeys[j] + '"×' + bad[badKeys[j]]);
        out.push('有 ' + badN + ' 处看不懂的记号被跳过：' + parts.join('、') +
                 '（_ 后面必须紧跟 1~7 才是八分音符，. 只能紧跟数字做附点，' +
                 '想表示休止请用 0）');
    }
    return out;
}

/** 去掉行注释：只认 `//`，避免把简谱里的 #4（升号）误当注释删掉。 */
function stripComments(s) {
    var out = [];
    var lines = String(s).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var a = lines[i].indexOf('//');
        out.push(a >= 0 ? lines[i].substring(0, a) : lines[i]);
    }
    return out.join('\n');
}

/** 下划线个数 + 附点 → 拍数。 _=0.5  __=0.25  附点=×1.5 */
function unitToDur(u, dotted) {
    var d = 1 / Math.pow(2, u);
    return dotted ? d * 1.5 : d;
}

/**
 * 音名 → 键下标(0~14)。
 * base: 1~7；oct: 0=中音, 1=高音, 2=倍高音, 负数=低音（键盘没有，按 CONFIG 折算）
 */
function resolveKeyIndex(base, oct) {
    if (!(base >= 1 && base <= 7)) return null;
    var raw = base + oct * 7 - 1;                 // 命中 0~14 即键盘上真实存在
    if (raw >= 0 && raw <= 14) return raw;

    var nm = base + (oct > 0 ? repeat("'", oct) : '') + (oct < 0 ? repeat(',', -oct) : '');
    PARSE_WARN.push('音 ' + nm + ' 超出 15 键范围');

    var mode = CONFIG.octaveFallback;
    if (mode === 'drop') return null;
    if (mode === 'octave') {
        var r2 = raw;
        while (r2 < 0) r2 += 7;
        while (r2 > 14) r2 -= 7;
        if (r2 >= 0 && r2 <= 14) return r2;
    }
    return Math.max(0, Math.min(14, raw));        // clamp：就近折算
}

function repeat(s, k) {
    var r = '';
    for (var i = 0; i < (k || 0); i++) r += s;
    return r;
}

var WS = ' \t\r\n\f\v';

/**
 * 从 s 的第 i 位读一个「音原子」： [^^][_][0-7][''][,,][.]
 * 读不到返回 null；成功返回 {base, oct, unit, dotted, next}
 */
function parseAtom(s, i, n) {
    var oct = 0, u = 0, started = i;
    while (i < n && (s.charAt(i) === '^' || s.charAt(i) === '_')) {
        if (s.charAt(i) === '^') oct++; else u++;
        i++;
    }
    var ch = s.charAt(i);
    if (!(ch >= '0' && ch <= '7')) return null;   // 允许 unit/前缀为空
    var base = parseInt(ch, 10);
    i++;
    while (i < n && s.charAt(i) === "'") { oct++; i++; }
    while (i < n && s.charAt(i) === ',') { oct--; i++; }
    var dotted = false;
    if (i < n && s.charAt(i) === '.') { dotted = true; i++; }
    if (i === started) return null;
    return { base: base, oct: oct, unit: u, dotted: dotted, next: i };
}

/**
 * 简谱文本 → 事件数组。
 * @returns {{events: Array<{beat:number, dur:number, keys:number[]}>, totalBeats:number}}
 */
function parseJianpu(text) {
    PARSE_WARN = [];
    var s = stripComments(text);
    var n = s.length, i = 0, beat = 0;
    var events = [], lastUnit = 1, lastEvent = null;

    while (i < n) {
        var ch = s.charAt(i);

        // 分隔符 / 小节线 / 括号：直接跳过
        if (WS.indexOf(ch) >= 0 || ch === '|' || ch === '(' || ch === ')' || ch === '{' || ch === '}') {
            i++; continue;
        }

        // 延音线：前一个音的时值再延一段，同时这段时间也要占掉
        if (ch === '-' || ch === '—') {
            if (lastEvent) lastEvent.dur += lastUnit;
            beat += lastUnit;
            i++; continue;
        }

        // ---- 和弦 [1 3 5] ----
        // 两种时值写法都收：
        //   标准写法（记号写在括号【里面】每个音上）: [_1 _3 _5]    [1 3 5.]
        //   转谱工具常写成（记号套在括号【外面】）  : _[1 3 5]     [1 3 5].    __[1 3 5].
        // 括号外面的 _ 和 . 以前解析器完全不认，会连报「无法识别的记号："_"」
        // 和「"."」，而且【这一拍的时值被整个丢掉】—— 谱子会越往后越快、节奏全乱。
        // 用户的 midi2jianpu.py 和 AI 转出来的谱子都爱这么写，所以这里一并兼容。
        var pf = i, ou = 0;
        while (pf < n && s.charAt(pf) === '_') { ou++; pf++; }
        if (pf < n && s.charAt(pf) === '[') {
            i = pf + 1;                                  // 跳到 '[' 之后
            var atoms = [];
            while (i < n && s.charAt(i) !== ']') {
                if (WS.indexOf(s.charAt(i)) >= 0 || s.charAt(i) === '|') { i++; continue; }
                var ca = parseAtom(s, i, n);
                if (!ca) { i++; continue; }
                atoms.push(ca); i = ca.next;
            }
            if (i < n) i++;                              // 跳过 ']'
            var od = false;
            if (i < n && s.charAt(i) === '.') { od = true; i++; }   // 括号后面的附点
            if (!atoms.length) continue;

            // 写在外面 = 明确要统一整个和弦的时值，优先于括号里第一个音的记号
            var cu = ou > 0 ? ou : atoms[0].unit;
            var cd = od || atoms[0].dotted;
            var dur = unitToDur(cu, cd);
            var ks = [];
            for (var q = 0; q < atoms.length; q++) {
                var ki = resolveKeyIndex(atoms[q].base, atoms[q].oct);
                if (ki !== null && ks.indexOf(ki) < 0) ks.push(ki);
            }
            if (atoms.length > CONFIG.maxVoices) {
                PARSE_WARN.push('和弦 ' + atoms.length + ' 音超过 maxVoices，只按前 ' + CONFIG.maxVoices);
                ks = ks.slice(0, CONFIG.maxVoices);
            }
            var cev = { beat: beat, dur: dur, keys: ks };
            events.push(cev);
            beat += dur;
            lastUnit = unitToDur(cu, false);
            lastEvent = ks.length ? cev : null;
            continue;
        }

        // 单音 / 休止
        var at = parseAtom(s, i, n);
        if (!at) {
            PARSE_WARN.push('无法识别的记号："' + ch + '"');
            i++; continue;
        }
        i = at.next;
        var d2 = unitToDur(at.unit, at.dotted);

        if (at.base === 0) {                        // 休止符：只推进时间
            beat += d2;
            lastUnit = unitToDur(at.unit, false);
            lastEvent = null;
            continue;
        }
        var k2 = resolveKeyIndex(at.base, at.oct);
        var ev = { beat: beat, dur: d2, keys: k2 === null ? [] : [k2] };
        events.push(ev);
        beat += d2;
        lastUnit = unitToDur(at.unit, false);
        lastEvent = ev.keys.length ? ev : null;
    }

    return { events: events, totalBeats: beat };
}

/** 拍 → 毫秒。 */
function beatToMs(beat, bpm, speed) {
    return beat * (60000 / (bpm || CONFIG.defaultBpm)) / (speed || 1);
}

/* ==========================================================================
 *  6. JSON 谱解析器
 * ========================================================================== */

/** 全角/中文标点 → 半角，避免从微信、备忘录粘谱子时解析失败。 */
function normalizeText(s) {
    return String(s)
        .replace(/[\uFF10-\uFF19]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/[\uFF20]/g, '@')                              // 全角＠：微信里打 @bpm 常变全角
        .replace(/[\uFF1A]/g, ':')                              // 全角冒号：@bpm：96
        .replace(/[\u2018\u2019\u02CA\u00B4\u02BC\uFF07]/g, "'")
        .replace(/[\uFF3E\u2227]/g, '^')
        .replace(/[\uFF3F]/g, '_')
        .replace(/[\uFF0E]/g, '.')
        .replace(/[\u2014\u2013\uFF0D]/g, '-')
        .replace(/[\uFF5C]/g, '|')
        .replace(/[\uFF3B]/g, '[')
        .replace(/[\uFF3D]/g, ']')
        .replace(/[\uFF08]/g, '(')
        .replace(/[\uFF09]/g, ')')
        .replace(/[\uFF0C]/g, ',')
        .replace(/[\u3010]/g, '[')
        .replace(/[\u3011]/g, ']')
        .replace(/[\u3000]/g, ' ');
}

/** 任意写法的音名 → 键下标。支持 "1"、"1'"、"1''"、"^1"、8~15 的音级编号。 */
function keyNameToIndex(v) {
    if (typeof v === 'number') {
        var r = Math.round(v) - 1;
        return (r >= 0 && r <= 14) ? r : null;
    }
    var t = normalizeText(v).trim();
    if (!t) return null;
    if (/^\d+$/.test(t) && t.length >= 2) {          // "10" 当作音级编号
        var r2 = parseInt(t, 10) - 1;
        if (r2 >= 0 && r2 <= 14) return r2;
    }
    var at = parseAtom(t, 0, t.length);
    if (!at) return null;
    return resolveKeyIndex(at.base, at.oct);
}

/**
 * 结构化事件列表归一化。支持这些写法：
 *   {beat:0, keys:["1","3'"], dur:1}     beat/dur 单位 = 拍
 *   {b:0, k:"1", d:1}                    简写字段
 *   {t:0, n:"1'"}                        t/dur 单位 = 毫秒（整条轨进入 msMode）
 *   [0, "1'"]                            [毫秒, 音名]
 *   {ms:0, keys:[1,6]}                   keys 用数字时＝1~15 音级编号
 *                                        1=中音1 … 7=中音7, 8=高音1 … 14=高音7, 15=倍高音1
 */
function normalizeEvents(arr) {
    var out = [], maxBeat = 0, msMode = false;
    for (var i = 0; i < arr.length; i++) {
        var e = arr[i], beat = null, dur = 1, raw = [];

        if (Array.isArray(e)) {
            raw = [e[1]]; beat = e[0]; msMode = true;
        } else if (e && typeof e === 'object') {
            if (e.beat != null) beat = e.beat;
            else if (e.b != null) beat = e.b;
            else if (e.t != null) { beat = e.t; msMode = true; }
            else if (e.ms != null) { beat = e.ms; msMode = true; }
            if (e.dur != null) dur = e.dur;
            else if (e.d != null) dur = e.d;
            else if (e.len != null) dur = e.len;
            var kk = e.keys != null ? e.keys : (e.k != null ? e.k : e.n);
            if (kk == null) continue;
            raw = Array.isArray(kk) ? kk : [kk];
        }
        if (beat == null) continue;

        var ks = [];
        for (var j = 0; j < raw.length; j++) {
            var idx = keyNameToIndex(raw[j]);
            if (idx !== null && ks.indexOf(idx) < 0) ks.push(idx);
        }
        out.push({ beat: beat, dur: dur, keys: ks });
        if (beat > maxBeat) maxBeat = beat;
    }
    return { events: out, totalBeats: maxBeat + 1, msMode: msMode };
}

/**
 * 把「一段任意格式的谱子」变成音轨。
 * 输入可以是简谱字符串、JSON 字符串、事件数组或 {notes:...} / {events:[...]} 对象。
 * @returns {{name:string, on:boolean, events:Array, totalBeats:number, msMode:boolean, bpm:number|null}}
 */
function coerceTrack(raw, fallName) {
    var name = fallName || '音轨';
    var body = raw, bpm = null, srcNotes = '';

    if (typeof raw === 'string') {
        var t = raw.trim();
        if (t.charAt(0) === '{' || t.charAt(0) === '[') {
            try { body = JSON.parse(t); } catch (e) { body = raw; }
        } else {
            body = raw;
        }
    }
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        if (body.name) name = body.name;
        if (body.bpm) bpm = body.bpm;
        if (body.notes != null) body = body.notes;
        else if (body.events != null) body = body.events;
        else if (body.data != null) body = body.data;
    }

    var res;
    PARSE_WARN = [];                         // 每条轨单独统计，别串味
    if (Array.isArray(body)) {
        res = normalizeEvents(body);
    } else {
        srcNotes = String(body == null ? '' : body);
        res = parseJianpu(normalizeText(srcNotes));
        res.msMode = false;
    }
    return {
        name: name,
        on: true,
        events: res.events,
        totalBeats: res.totalBeats,
        msMode: !!res.msMode,
        bpm: bpm,
        srcNotes: srcNotes,
        warn: summarizeWarns(PARSE_WARN)     // 这条轨自己的解析告警，buildTimeline 按轨取
    };
}

/**
 * 整首曲子的归一化：接受 SONGS 里的对象、或外部 .json 内容。
 * 输出统一结构，供时间轴合成使用。
 */
function coerceSong(src, fname) {
    var o = src;
    if (typeof src === 'string') {
        var t = src.trim();
        if (t.charAt(0) === '{' || t.charAt(0) === '[') {
            try { o = JSON.parse(t); } catch (e) { o = { tracks: [{ name: fname || '导入谱', notes: src }] }; }
        } else {
            o = { tracks: [{ name: fname || '导入谱', notes: src }] };
        }
    }
    if (Array.isArray(o)) o = { tracks: [{ name: fname || '导入谱', events: o }] };
    if (!o || typeof o !== 'object') o = { tracks: [] };

    // 起止拍必须是有限数字：JSON 里手滑写了 "to":"尾" 之类，NaN 会裁空整首歌
    function numOrNull(v, dft) {
        if (v == null) return dft;
        var f = parseFloat(v);
        return isNaN(f) ? dft : f;
    }
    var song = {
        name: o.name || o.title || o.song || fname || '未命名',
        bpm: parseFloat(o.bpm || o.tempo || CONFIG.defaultBpm) || CONFIG.defaultBpm,
        speed: parseFloat(o.speed != null ? o.speed : (o.rate != null ? o.rate : 1)) || 1,
        loop: o.loop != null ? (parseInt(o.loop, 10) || 1) : 1,
        startBeat: numOrNull(o.startBeat != null ? o.startBeat : o.from, 0),
        endBeat: numOrNull(o.endBeat != null ? o.endBeat : o.to, null),
        tracks: []
    };

    var tr = o.tracks || o.track || o.parts || o.voices;
    if (!tr) tr = (o.notes || o.events) ? [o] : [];
    if (!Array.isArray(tr)) tr = [tr];

    for (var i = 0; i < tr.length; i++) {
        var tk = coerceTrack(tr[i], '音轨 ' + (i + 1));
        tk.on = (tr[i] && tr[i].on != null) ? !!tr[i].on : (tr[i] && tr[i].enabled != null ? !!tr[i].enabled : true);
        if (song.tracks.length === 0 && tk.bpm) song.bpm = tk.bpm;
        song.tracks.push(tk);
    }
    return song;
}

/* ==========================================================================
 *  6b. MIDI 解析 + 转简谱（手机上直接导入 .mid，不用电脑、不用 Termux）
 * ==========================================================================
 *
 *  这一节是电脑上那个 midi2jianpu.py 的 JS 版，两边算法完全一致
 *  （时值表、吸附规则、和弦分组、补拍对齐、选调打分都对着抄的），
 *  所以同一个 .mid 在电脑上和手机上转出来的谱子是同一份。
 *
 *  流程： parse() 读二进制 -> chooseTonic() 挑主音 -> trackToJianpu() 出简谱
 *         -> padTo() 各轨补齐等长 -> 组成 coerceSong() 认识的结构。
 *
 *  ⚠ 全部只用 files.readBytes()（二进制）读文件，绝不能用 files.read()（文本），
 *    文本读会把 MIDI 里的 0x00~0xFF 按字符编码转换掉，字节就废了。
 *  ⚠ Rhino 里 Java byte[] 的元素是【有符号】的（-128~127），每一处取用都要 & 0xFF。
 *  ⚠ 这一节跑在脚本线程上，不碰任何控件；控件那部分在 UI.importMidi() 里。
 */

var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];      // do re mi fa sol la si 的半音偏移
var PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 面板「调:」按钮循环的候选主音，等价于 midi2jianpu.py 的 --tonic。 */
var TONIC_CHOICES = ['auto', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** 时值表：[拍数, 下划线个数, 是否附点, 尾巴上的延音线]。和 Python 版一字不差。 */
var DUR_TABLE = [
    [4.0,   0, false, ' - - -'],
    [3.0,   0, false, ' - -'],
    [2.0,   0, false, ' -'],
    [1.5,   0, true,  ''],
    [1.0,   0, false, ''],
    [0.75,  1, true,  ''],
    [0.5,   1, false, ''],
    [0.375, 2, true,  ''],
    [0.25,  2, false, ''],
    [0.125, 3, false, '']
];

/** 读成字节数组。files.readBytes 是首选，某些 AutoX 版本没有就用 Java 流兜底。 */
function readFileBytes(path) {
    try {
        if (files.readBytes) {
            var b = files.readBytes(path);
            if (b && b.length) return b;
        }
    } catch (e) { logd('files.readBytes 不可用(' + e + ')，改用 Java 流'); }
    var fis = null;
    try {
        fis = new java.io.FileInputStream(new java.io.File(path));
        var size = fis.available();
        var buf = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, Math.max(size, 1));
        var got = 0, r;
        while (got < buf.length && (r = fis.read(buf, got, buf.length - got)) > 0) got += r;
        if (got < buf.length) {                    // available() 报少了就重开一次精确读
            buf = java.util.Arrays.copyOf(buf, got);
        }
        return buf;
    } finally {
        try { if (fis) fis.close(); } catch (e2) {}
    }
}

/** 字节数组按下标取无符号值。 */
function u8(bytes, i) { return bytes[i] & 0xFF; }

/** 读 MIDI 的变长数值（VLV），返回 [值, 新的下标]。 */
function vlv(bytes, i) {
    var value = 0;
    for (var k = 0; k < 4; k++) {                  // MIDI 规定 VLV 最多 4 字节
        if (i >= bytes.length) throw new Error('VLV 读到数据末尾，文件可能损坏');
        var b = u8(bytes, i++);
        value = (value << 7) | (b & 0x7F);
        if (!(b & 0x80)) return [value, i];
    }
    throw new Error('VLV 超过 4 字节，文件可能损坏');
}

/** ASCII 头比对：'MThd' / 'MTrk'。 */
function tag4(bytes, i, tag) {
    for (var k = 0; k < 4; k++) if (u8(bytes, i + k) !== tag.charCodeAt(k)) return false;
    return true;
}

/** 32 位大端无符号整数。 */
function u32(bytes, i) {
    return ((u8(bytes, i) * 16777216) + (u8(bytes, i + 1) << 16) + (u8(bytes, i + 2) << 8) + u8(bytes, i + 3));
}

/**
 * 解析一个 MTrk：配对 note_on / note_off，顺带抽轨名、tempo、拍号。
 * 时间单位统一换算成【拍】（1 拍 = PPQ 个 tick），这样后面不用管 tempo 变化。
 */
function parseTrack(bytes, from, to, tpb) {
    var notes = [];                              // [起始拍, 拍数, 音高]
    var pending = {};                            // '通道,音高' -> 起始拍
    var nameRaw = null, tempos = [], timesig = null;
    var tick = 0, i = from, running = -1, drums = 0;

    while (i < to) {
        var vr = vlv(bytes, i);
        tick += vr[0]; i = vr[1];
        if (i >= to) break;
        var status = u8(bytes, i);
        if (status < 0x80) status = running;     // running status：复用上一条状态字节
        else { running = status; i++; }
        if (status < 0) break;

        if (status === 0xFF) {                   // 元事件
            var mtype = u8(bytes, i++);
            var ml = vlv(bytes, i); var mlen = ml[0]; i = ml[1];
            if (mtype === 0x03 && !nameRaw) {         // 轨名：存原始字节，交给 decodeUtf8Arr
                nameRaw = [];
                for (var q = 0; q < mlen && i + q < to; q++) {
                    var c0 = u8(bytes, i + q);
                    if (c0 === 0) break;
                    nameRaw.push(c0);
                }
            } else if (mtype === 0x51 && mlen === 3) { // tempo
                tempos.push((u8(bytes, i) << 16) | (u8(bytes, i + 1) << 8) | u8(bytes, i + 2));
            } else if (mtype === 0x58 && mlen >= 2) {  // 拍号
                timesig = [u8(bytes, i), Math.pow(2, u8(bytes, i + 1))];
            }
            i += mlen;
        } else if (status === 0xF0 || status === 0xF7) {   // sysex，整段跳过
            var sl = vlv(bytes, i); i = sl[1] + sl[0];
        } else if ((status & 0xF0) === 0x80 || (status & 0xF0) === 0x90 ||
                   (status & 0xF0) === 0xA0 || (status & 0xF0) === 0xB0 || (status & 0xF0) === 0xE0) {
            if (i + 2 > to) break;
            var d1 = u8(bytes, i), d2 = u8(bytes, i + 1);
            i += 2;
            var ch = status & 0x0F, hi = status & 0xF0;
            if (CONFIG.midiSkipDrums && ch === 9) {       // GM 标准的鼓轨，没有音高
                if (hi === 0x90 && d2 > 0) drums++;
                continue;
            }
            if (hi === 0x90 && d2 > 0) {                  // note on
                pending[ch + ',' + d1] = tick / tpb;
            } else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) {   // note off
                var key = ch + ',' + d1;
                if (pending[key] != null) {
                    var st = pending[key];
                    delete pending[key];
                    var dur = tick / tpb - st;
                    if (dur > 0) notes.push([st, dur, d1]);
                }
            }
        } else if ((status & 0xF0) === 0xC0 || (status & 0xF0) === 0xD0) {
            i += 1;                                       // 一字节数据事件
        } else {
            i += 1;                                       // 认不出来就往前挪一格，别死循环
        }
    }
    // 到轨尾还没等到 note_off 的（有些 MIDI 就这么写的），按轨尾收尾
    var left = 0;
    for (var k2 in pending) {
        var st2 = pending[k2];
        var dur2 = tick / tpb - st2;
        if (dur2 > 0) { notes.push([st2, dur2, parseInt(k2.split(',')[1], 10)]); left++; }
    }
    notes.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });  // 同起点长的在前
    return { nameRaw: nameRaw, name: decodeUtf8Arr(nameRaw), notes: notes,
             tempos: tempos, timesig: timesig, drums: drums, unclosed: left };
}

/**
 * 把字节数组按 UTF-8 解码成字符串；只要有一个字节不合 UTF-8 规范就返回 ''。
 * MIDI 的文本元事件没规定编码，国内软件导出的常常是 GBK，
 * 硬按 UTF-8 逐字节 String.fromCharCode 会得到一堆「Ã¥Â°Â­」式的乱码，
 * 那种名字显示在面板上比直接叫「音轨2」还难看，所以这里宁可识别失败退回空串。
 */
function decodeUtf8Arr(arr) {
    if (!arr || !arr.length) return '';
    var out = '', i = 0;
    while (i < arr.length) {
        var c = arr[i++];
        if (c < 0x80) { out += String.fromCharCode(c); continue; }
        if (c < 0xC2) return '';                                  // 非法首字节
        var need = (c < 0xE0) ? 1 : (c < 0xF0) ? 2 : (c < 0xF5) ? 3 : -1;
        if (need < 0) return '';
        if (i + need > arr.length) return '';
        var cp = c & ((need === 1) ? 0x1F : (need === 2) ? 0x0F : 0x07);
        for (var k = 0; k < need; k++) {
            var b = arr[i++];
            if ((b & 0xC0) !== 0x80) return '';
            cp = (cp << 6) | (b & 0x3F);
        }
        if (cp >= 0x10000) {
            cp -= 0x10000;
            out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
        } else {
            out += String.fromCharCode(cp);
        }
    }
    return out.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

/** 轨名清洗：解码失败的退回「音轨N」，还要避开会把 [轨名] 认成和弦的写法。 */
function midiTrackName(t, idx) {
    var nm = (t && t.name ? t.name : '').replace(/[\]\[\r\n]/g, '').trim();
    if (!nm) return '音轨' + (idx + 1);
    // parseTxtSong 是靠「[xxx] 里含非音符字符」区分轨名和和弦的：
    // 一条真叫 "1 3 5" 的轨会被当成和弦行，整段谱子就错位了。
    if (/^[\s0-7_|'^,.\-]*$/.test(nm)) return '轨 ' + nm;
    return nm.substring(0, 24);
}

/**
 * 解析整个 SMF（格式 0/1）。
 * @returns {{tpb:number, format:number, tracks:Array, tempo:number, timesig:Array, tempoChanges:number}}
 */
function parseMidi(path) {
    var bytes = readFileBytes(path);
    if (!bytes || bytes.length < 22) throw new Error('文件太小，不像 MIDI');
    if (!tag4(bytes, 0, 'MThd')) {
        throw new Error('不是标准 MIDI（缺 MThd 头）。RMID/.kar 请先另存为 .mid');
    }
    var fmt = (u8(bytes, 8) << 8) | u8(bytes, 9);
    var ntrk = (u8(bytes, 10) << 8) | u8(bytes, 11);
    var div = (u8(bytes, 12) << 8) | u8(bytes, 13);
    if (div & 0x8000) throw new Error('这是 SMPTE 时基的 MIDI，先另存成 PPQ 时基的 .mid');
    if (div <= 0) throw new Error('PPQ 时基无效');

    var tracks = [], allTempos = [], i = 14, timesig = null;
    for (var t = 0; t < ntrk; t++) {
        if (i + 8 > bytes.length || !tag4(bytes, i, 'MTrk')) break;   // 后面的轨缺失，已解析的照样用
        var len = u32(bytes, i + 4);
        i += 8;
        var end = Math.min(i + len, bytes.length);
        var tr = parseTrack(bytes, i, end, div);
        i = i + len;
        tracks.push(tr);
        allTempos = allTempos.concat(tr.tempos);
        if (tr.timesig && !timesig) timesig = tr.timesig;
    }
    if (!tracks.length) throw new Error('没有解析出任何 MTrk 轨');
    // 速度取【第一个】tempo 事件（开头标的那个）。取最后一个的话，
    // 带渐慢的 MIDI 会拿到收尾那个极慢值 —— 兰亭序就是这样被读成 24 BPM 的。
    return {
        tpb: div, format: fmt, tracks: tracks,
        tempo: allTempos.length ? allTempos[0] : 500000,
        tempoChanges: Math.max(0, allTempos.length - 1),
        timesig: timesig || [4, 4]
    };
}

/* ---------------------------- 调性 / 音区 ---------------------------- */

/** 音名 -> MIDI 音高。'C'/'F#'/'Bb'/'D4'，不写八度默认第 4 八度。认不出返回 null。 */
function nameToMidi(name) {
    var m = /^([A-Ga-g])([#b]*)\s*(-?\d+)?$/.exec(String(name || '').trim());
    if (!m) return null;
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
    var acc = m[2] || '';
    for (var i = 0; i < acc.length; i++) base += (acc.charAt(i) === '#') ? 1 : -1;
    var oct = m[3] ? parseInt(m[3], 10) : 4;
    return (oct + 1) * 12 + base;
}

/**
 * MIDI 音高 -> 键下标 0~14。
 * tonic = 「中音 1(do)」对应的 MIDI 音高。
 * 返回 {idx, degree, oct, accidental, moved}；idx=null 表示被 drop 掉了。
 *   accidental = 这个音不在大调音阶上（键盘没黑键，只能就近取整）
 *   moved      = 超出 15 键范围，按 oor 策略挪过
 */
function pitchToIndex(pitch, tonic, baseOct, oor) {
    var rel = pitch - tonic;
    var octv = Math.floor(rel / 12);
    var rem = rel - octv * 12;
    var best = 0, bestD = 99;                    // 最近的大调音级
    for (var d = 0; d < 7; d++) {
        var dd = Math.abs(rem - MAJOR_SCALE[d]);
        if (dd < bestD) { bestD = dd; best = d; }
    }
    var accidental = rem !== MAJOR_SCALE[best];
    var idx = best + 7 * (octv + (baseOct || 0));
    var r = { base: best, oct: octv + (baseOct || 0) };
    if (idx >= 0 && idx <= 14) {
        return { idx: idx, degree: r.base, oct: r.oct, accidental: accidental, moved: false };
    }
    if (oor === 'drop') return { idx: null, degree: r.base, oct: r.oct, accidental: accidental, moved: true };
    if (oor === 'fold') {
        while (idx < 0) idx += 7;
        while (idx > 14) idx -= 7;
        if (idx >= 0 && idx <= 14) return { idx: idx, degree: r.base, oct: r.oct, accidental: accidental, moved: true };
    }
    return { idx: Math.max(0, Math.min(14, idx)), degree: r.base, oct: r.oct, accidental: accidental, moved: true };
}

/** 一组音符 [[起始拍,拍数,音高],...] → {音高:次数} 统计（逐轨挑调用）。 */
function countsOf(notes) {
    var c = {};
    for (var i = 0; i < notes.length; i++) c[notes[i][2]] = (c[notes[i][2]] || 0) + 1;
    return c;
}

/**
 * 解析一条音轨该用的主音。
 * manual = 面板上单独指定的音名（'C'/'F#'…，'auto'/空 = 自动）：
 *   手动时把该音名在【各个八度】上都试一遍（连带 baseOct -1~1），
 *   挑落键率最高的那个 —— 手选 'C' 不代表非得用中央 C，哪个八度合适用哪个。
 * 自动时用这条轨自己的音符分布挑最优主音（每轨独立，互不牵连）。
 * @returns {{tonic:number, baseOct:number}}
 */
function resolveTrackTonic(notes, manual, oor) {
    var counts = countsOf(notes);
    if (manual && manual !== 'auto') {
        var pc = nameToMidi(manual);
        if (pc !== null) {
            var pcn = pc % 12, best = null;
            for (var t = pcn; t <= 127; t += 12) {
                for (var bo = -1; bo <= 1; bo++) {
                    var st = mappingStats(counts, t, bo, oor);
                    var score = 3 * st.clean - st.accidental - st.outOfRange;
                    if (!best || score > best.score) best = { tonic: t, baseOct: bo, score: score };
                }
            }
            if (best) return { tonic: best.tonic, baseOct: best.baseOct };
        }
    }
    var pick = chooseTonic(counts, oor);
    return { tonic: pick.tonic, baseOct: pick.baseOct };
}

/** 只看「不折叠不夹取的原始下标」和是否升降音，用来给主音打分。 */
function rawIndex(pitch, tonic, baseOct) {
    var rel = pitch - tonic;
    var octv = Math.floor(rel / 12);
    var rem = rel - octv * 12;
    var best = 0, bestD = 99;
    for (var d = 0; d < 7; d++) {
        var dd = Math.abs(rem - MAJOR_SCALE[d]);
        if (dd < bestD) { bestD = dd; best = d; }
    }
    return [best + 7 * (octv + (baseOct || 0)), rem !== MAJOR_SCALE[best]];
}

/** 键下标 0~14 -> 简谱音名（1 / 1' / 1''）。 */
function indexToName(idx) {
    var oct = Math.floor(idx / 7);
    var s = String((idx % 7) + 1);
    for (var i = 0; i < oct; i++) s += "'";
    return s;
}

/**
 * 统计「这套主音 + 八度」的覆盖情况。
 * counts = {midi音高: 出现次数}，必须【按实际音符数加权】——
 * 一个只在结尾响过一次的极高音，和一个从头到尾的主旋律音，权重差几百倍。
 * 返回 {clean, accidental, outOfRange, total, lo, hi}。
 */
function mappingStats(counts, tonic, baseOct, oor) {
    var keys = [], clean = 0, acc = 0, oor2 = 0, total = 0, lo = 127, hi = 0;
    for (var p in counts) keys.push(parseInt(p, 10));
    if (!keys.length) return { clean: 0, accidental: 0, outOfRange: 0, total: 0, lo: 60, hi: 60 };
    keys.sort(function (a, b) { return a - b; });
    lo = keys[0]; hi = keys[keys.length - 1];
    for (var i = 0; i < keys.length; i++) {
        var w = counts[keys[i]];
        total += w;
        var m = pitchToIndex(keys[i], tonic, baseOct, oor);
        if (m.idx === null) continue;
        if (m.accidental) acc += w; else clean += w;
        if (m.moved) oor2 += w;
    }
    return { clean: clean, accidental: acc, outOfRange: oor2, total: total, lo: lo, hi: hi };
}

/**
 * 自动挑主音。打分口径（越大越好）：
 *      3 × 干净音 ─ 升降音 ─ 超范围音
 *   · 干净音   = 不用折叠、也不是升降音，原样弹出来就对
 *   · 升降音   = 键盘没黑键，只能就近取整（最影响听感的就是这个）
 *   · 超范围音 = 要按整八度折叠
 * 平分时优先 baseOct=0、主音离中央 C 近。
 *
 * ⚠ 别改回「先只比落键数最多、升降音当次要项」那种字典序：
 *   兰亭序那样会被定到 C 调，289 个音要折算（24.5%）；按这个口径是 D 调，
 *   只要折算 35 个（3%），听感差别非常直接。
 * @returns {{tonic:number, baseOct:number, stats:object}}
 */
function chooseTonic(counts, oor) {
    var keys = [];
    for (var p in counts) keys.push(parseInt(p, 10));
    if (!keys.length) return { tonic: 60, baseOct: 0, stats: mappingStats(counts, 60, 0, oor) };
    keys.sort(function (a, b) { return a - b; });
    var lo = keys[0], hi = keys[keys.length - 1];

    var best = null;
    for (var tonic = Math.max(0, lo - 12); tonic <= Math.min(127, hi + 12); tonic++) {
        for (var bo = -1; bo <= 1; bo++) {
            var clean = 0, acc = 0, oorN = 0;
            for (var i = 0; i < keys.length; i++) {
                var w = counts[keys[i]];
                var ri = rawIndex(keys[i], tonic, bo);
                var inRange = ri[0] >= 0 && ri[0] <= 14;
                if (inRange) { if (ri[1]) acc += w; else clean += w; }
                else { oorN += w; if (ri[1]) acc += w; }
            }
            var score = (oor === 'drop') ? (3 * clean - acc - 3 * oorN) : (3 * clean - acc - oorN);
            var key = [score, -Math.abs(bo), -Math.abs(tonic - 60)];
            if (!best || key[0] > best[0] ||
                (key[0] === best[0] && (key[1] > best[1] || (key[1] === best[1] && key[2] > best[2])))) {
                best = key.concat([tonic, bo]);
            }
        }
    }
    var tn = best[3], bo2 = best[4];
    return { tonic: tn, baseOct: bo2, stats: mappingStats(counts, tn, bo2, oor) };
}

/* ---------------------------- 生成简谱 ---------------------------- */

/** 把拍数就近吸附到时值表，返回 [下划线数, 是否附点, 尾巴延音线, 吸附后拍数, 误差]。 */
function fmtSpec(beats) {
    var best = null;
    for (var i = 0; i < DUR_TABLE.length; i++) {
        var d = DUR_TABLE[i][0];
        var err = Math.abs(beats - d);
        if (best === null || err < best[0]) best = [err, DUR_TABLE[i]];
    }
    var t = best[1];
    return [t[1], t[2], t[3], t[0], best[0]];
}

/** 一个音原子的写法： `_` * 八分数 + 音名 + 附点。 */
function atomText(name, unit, dotted) {
    var s = '';
    for (var i = 0; i < unit; i++) s += '_';
    return s + name + (dotted ? '.' : '');
}

/**
 * 时值表里「不超过 gap」的最大一档，用来避免补休止符时冲过头。
 */
function largestDur(gap) {
    var best = 0;
    for (var i = 0; i < DUR_TABLE.length; i++) if (DUR_TABLE[i][0] <= gap + 1e-6 && DUR_TABLE[i][0] > best) best = DUR_TABLE[i][0];
    return best;
}

/** 时值表里离 v 最近的档（打平取小）。 */
function nearestTier(v) {
    var best = DUR_TABLE[0][0], bd = Math.abs(v - best);
    for (var i = 1; i < DUR_TABLE.length; i++) {
        var d = Math.abs(v - DUR_TABLE[i][0]);
        if (d < bd) { bd = d; best = DUR_TABLE[i][0]; }
    }
    return best;
}

/**
 * 一条轨的音符 -> 简谱文本。
 * notes: [[起始拍, 拍数, midi音高], ...]，已按起点排序。
 *   · 同一时刻（相差 < 1/64 拍）的多个音合成 [a b c] 和弦
 *   · 音与音之间的空隙补 0 休止符
 *   · 跨小节插 |（纯视觉分隔，不占时值）
 * 返回 {text, beats, notes, warn:[]}
 *
 * ⚠ 和弦的时值记号必须写在【方括号里面每个音上】（`[_1 _3 _5]`、`[1. 3. 5.]`），
 *   不能套在括号外面（`_[1 3 5]`、`[1 3 5].`）。解析器读 `[` 时是拿括号里
 *   第一个音的 _ 和 . 当整个和弦的时值 —— 写在外面虽然新版解析器也兼容，
 *   但老版会当成「无法识别的记号」跳过、把这一拍的时值整个丢掉，
 *   曲子越走越快，各轨还各丢各的，于是冒出「各音轨长度不一致」。
 */
function trackToJianpu(notes, tonic, baseOct, beatsPerBar, oor) {
    var warn = [];
    if (!notes.length) return { text: '', beats: 0, notes: 0, warn: warn };
    var EPS = 1 / 64;

    // ---- 同一时刻的音归成一组 ----
    var groups = [];                            // [起始拍, [音高...], 拍数]
    for (var i = 0; i < notes.length; i++) {
        var st = notes[i][0], dur = notes[i][1], pitch = notes[i][2];
        var g = groups.length ? groups[groups.length - 1] : null;
        if (g && Math.abs(g[0] - st) < EPS) {
            g[1].push(pitch);
            if (dur > g[2]) g[2] = dur;
        } else {
            groups.push([st, [pitch], dur]);
        }
    }

    var tokens = [], pos = 0, dropped = 0, shifted = 0, accN = 0;
    function barMark(beatAfter) {
        if (beatsPerBar > 0 && Math.floor(beatAfter / beatsPerBar + 1e-6) > Math.floor(pos / beatsPerBar + 1e-6)) {
            tokens.push('|');
        }
    }

    for (var gi = 0; gi < groups.length; gi++) {
        var beat = groups[gi][0], pitches = groups[gi][1], gdur = groups[gi][2];

        // 前面的空隙补休止符
        var guard = 0;
        while (beat - pos > EPS && guard++ < 10000) {
            var gap = beat - pos;
            var sp = fmtSpec(gap), txt = atomText('0', sp[0], sp[1]) + sp[2], snapped = sp[3];
            if (snapped > gap + EPS) {                       // 吸附后反而越过下一个音的起点，退一档
                var ld2 = largestDur(gap);
                if (ld2 <= 0) break;                         // 残余空隙不足最小档（0.125拍）：宁可少填
                                                             // 让这个音稍微提前，也别硬塞一档 —— 硬塞会把
                                                             // 后面每个音越推越晚（棘轮漂移的另一半来源）。
                                                             // 提前量 ≤ 0.125 拍，且下一次补隙会自动往回收。
                snapped = ld2;
                var sp2 = fmtSpec(snapped);
                txt = atomText('0', sp2[0], sp2[1]) + sp2[2]; snapped = sp2[3];
            }
            tokens.push(txt);
            var before = pos; pos += snapped;
            barMark(pos);
            if (beat - pos <= EPS) break;
        }

        // 去重 + 映射到 15 键
        var uniq = [];
        for (var pi = 0; pi < pitches.length; pi++) {
            var m = pitchToIndex(pitches[pi], tonic, baseOct, oor);
            if (m.idx !== null && uniq.indexOf(m.idx) < 0) uniq.push(m.idx);
            else if (m.idx === null) dropped++;
            if (m.moved) shifted++;
            if (m.accidental) accN++;
        }
        uniq.sort(function (a, b) { return a - b; });
        if (!uniq.length) continue;

        var spc = fmtSpec(gdur), snapped2 = spc[3];
        // ---- 防时序棘轮（转谱和直读“对不上调”的主因）----
        // 简谱里下一个音的位置 = 前面所有时值之和。三连音（1/3 拍）、
        // 松散的人性化节拍在时值表里没有对应档位，时值一律吸附到更大的档；
        // 连奏（前一个音没完下一个就进来）更是让“时值之和”远超真实起点。
        // 位置只能往后加不能往回收，误差单调累积——三连音乐曲一首能漂出去
        // 一两分钟，多轨各自漂各自的，和声全部错位，听着就是“按的键不对”。
        // 修法：下一个音的真实起点是已知的，本音的书写时值取【离
        // “到下一音还剩多少”最近的一档】—— 每处误差被压到半档以内且
        // 带负反馈（晚了下一个取小档、早了取大档，自动回中），漂移不再
        // 累积；连奏音还能按到几乎贴着下一个音，长音更满。
        var nextT = (gi + 1 < groups.length) ? groups[gi + 1][0] : -1;
        if (nextT >= 0 && snapped2 > (nextT - pos) + EPS) {
            var capped = Math.max(0.125, nearestTier(nextT - pos));
            spc = fmtSpec(capped);
            snapped2 = spc[3];
        }
        if (uniq.length === 1) {
            tokens.push(atomText(indexToName(uniq[0]), spc[0], spc[1]) + spc[2]);
        } else {
            var body = [];
            for (var ui = 0; ui < uniq.length; ui++) body.push(atomText(indexToName(uniq[ui]), spc[0], spc[1]));
            tokens.push('[' + body.join(' ') + ']' + spc[2]);
        }
        if (snapped2 < 0.125) snapped2 = 0.125;
        var pb = pos; pos += snapped2;
        barMark(pos);
    }

    if (shifted) warn.push(shifted + ' 个音超出 15 键范围，已' + (oor === 'fold' ? '按整八度折叠' : (oor === 'drop' ? '丢弃' : '就近压到边界键')));
    if (dropped) warn.push(dropped + ' 个音被丢弃');
    if (accN) warn.push(accN + ' 个音不在大调音阶上（升降音），已就近取整到音阶内');
    return { text: tokens.join(' ').replace(/\s*\|\s*/g, ' | ').trim(), beats: pos, notes: notes.length, warn: warn };
}

/**
 * 用休止符把一条轨补到 targetBeats 拍。
 * 真实 MIDI 里各轨长度几乎总是不一样（打击乐只有前几小节、装饰音轨只有开头一下），
 * 不补齐多轨合奏到后面就只剩长的那条在响，脚本也会报「各音轨长度不一致」。
 */
function padTo(text, curBeats, targetBeats, beatsPerBar) {
    if (targetBeats - curBeats <= 1e-6) return text;
    var toks = text.split(/\s+/), pos = curBeats, out = [];
    for (var i = 0; i < toks.length; i++) if (toks[i]) out.push(toks[i]);
    var guard = 0;
    while (pos < targetBeats - 1e-6 && guard++ < 20000) {
        var gap = targetBeats - pos;
        var sp = fmtSpec(gap), txt = atomText('0', sp[0], sp[1]) + sp[2], snapped = sp[3];
        if (snapped > gap + 1e-6) {
            snapped = Math.max(0.125, largestDur(gap));
            var sp2 = fmtSpec(snapped); txt = atomText('0', sp2[0], sp2[1]) + sp2[2]; snapped = sp2[3];
        }
        out.push(txt);
        var before = pos; pos += snapped;
        if (beatsPerBar > 0 && Math.floor(pos / beatsPerBar + 1e-6) > Math.floor(before / beatsPerBar + 1e-6)) out.push('|');
    }
    return out.join(' ');
}

/** 长简谱按宽度折行；`|` 前留一格，行尾不留悬空小节线，和弦绝不跨行。 */
function wrapJianpu(text, width) {
    var raw = text.split(/\s+/), toks = [], buf = '', depth = 0;
    for (var i = 0; i < raw.length; i++) {                 // 把 [a b c] 粘回一个 token
        var t = raw[i];
        if (!t) continue;
        if (!buf) { buf = t; } else { buf += ' ' + t; }
        for (var k = 0; k < t.length; k++) {
            if (t.charAt(k) === '[') depth++;
            else if (t.charAt(k) === ']') depth = Math.max(0, depth - 1);
        }
        if (depth === 0) { toks.push(buf); buf = ''; }
    }
    if (buf) toks.push(buf);
    while (toks.length && toks[toks.length - 1] === '|') toks.pop();
    var lines = [], cur = '';
    for (var j = 0; j < toks.length; j++) {
        var piece = (j === 0) ? toks[j] : (toks[j] === '|' ? ' |' : ' ' + toks[j]);
        if (cur && cur.length + piece.length > (width || 96)) { lines.push(cur.replace(/\s+$/, '')); cur = piece.replace(/^\s+/, ''); }
        else cur += piece;
    }
    if (cur.replace(/\s/g, '')) lines.push(cur.replace(/\s+$/, ''));
    return lines.join('\n');
}

/**
 * 把一个 .mid 文件转成曲库能用的一首歌（并可选写一份 .txt 到曲谱目录）。
 * @returns {{song:object, report:string[], path:string|null, file:string}}
 */
function midiToSong(path, opt) {
    opt = opt || {};
    var rpt = [];
    var midi = parseMidi(path);

    // ---- 曲名：--name > 文件名 ----
    // 不用 MIDI 里的标题轨：轨名是二进制字节，国内软件导出的多半是 GBK，
    // 在这里按字节读出来必然乱码（「兰亭序」会变成一串「Ã¥Â°Â­Ã¤ÂºÂ­Ã¥ÂºÂ
    // 序」），乱码进了曲名比用文件名难看得多。想要中文名就把 .mid 文件本身
    // 改成中文名，或者转完在 ✎编辑谱 里改。
    var base = String(path).split(/[\\/]/).pop() || 'import';
    base = base.replace(/\.(mid|midi|rmi)$/i, '');
    var name = opt.name || base;

    // ---- 挑出有音符的轨 ----
    var picked = [];
    for (var i = 0; i < midi.tracks.length; i++) {
        var tr = midi.tracks[i];
        if (!tr.notes.length) continue;
        picked.push({ t: tr, idx: i });
    }
    if (!picked.length) throw new Error('这份 MIDI 里一个音符都没有（可能只有鼓轨/控制轨）');

    // ---- 统计音高分布，挑主音 ----
    var counts = {}, total = 0;
    for (var a = 0; a < picked.length; a++) {
        for (var b = 0; b < picked[a].t.notes.length; b++) {
            var p = picked[a].t.notes[b][2];
            counts[p] = (counts[p] || 0) + 1;
            total++;
        }
    }
    var oor = opt.oor || CONFIG.midiOor || 'fold';
    var tonic, baseOct;
    if (opt.tonic) {
        tonic = nameToMidi(opt.tonic);
        if (tonic === null) throw new Error('认不出主音 "' + opt.tonic + '"，要写成 C / F# / Bb / D4 这样');
        baseOct = 0;
    } else if (CONFIG.midiTonic && CONFIG.midiTonic !== 'auto') {
        tonic = nameToMidi(CONFIG.midiTonic);
        if (tonic === null) throw new Error('CONFIG.midiTonic "' + CONFIG.midiTonic + '" 认不出，要写成 C / F# / Bb');
        baseOct = 0;
    } else {
        var pick = chooseTonic(counts, oor);
        tonic = pick.tonic; baseOct = pick.baseOct;
    }
    var stats = mappingStats(counts, tonic, baseOct, oor);
    // 逐轨各用各的主音（MIDI 直读模式「转化选中MIDI」用）：占位，循环里逐轨覆盖
    var usePerTrack = !!(opt.trackTonics && opt.trackTonics.length);

    var bpm = opt.bpm || (midi.tempo ? Math.round(60000000 / midi.tempo) : CONFIG.defaultBpm);
    var bar = opt.bar || CONFIG.midiBeatsPerBar ||
              (midi.timesig ? (midi.timesig[0] * 4 / midi.timesig[1]) : 4) || 4;

    // ---- 逐轨转简谱 ----
    var work = [];
    if ((opt.mono || CONFIG.midiMono) && !usePerTrack) {
        var merged = [];
        for (var m1 = 0; m1 < picked.length; m1++) merged = merged.concat(picked[m1].t.notes);
        merged.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
        work.push({ name: '主旋律', notes: merged, drums: 0 });
    } else {
        for (var m2 = 0; m2 < picked.length; m2++) {
            work.push({ name: midiTrackName(picked[m2].t, m2), notes: picked[m2].t.notes,
                        drums: picked[m2].t.drums || 0 });
        }
    }

    var made = [], maxBeats = 0;
    for (var w = 0; w < work.length; w++) {
        var tw = tonic, bw2 = baseOct;
        if (usePerTrack) {
            // 每条轨用自己的主音：指定了就用指定值（绝对音高），没指定就这条轨自动挑
            if (opt.trackTonics[w] != null) { tw = opt.trackTonics[w]; bw2 = 0; }
            else { var pk2 = chooseTonic(countsOf(work[w].notes), oor); tw = pk2.tonic; bw2 = pk2.baseOct; }
        }
        var r = trackToJianpu(work[w].notes, tw, bw2, bar, oor);
        made.push({ name: work[w].name, r: r, tonic: tw });
        if (r.beats > maxBeats) maxBeats = r.beats;
    }

    // ---- 补休止符，各轨对齐到等长 ----
    var padded = 0;
    for (var pd = 0; pd < made.length; pd++) {
        if (maxBeats - made[pd].r.beats > 0.01) {
            made[pd].text = padTo(made[pd].r.text, made[pd].r.beats, maxBeats, bar);
            padded++;
        } else {
            made[pd].text = made[pd].r.text;
        }
    }

    // ---- 拼成 .txt（和 midi2jianpu.py 的输出格式一致），再喂回脚本自己的解析器 ----
    // 这样"手机上导入的"和"把 .txt 放进 songs 目录后导入的"必然是同一首歌，
    // 不会有第二条代码路径偷偷跑偏。
    var lines = [];
    lines.push('@name ' + name);
    lines.push('@bpm ' + bpm);
    lines.push('');
    lines.push('// 由 QipaPiano.js 内置的 MIDI 转谱生成（源文件：' + base + '）');
    if (usePerTrack) {
        lines.push('//   各轨主音 1(do)：' + made.map(function (m) {
            return m.name + '=' + PITCH_NAMES[m.tonic % 12];
        }).join('  ') + '   ' + Math.round(maxBeats) + ' 拍   ' + bpm + ' BPM');
    } else {
        lines.push("//   主音 1(do) = " + PITCH_NAMES[tonic % 12] + (Math.floor(tonic / 12) - 1) +
                   '   ' + Math.round(maxBeats) + ' 拍   ' + bpm + ' BPM');
    }
    lines.push('');
    for (var L2 = 0; L2 < made.length; L2++) {
        lines.push('[' + made[L2].name + ']');
        lines.push(wrapJianpu(made[L2].text, 96));
        lines.push('');
    }
    var txt = lines.join('\n').replace(/\s+$/, '') + '\n';

    var song = parseTxtSong(txt, name);
    song.source = 'midi:' + base;

    // ---- 报告 ----
    rpt.push('曲名 ' + name + '  ·  ' + bpm + ' BPM  ·  ' + midi.format + ' 格式  ·  PPQ ' + midi.tpb);
    if (usePerTrack) {
        rpt.push('按各轨单独的调转化：' + made.map(function (m) {
            return m.name + ' 的 1(do)=' + PITCH_NAMES[m.tonic % 12] + (Math.floor(m.tonic / 12) - 1);
        }).join(' · '));
    } else {
        rpt.push('主音 1(do) = ' + PITCH_NAMES[tonic % 12] + (Math.floor(tonic / 12) - 1) +
                 (opt.tonic || (CONFIG.midiTonic && CONFIG.midiTonic !== 'auto') ? '（手动指定）' : '（自动挑的，面板「调:」可切）'));
    }
    if (!usePerTrack && stats.total) {
        rpt.push('共 ' + stats.total + ' 个音：原样弹对 ' + stats.clean + ' (' +
                 Math.round(1000 * stats.clean / stats.total) / 10 + '%)' +
                 (stats.accidental ? '，' + stats.accidental + ' 个是升降音已就近折算' : '') +
                 (stats.outOfRange ? '，' + stats.outOfRange + ' 个超出 15 键已折叠' : ''));
    }
    rpt.push(made.length + ' 条轨  ·  ' + Math.round(maxBeats) + ' 拍  ≈ ' +
             Math.round(maxBeats * 60 / bpm * ((song.loop || 1))) + ' 秒' +
             (padded ? '  ·  ' + padded + ' 条短轨已补休止符对齐' : ''));
    if (midi.tempoChanges) {
        rpt.push('⚠ 原曲有 ' + midi.tempoChanges + ' 处变速，脚本只能按固定 ' + bpm + ' BPM 播，时长会有出入');
    }
    if (stats.total && stats.accidental / stats.total > 0.15) {
        rpt.push('⚠ 升降音折算超过 15%，听感会跑调。用面板「调:」按钮换个主音重试，挑"原样弹对"最高的那个');
    }
    for (var ww = 0; ww < made.length; ww++) {
        for (var wq = 0; wq < made[ww].r.warn.length; wq++) rpt.push('· [' + made[ww].name + '] ' + made[ww].r.warn[wq]);
    }

    // ---- 写一份 .txt 到曲谱目录，重启脚本后还在 ----
    var wrote = null;
    if (CONFIG.midiWriteTxt !== false) {
        try {
            ensureDirs();
            var safe = String(name).replace(/[\\/:*?"<>|]/g, '_');
            wrote = files.join(songDirOf(), safe + '.txt');
            files.write(wrote, txt);
            rpt.push('已写出 ' + wrote);
        } catch (e) { wrote = null; rpt.push('⚠ 写 .txt 失败（' + e + '），这次只在内存里，重启就没了'); }
    }
    return { song: song, report: rpt, path: wrote, file: base, beats: maxBeats, bpm: bpm,
             tonic: tonic, stats: stats, text: txt };
}

/* ==========================================================================
 *  7. 时间轴合成（多轨道合并）
 * ========================================================================== */

/**
 * 7键乐器模式：只保留音 1~7（键下标 0~6），谱子里的高音 / 倍高音等
 * 超出 7 键的音直接跳过（不折算 —— 7 键琴没有可折算的地方）。
 * 15键钢琴模式原样返回。
 * @returns {Array|null} 过滤后的键数组；全被跳过时返回 []
 */
function filterKeysForInstrument(keys) {
    if (CONFIG.instrument !== 'lute7' || !keys) return keys;
    var out = [];
    for (var i = 0; i < keys.length; i++) if (keys[i] <= 6) out.push(keys[i]);
    return out;
}

/**
 * 多音轨合并成一条「绝对时间轴」。
 *
 * @param {object} song  coerceSong() 的输出
 * @param {object} opt   { bpm, speed, loop, startBeat, endBeat, trackIdx:[], mergeWindow, minGap }
 * @returns {{chords:Array<{ms:number,keys:number[],dur:number,label:string}>,
 *            totalMs:number, count:number, adjusted:number, notes:string[]}}
 */
function buildTimeline(song, opt) {
    opt = opt || {};
    var bpm   = opt.bpm       || song.bpm       || CONFIG.defaultBpm;
    var speed = (opt.speed    || 1) * (song.speed || 1);
    var loop  = opt.loop      != null ? opt.loop : (song.loop || 1);
    var sel   = opt.trackIdx  || song.tracks.map(function (_, i) { return i; });
    var minGap = opt.minGap   != null ? opt.minGap : CONFIG.minNoteGap;
    var mergeW = opt.mergeWindow != null ? opt.mergeWindow : 3;   // ms

    var notes = [];          // 人类可读提示
    var raw = [];            // {ms, keys, durMs}
    var skip7 = 0;           // 7键模式下被跳过的超出 1~7 的音数

    for (var s = 0; s < sel.length; s++) {
        var tk = song.tracks[sel[s]];
        if (!tk || !tk.events) continue;
        var ev = tk.events;
        for (var i = 0; i < ev.length; i++) {
            var e = ev[i];
            if (!e.keys || !e.keys.length) continue;
            var ks0 = filterKeysForInstrument(e.keys);
            if (!ks0.length) { skip7 += e.keys.length; continue; }   // 7键模式：这拍没有 1~7 的音
            var ms, durMs;
            if (tk.msMode) { ms = e.beat; durMs = e.dur || minGap; }
            else { ms = beatToMs(e.beat, bpm, speed); durMs = beatToMs(e.dur || 1, bpm, speed); }
            raw.push({ ms: ms, keys: ks0.slice(), durMs: durMs, track: tk.name });
        }
    }

    // 段落裁剪：startBeat / endBeat 的单位跟随「整首歌」的时间基准。
    // 只有当所有被选中的音轨都是毫秒轴时，它们才按毫秒解释；
    // 否则按拍解释（一首歌里混进一条毫秒轨不会影响裁剪窗口）。
    var selObjs = [];
    for (var si = 0; si < sel.length; si++) {
        var st = song.tracks[sel[si]];
        if (st && st.events) selObjs.push(st);
    }
    var allMs = selObjs.length > 0 && selObjs.every(function (t) { return t.msMode; });
    function toMs(v) {
        if (v == null) return null;
        return allMs ? v : beatToMs(v, bpm, speed);
    }
    var cutA = toMs(opt.startBeat != null ? opt.startBeat : song.startBeat);
    var cutB = toMs(opt.endBeat   != null ? opt.endBeat   : song.endBeat);
    if (cutA == null) cutA = 0;
    if (cutB == null) {
        var mx = 0;
        for (var m = 0; m < raw.length; m++) {
            var endm = raw[m].ms + (raw[m].durMs || 0);
            if (endm > mx) mx = endm;
        }
        cutB = mx;
    }
    if (cutB <= cutA) cutB = cutA + 1;

    var seg = [];
    for (var r = 0; r < raw.length; r++) {
        if (raw[r].ms >= cutA && raw[r].ms < cutB) {
            seg.push({ ms: raw[r].ms - cutA, keys: raw[r].keys, durMs: raw[r].durMs });
        }
    }
    var segLen = (cutB - cutA);

    // 循环
    var all = [];
    for (var L = 0; L < Math.max(1, loop); L++) {
        for (var g = 0; g < seg.length; g++) {
            all.push({ ms: seg[g].ms + L * segLen, keys: seg[g].keys, durMs: seg[g].durMs });
        }
    }
    all.sort(function (a, b) { return a.ms - b.ms; });

    // 合并同一瞬间的和弦（跨音轨）
    var merged = [];
    for (var a2 = 0; a2 < all.length; a2++) {
        var e2 = all[a2];
        var last = merged.length ? merged[merged.length - 1] : null;
        if (last && e2.ms - last.ms <= mergeW) {
            for (var k = 0; k < e2.keys.length; k++) {
                if (last.keys.indexOf(e2.keys[k]) < 0) last.keys.push(e2.keys[k]);
            }
            last.ms = Math.min(last.ms, e2.ms);
            last.durMs = Math.max(last.durMs || 0, e2.durMs || 0);
        } else {
            merged.push({ ms: e2.ms, keys: e2.keys.slice(), durMs: e2.durMs });
        }
    }

    // limit 复音数量（手机点不过来时保住节奏）
    for (var q = 0; q < merged.length; q++) {
        if (merged[q].keys.length > CONFIG.maxVoices) {
            merged[q].keys = merged[q].keys.slice(0, CONFIG.maxVoices);
        }
    }

    // 强制最小间隔，过密处顺延（会拉长总时长，UI 会提示）
    var adjusted = 0, prev = -1e9;
    var chords = [];
    for (var c = 0; c < merged.length; c++) {
        var cm = merged[c].ms;
        if (cm < prev + minGap) { cm = prev + minGap; adjusted++; }
        prev = cm;
        chords.push({
            ms: Math.round(cm),
            keys: merged[c].keys,
            dur: merged[c].durMs || minGap,
            label: merged[c].keys.map(function (i) { return KEY_LABEL[SCALE_ORDER[i]]; }).join('')
        });
    }

    var totalMs = chords.length ? chords[chords.length - 1].ms + Math.max(chords[chords.length - 1].dur, minGap) : 0;

    if (!chords.length) notes.push('这条时间轴是空的：检查音轨是否勾选、段落范围是否切掉了所有音符' +
        (skip7 ? '（7键模式还跳过了 ' + skip7 + ' 个超出 1~7 的音）' : ''));
    if (skip7) notes.push('7键模式：已跳过 ' + skip7 + ' 个超出 1~7 的音（高音/倍高音）');
    if (adjusted) notes.push('谱子太密，有 ' + adjusted + ' 处被自动顺延（总时长变长了，可降低 bpm 或提高 minNoteGap 上限）');

    // 多轨长度不一致：说明谱子里某条轨的小节数写错了，后半段会只剩一条轨在响
    if (selObjs.length > 1) {
        function trackEnd(tk) {
            // 优先用解析器算好的 totalBeats：它把休止符也算进去了。
            // 只遍历 events 会漏掉末尾的 0（休止不产生事件），
            // 于是一条「1'' 0 - - - | 0 - - - | 0 - -」的 12 拍轨会被当成只有 1 拍，
            // 明明对齐了却误报「长度不一致」。
            if (!tk.msMode && tk.totalBeats != null && tk.totalBeats > 0) return tk.totalBeats;
            var b = 0;
            for (var z = 0; z < tk.events.length; z++) {
                var e2 = tk.events[z];
                if (e2.beat + (e2.dur || 0) > b) b = e2.beat + (e2.dur || 0);
            }
            return b;
        }
        var beatTks = selObjs.filter(function (t) { return !t.msMode; });
        if (beatTks.length > 1) {
            var lo = Infinity, hi = -Infinity, loN = '', hiN = '';
            beatTks.forEach(function (t) {
                var e3 = trackEnd(t);
                if (e3 < lo) { lo = e3; loN = t.name; }
                if (e3 > hi) { hi = e3; hiN = t.name; }
            });
            if (hi - lo > 0.01) {
                notes.push('各音轨长度不一致：「' + hiN + '」' + Math.round(hi) + ' 拍 vs「' + loN + '」' +
                           Math.round(lo) + ' 拍 —— 第 ' + Math.round(lo) + ' 拍之后只剩长的轨在响，请补小节');
            }
        }
    }

    // 解析告警：只报【这首歌、而且被勾中的那几条轨】自己的（track.warn，
    // 在 coerceTrack 里解析当时就抄下来的）。
    // 以前这里直接读全局 PARSE_WARN —— 那玩意只保留"最后一次 parseJianpu"
    // 的结果，通常是启动扫曲库时最后一首歌留下的残渣，结果每一首曲子播起来
    // 都顶着同一句「无法识别的记号："_"」，跟当前曲子根本没关系，查都没法查。
    if (selObjs.length) {
        var seenW = {};
        for (var si2 = 0; si2 < selObjs.length; si2++) {
            var wl = selObjs[si2].warn;
            if (!wl || !wl.length) continue;
            for (var wi = 0; wi < wl.length; wi++) {
                if (seenW[wl[wi]]) continue;
                seenW[wl[wi]] = 1;
                notes.push((song.tracks.length > 1 ? '「' + selObjs[si2].name + '」' : '') + wl[wi]);
            }
        }
    }

    return { chords: chords, totalMs: totalMs, count: chords.length, adjusted: adjusted, notes: notes };
}

/** 谱子总拍数（面板上显示，方便你算 endBeat）。 */
function songTotalBeats(song) {
    var mx = 0;
    for (var i = 0; i < song.tracks.length; i++) {
        var t = song.tracks[i];
        if (t.msMode) continue;
        var tb = t.totalBeats || 0;
        if (!tb && t.events) {
            tb = 0;
            for (var j = 0; j < t.events.length; j++) tb = Math.max(tb, t.events[j].beat + (t.events[j].dur || 0));
        }
        if (tb > mx) mx = tb;
    }
    return mx;
}

/* ==========================================================================
 *  8. 播放引擎
 * ========================================================================== */

/**
 * 分档按压：按音符时长 + 到下一音的间隔，判定落在哪一档按压时长上。
 * 返回 0 = 用默认短按（tapDuration），否则返回档位毫秒数。
 * 不做逐毫秒实时计算 —— 只在固定档位表里挑「塞得进去」的最大一档，
 * 并留 30ms 余量保证不把下一个音挤晚。
 */
function pickPressTier(durMs, gapMs) {
    if (!CONFIG.pressByDuration) return 0;
    var cap = Math.min(durMs || 0, (gapMs == null || !isFinite(gapMs)) ? (durMs || 0) : gapMs - 30);
    if (cap < 30) return 0;                      // 间隙太窄：退回默认短按
    var tiers = CONFIG.pressTiers, pick = 0;
    for (var i = 0; i < tiers.length; i++) if (tiers[i] <= cap) pick = tiers[i];
    return pick;
}

/**
 * 单次点击。chord=true 时用更短的按压时长，保证和弦够紧凑。
 * pressDur 传分档按压时长（0 = 未启用分档，用 tapDuration 默认值）。
 */
function doTap(x, y, chord, pressDur) {
    try {
        if (CONFIG.clickMode === 'root') {
            shell('input tap ' + x + ' ' + y, true);
            return;
        }
        if (CONFIG.clickMode === 'click') { click(x, y); return; }
        var d = pressDur || (chord ? CONFIG.chordTap : CONFIG.tapDuration);
        if (!press(x, y, d)) click(x, y);        // press 失败（API < 24 等）退回 click
    } catch (e) {
        try { click(x, y); } catch (e2) { logd('tap 失败: ' + e2); }
    }
}

/** 点击位置的红色圆点提示，方便确认打点是否落在键上。 */
var _flashWin = null;
function flashInit() {
    if (_flashWin || !CONFIG.clickFlash) return;
    try {
        clearInterrupt();
        _flashWin = floaty.rawWindow(
            '<text w="52" h="52" gravity="center" text="●" textSize="40sp" ' +
            'textColor="#99FF2222" bg="#00000000" />'
        );
        _flashWin.setTouchable(false);
        winSetPos(_flashWin, -999, -999);
    } catch (e) { _flashWin = null; logd('flash 窗口创建失败: ' + e); }
}
function flash(x, y) {
    if (!_flashWin) return;
    // 窗口是按 dp 建的（52dp），真实像素边长 = 52 × 屏幕密度。
    // 原来这里写死 x-26 / y-26（像素），只在 density=1 时才居中，
    // 手机上红点会整体偏到琴键的右下方，看着像"点歪了"。
    var r = Math.round(26 * screenSize().dp);
    winSetPos(_flashWin, x - r, y - r);
}
function flashClose() {
    try { if (_flashWin) _flashWin.close(); } catch (e) {}
    _flashWin = null;
}

/** 阻塞到目标时间戳，中途可被停止打断。alive() 返回 false 即立刻退出。 */
function waitUntil(ts, alive) {
    var ok = alive || function () { return Player.running; };
    var d = ts - Date.now();
    while (d > 30 && ok()) { sleep(25); d = ts - Date.now(); }
    if (d > 0 && ok()) sleep(d);
    return ok();
}

/**
 * 播放引擎。在独立线程里按绝对时间轴点击，
 * 用时间戳累加法避免 sleep 误差逐拍漂移。
 */
var Player = {
    running: false,
    thread: null,
    gen: 0,              // 播放代数；stop() 会让旧线程立刻失去 running 标记，避免竞态复活
    index: 0,
    timeline: null,
    cb: null,

    /**
     * @param {object} tl  buildTimeline() 的输出
     * @param {object} cb  { tick(i,total,chord), stop(finished) }
     */
    play: function (tl, cb) {
        this.stop();
        this.timeline = tl;
        this.cb = cb || {};
        this.running = true;
        this.index = 0;
        this._saveOnExit = true;          // 停止时是否把续播位置写进内存缓存（切歌=false）
        var myGen = ++this.gen;

        var self = this;
        this.thread = threads.start(function () {
            flashInit();          // 在本线程建窗口，避免从 UI 线程创建 floaty 时死锁
            var mine = function () { return self.running && self.gen === myGen; };
            var chords = tl.chords;
            // 续播：tl.resumeMs > 0 时跳过已播过的时间点，时间轴原点前移
            // （t0 -= resumeMs），后面的 waitUntil 逻辑一行都不用改
            var startMs = tl.resumeMs || 0;
            var i = 0;
            while (i < chords.length && chords[i].ms < startMs) i++;
            var t0 = Date.now() - startMs;
            logd('▶ 开始播放，共 ' + chords.length + ' 个时间点' +
                 (startMs > 0 ? '（从 ' + (startMs / 1000).toFixed(1) + 's 续播，跳过 ' + i + ' 个）' : ''));
            try {
                while (mine() && i < chords.length) {
                    if (!waitUntil(t0 + chords[i].ms, mine)) break;
                    self.index = i;
                    var ks = chords[i].keys;
                    var isChord = ks.length > 1;
                    if (self.cb.tick) { try { self.cb.tick(i, chords.length, chords[i]); } catch (e) {} }
                    var gapMs = (i + 1 < chords.length) ? (chords[i + 1].ms - chords[i].ms) : Infinity;
                    for (var k = 0; k < ks.length; k++) {
                        if (!mine()) break;
                        var p = keyPos(ks[k]);
                        if (!p) continue;               // 该键没有可用坐标（如 7键琴未标定）
                        flash(p.x, p.y);
                        // 延音手感：单音按「音符时长分档」按压，和弦保持短按齐响
                        doTap(p.x, p.y, isChord, isChord ? 0 : pickPressTier(chords[i].dur, gapMs));
                        if (isChord && k < ks.length - 1) sleep(CONFIG.chordSpread);
                    }
                    i++;
                }
            } catch (err) {
                // 停止播放时 Auto.js 会给线程打 ScriptInterruptedException，
                // 这是正常路径，不能当错误报出来（否则日志里一片红，
                // 而且容易让人以为脚本坏了）。
                var es = String(err && err.message ? err.message : err);
                var nm = String((err && err.name) || (err && err.constructor && err.constructor.name) || '');
                if (es.indexOf('Interrupted') >= 0 || nm.indexOf('Interrupted') >= 0 || !mine()) {
                    logd('播放已停止');
                } else {
                    logd('播放异常: ' + es);
                }
            }
            if (self.gen === myGen) self.running = false;
            // 续播位置记账：没播完且用户叫停 → 记住停在哪；自然播完 → 清掉；
            // 一首都没推进 → 也清。超缓存模式下切歌（doStop(false)）照样记——
            // 它就是要每首歌各记各的。
            if (tl.wantResume && tl.resumeKey) {
                if (i >= chords.length) progressClear(tl.resumeKey);
                else if (i > 0 && (self._saveOnExit || CONFIG.progressMode === 'super')) progressSave(tl.resumeKey, chords[i].ms);
                else if (i === 0 && startMs === 0) progressClear(tl.resumeKey);
            }
            if (self.cb.stop) { try { self.cb.stop(i >= chords.length, i); } catch (e) {} }
        });
    },

    /**
     * 停止播放。
     * 【不】调用 thread.interrupt()：Auto.js 里 interrupt 会给线程打上
     * ScriptInterruptedException，这个中断标志可能污染到脚本的其他线程，
     * 实测会让随后的 floaty 建窗抛 "RuntimeException: InterruptedException"
     * 直接崩掉面板。改用 running + gen 代数标记，配合 waitUntil 每 25ms
     * 轮询一次，停止延迟仍然在一个音符以内，安全得多。
     * @param {boolean} saveResume 传 false = 这次停止不记续播位置（切歌时用）
     */
    stop: function (saveResume) {
        // 亚缓存模式：切歌（doStop(false)）不记续播；超缓存模式：切歌也记
        //（它就是要每首歌各记各的进度）。
        if (saveResume === false && CONFIG.progressMode !== 'super') this._saveOnExit = false;
        this.running = false;
        this.gen++;                       // 让仍在跑的旧线程立刻失效
        this.thread = null;
    },

    /** 进度 0~1。 */
    progress: function () {
        if (!this.timeline || !this.timeline.count) return 0;
        return Math.min(1, this.index / this.timeline.count);
    }
};

/* ---------- 播放进度记录（亚缓存 / 超缓存）----------
 * 亚缓存 = 内存单槽 {key, ms}：只记当前歌的暂停位置，播放别的音乐即覆盖，
 *          退出脚本失效；按用户的定义，单纯切歌【不清】——切回原曲还能续。
 * 超缓存 = 持久化到 storages（'progressSuper' 字典，每首歌各记各的）：
 *          切歌/重启脚本都在；自然播完一首清一首；唯一全清办法 = 切回亚缓存。
 * 写入时机只有「停止/播完」那一刻（播放过程零写入），切歌毫无卡顿。
 */
var _resumePos = null;   // 亚缓存的槽

function resumeKeyOf(song) { return tweakKey() + '|' + song.name; }
function progressSave(key, ms) {
    ms = Math.max(0, Math.round(ms));
    if (CONFIG.progressMode === 'super') {
        try {
            var d = store().get('progressSuper', null) || {};
            d[key] = ms;
            store().put('progressSuper', d);
        } catch (e) { logd('超缓存写入失败: ' + e); }
    } else {
        _resumePos = { key: key, ms: ms };
    }
}
function progressTake(song) {
    var key = resumeKeyOf(song);
    if (CONFIG.progressMode === 'super') {
        try {
            var d = store().get('progressSuper', null) || {};
            return d[key] || 0;
        } catch (e) { return 0; }
    }
    if (_resumePos && _resumePos.key === key) return _resumePos.ms || 0;
    return 0;
}
function progressClear(key) {   // key 省略 = 清当前模式的全部记录
    if (CONFIG.progressMode === 'super') {
        try {
            if (!key) { store().put('progressSuper', {}); return; }
            var d = store().get('progressSuper', null) || {};
            delete d[key];
            store().put('progressSuper', d);
        } catch (e) { logd('超缓存清除失败: ' + e); }
    } else {
        if (!key || !_resumePos || _resumePos.key === key) _resumePos = null;
    }
}

/* ==========================================================================
 *  9. 外部曲谱导入
 * ========================================================================== */

/**
 * .txt 曲谱文件格式：
 *   @name 歌名
 *   @bpm 110
 *   @speed 1
 *   @loop 1
 *   @from 0          起始拍
 *   @to 64           结束拍（不写 = 到谱尾）
 *
 *   [主旋律]
 *   1 1 5 5 | 6 6 5 -
 *
 *   [和弦伴奏]
 *   [1 3 5] - - - | [6 1' 3'] - - -
 *
 * 方括号里若是纯音符字符（如 [1 3 5]）→ 当和弦；
 * 含中文/字母等 → 当音轨标题。@ 指令和音轨标题都可省略。
 */
var TXT_TRACK_RE = /^\s*\[([^\]]*)\]\s*$/;
var TXT_CHORD_CHARS = /^[\s0-7_|'^,.\-]*$/;

function parseTxtSong(text, fname) {
    var lines = normalizeText(text).split(/\r?\n/);
    var meta = {}, tracks = [], cur = null;

    function ensure() {
        if (!cur) { cur = { name: '主旋律', notes: [] }; tracks.push(cur); }
        return cur;
    }
    for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var t = ln.trim();
        if (!t) continue;

        if (t.charAt(0) === '@') {
            var p = t.slice(1).split(/[\s:=]+/);
            meta[(p[0] || '').toLowerCase()] = p.slice(1).join(' ');
            continue;
        }
        if (t.indexOf('//') === 0) continue;      // 整行注释
        var m = TXT_TRACK_RE.exec(ln);
        if (m && !TXT_CHORD_CHARS.test(m[1])) {
            cur = { name: m[1].trim() || ('音轨 ' + (tracks.length + 1)), notes: [] };
            tracks.push(cur);
            continue;
        }
        ensure().notes.push(ln);
    }

    if (!tracks.length) tracks.push({ name: '主旋律', notes: [] });

    var song = {
        name: meta['name'] || meta['title'] || meta['曲名'] || fname || '导入谱',
        bpm: parseFloat(meta['bpm'] || meta['tempo'] || meta['速度']) || CONFIG.defaultBpm,
        speed: parseFloat(meta['speed'] || meta['rate'] || 1) || 1,
        loop: parseInt(meta['loop'] || meta['循环'] || '1', 10) || 1,
        startBeat: parseFloat(meta['from'] != null ? meta['from'] : (meta['start'] != null ? meta['start'] : 0)) || 0,
        // @to 非数字（"尾"、手滑打的字）绝不能变 NaN —— NaN 会把时间轴裁成空的，
        // 整首歌变成"没有音符"。非法值一律当"播到谱尾"。
        endBeat: (function () {
            var raw = meta['to'] != null ? meta['to'] : (meta['end'] != null ? meta['end'] : null);
            if (raw == null) return null;
            var f = parseFloat(raw);
            return isNaN(f) ? null : f;
        })(),
        tracks: tracks.map(function (tk) {
            return { name: tk.name, on: true, notes: tk.notes.join('\n') };
        })
    };
    return coerceSong(song, song.name);
}

/** 确保曲谱目录存在，并写一份示例+说明（说明写在上一级，免得被当成曲谱导入）。 */
function ensureDirs() {
    try {
        // 建当前乐器自己的目录（两个乐器的目录互相独立，切到谁就建谁的）
        var root = saveDirOf(), songs = songDirOf(), midi = midiDirOf();
        if (!files.exists(root)) files.createWithDirs(root + '.keep');
        if (!files.exists(songs)) files.createWithDirs(songs + '.keep');
        if (midi && !files.exists(midi)) files.createWithDirs(midi + '.keep');
        var help = root + 'README.txt';
        if (!files.exists(help)) {
            files.write(help,
                '这里是「' + (CONFIG.instrument === 'lute7' ? '7键琴' : '15键钢琴') + '」的曲谱目录。\n' +
                '两个乐器各有各的文件夹，互不识别：\n' +
                '  15键钢琴 → /sdcard/QipaPiano/   （songs/ 曲谱 · midi/ MIDI）\n' +
                '  7键琴    → /sdcard/QipaHarp/    （songs/ 曲谱 · midi/ MIDI）\n\n' +
                '把 .txt / .json 曲谱放进 songs/ 子文件夹，脚本启动时会自动导入。\n' +
                '（文件名以 README 或 _ 开头的会被忽略，适合放草稿。）\n\n' +
                '把 .mid / .midi 放进同级 midi/ 子文件夹' +
                (CONFIG.instrument === 'lute7' ? '' : '（或直接扔 songs/、手机「下载」') + '，\n' +
                '然后在面板 ⚙设置 → 点「🎼 导入MIDI」，脚本自己就转成简谱进曲库了，\n' +
                '不用电脑也不用 Termux。转完在 AutoX.js 的日志里能看到这首转得好不好\n' +
                '（看「原样弹对 XX%」那行）；嫌低就点旁边的「调:」按钮换个主音再导一次。\n\n' +
                '.txt 简谱示例：\n' +
                '@name 我的曲子\n' +
                '@bpm 110\n' +
                '@to 32          // 只播前 32 拍\n\n' +
                '[主旋律]\n' +
                "1 1 5 5 | 6 6 5 -\n\n" +
                '[和弦伴奏]\n' +
                "[1 3 5] - - - | [1 3 5] - - -\n\n" +
                "记号：1~7 中音 / 1'~7' 高音 / 1'' 倍高音 / 0 休止\n" +
                "- 延音一个基本时值   _1 八分音符   __1 十六分   1. 附点(×1.5)\n" +
                "[1 3 5] 和弦   | 小节线   // 行注释\n" +
                (CONFIG.instrument === 'lute7'
                    ? '\n注意：7键琴只有 1~7 七个键，谱子里的高音/倍高音播放时会自动跳过。\n'
                    : ''));
        }
    } catch (e) { logd('目录初始化失败: ' + e); }
}

/** 该文件名要不要当曲谱导入。README、下划线开头的草稿、隐藏文件一律跳过。 */
function isSongFile(f) {
    var n = String(f).split(/[\\/]/).pop();      // 有些版本的 filter 会传全路径
    if (!/\.(txt|json|qp|jd)$/i.test(n)) return false;
    if (n.charAt(0) === '.' || n.charAt(0) === '_' || n.charAt(0) === '~') return false;
    if (/^readme/i.test(n)) return false;
    return true;
}

/** 扫描曲谱目录，返回导入的歌曲（已 coerce）。 */
function loadExternalSongs() {
    var out = [];
    try {
        if (!files.exists(songDirOf())) return out;
        var list = files.listDir(songDirOf(), isSongFile) || [];
        for (var i = 0; i < list.length; i++) {
            var full = files.join(songDirOf(), list[i]);
            if (!files.isFile(full)) continue;
            var base = String(list[i]).replace(/\.[^.]+$/, '');
            var content = '';
            try { content = files.read(full); } catch (e) { logd('读取失败 ' + list[i] + ': ' + e); continue; }
            if (!content || !content.trim()) continue;
            try {
                var song = /\.json$/i.test(list[i]) ? coerceSong(content, base) : parseTxtSong(content, base);
                song.source = 'file:' + list[i];
                if (song.tracks.length && song.tracks.reduce(function (s, t) { return s + (t.events ? t.events.length : 0); }, 0) === 0) {
                    logd('· ' + list[i] + ' 解析出 0 个音符，已跳过');
                    song.broken = true;
                }
                out.push(song);
            } catch (e) {
                logd('· ' + list[i] + ' 解析出错: ' + e);
                out.push({ name: '✗ ' + base + '（解析失败）', bpm: CONFIG.defaultBpm, speed: 1, loop: 1, startBeat: 0, endBeat: null, tracks: [], source: 'file:' + list[i], broken: true });
            }
        }
    } catch (e) { logd('扫描曲谱目录失败: ' + e); }
    return out;
}

/** 该文件名是不是 MIDI。 */
function isMidiFile(f) {
    var n = String(f).split(/[\\/]/).pop();
    if (n.charAt(0) === '.' || n.charAt(0) === '_' || n.charAt(0) === '~') return false;
    return /\.(mid|midi|rmi)$/i.test(n);
}

/**
 * 扫一遍可能放着 .mid 的地方，返回 [{path, base}]，base = 去掉扩展名的文件名（也就是曲名）。
 * 每个乐器只扫自己的文件夹：
 *   15键琴：QipaPiano/midi/ → QipaPiano/songs/ →（可选）手机下载
 *   7键琴：  QipaHarp/midi/  → QipaHarp/songs/（不扫下载，只认自己的文件夹）
 * 同一个文件只算一次。
 */
function scanMidiFiles() {
    var dirs = [midiDirOf(), songDirOf()];
    if (CONFIG.instrument !== 'lute7' && CONFIG.midiScanDownload) {
        dirs.push('/sdcard/Download/', '/sdcard/download/');
    }
    var out = [], seenPath = {}, seenName = {};
    for (var d = 0; d < dirs.length; d++) {
        var dir = dirs[d];
        if (!dir) continue;
        try {
            if (!files.exists(dir)) continue;
            var list = files.listDir(dir, isMidiFile) || [];
            for (var i = 0; i < list.length; i++) {
                var full = files.join(dir, String(list[i]).split(/[\\/]/).pop());
                if (seenPath[full]) continue;
                var base = String(list[i]).split(/[\\/]/).pop().replace(/\.(mid|midi|rmi)$/i, '');
                if (seenName[base]) {              // 两个目录里放了同名的 .mid，只转第一份
                    logd('· 跳过重名的 ' + base + '.mid（' + dir + ' 里也有一份）');
                    continue;
                }
                seenPath[full] = 1; seenName[base] = 1;
                out.push({ path: full, base: base });
            }
        } catch (e) { logd('扫描 ' + dir + ' 失败: ' + e); }
    }
    // 文件名排序，保证每次扫出来的顺序一样
    out.sort(function (a, b) { return a.base < b.base ? -1 : (a.base > b.base ? 1 : 0); });
    return out;
}

/** PC模式曲库:pc长按/ 文件夹(.mid/.txt/.json 都认),手机不解析不播放,只列名字发给 PC */
function scanPcFiles() {
    var dir = '/sdcard/QipaPiano/pc长按/';
    var out = [];
    try {
        if (!files.exists(dir)) return out;
        var list = files.listDir(dir, function (n) { return /\.(mid|midi|txt|json)$/i.test(String(n)); }) || [];
        for (var i = 0; i < list.length; i++) {
            var n = String(list[i]);
            out.push({ name: n.replace(/\.(mid|midi|txt|json)$/i, ''), file: n, path: files.join(dir, n),
                       kind: /\.(mid|midi)$/i.test(n) ? 'midi' : 'txt' });
        }
        out.sort(function (a, b) { return a.file < b.file ? -1 : (a.file > b.file ? 1 : 0); });
    } catch (e) { logd('扫描 pc长按 失败: ' + e); }
    return out;
}

/**
 * 「演奏:MIDI直读」模式：把一个 .mid 曲目条目【就地】解析成可播放结构。
 * 与「🎼 导入MIDI」（转成简谱 .txt）完全不同：
 *   · 不做时值量化/吸附 —— note_on 的时刻按 tempo 换算成毫秒直接用，
 *     节奏、延音长度完全忠实原曲（简谱只有 0.125~4 拍那几档，会有吸附误差）；
 *   · 音高仍要映射到乐器键位（15键两个八度 / 7键只留 1~7），这是物理限制；
 *     超范围音按 CONFIG.midiOor 折叠 —— 音域超宽的曲子（比如 Interstellar
 *     跨 4.7 个八度）听感必然有损失，换「调:」能挑损失最小的版本；
 *   · 解析结果缓存在条目上（key = 调|越界策略|倍速），换调/倍速才重建，
 *     音轨勾选状态在重建时按轨名保留。
 * 同一时刻的音仍然会被 buildTimeline 的合并窗口聚成和弦（3ms 内），不影响。
 */
function ensureMidiParsed(entry) {
    if (!entry || !entry.isMidiFile) return entry;
    var tks = entry.trackTonics || entry._tweakTrackTonics || [];
    var key = JSON.stringify(tks) + '|' + (CONFIG.midiOor || 'fold') + '|' + (entry.speed || 1);
    if (entry._built && entry._built.key === key && entry.tracks === entry._built.song.tracks) return entry;

    var midi = entry._midi || (entry._midi = parseMidi(entry.path));
    var msPerBeat = (midi.tempo || 500000) / 1000;          // 1 拍 = tempo µs → ms
    var bpm = Math.round(60000000 / (midi.tempo || 500000));
    var oor = CONFIG.midiOor || 'fold';

    var oldOn = {};                                          // 勾选状态：缓存优先，其次沿用上次解析结果
    if (entry._tweakTrackOn) {
        for (var tn in entry._tweakTrackOn) oldOn[tn] = entry._tweakTrackOn[tn];
    }
    for (var o = 0; o < entry.tracks.length; o++) {
        if (oldOn[entry.tracks[o].name] == null) oldOn[entry.tracks[o].name] = entry.tracks[o].on;
    }
    // 按位置的勾选备份：轨重名（Interstellar 两条都叫 Piano）时按名会串味，
    // 轨名改过时按名对不上 —— 这时候按顺序恢复才是准的
    var onList = entry._tweakTrackOnList || null;
    // 名字唯一性：重名的轨（如两条 Piano）绝不能按名恢复（一条的状态会污染全部同名轨）。
    // 注意轨名按「有音符的轨」序号编，先按同样规则预生成名字再统计。
    var pickedNames = [];
    for (var pn = 0; pn < midi.tracks.length; pn++) {
        if (midi.tracks[pn].notes.length) pickedNames.push(midiTrackName(midi.tracks[pn], pickedNames.length));
    }
    var nameCount = {};
    for (var nc2 = 0; nc2 < pickedNames.length; nc2++) {
        nameCount[pickedNames[nc2]] = (nameCount[pickedNames[nc2]] || 0) + 1;
    }

    var sp = entry.speed || 1, tracks = [], tonics = [], dropped = 0;
    for (var i = 0; i < midi.tracks.length; i++) {
        var tr = midi.tracks[i];
        if (!tr.notes.length) continue;
        // 本轨主音：面板上单独指定的优先（'C' 等，会自动选最优八度），否则本轨自己挑
        var rt = resolveTrackTonic(tr.notes, tks[tracks.length], oor);
        var evs = [];
        for (var n = 0; n < tr.notes.length; n++) {
            var m = pitchToIndex(tr.notes[n][2], rt.tonic, rt.baseOct, oor);
            if (m.idx === null) { dropped++; continue; }
            evs.push({
                beat: (tr.notes[n][0] * msPerBeat) / sp,     // msMode：beat 字段就是毫秒
                dur: (tr.notes[n][1] * msPerBeat) / sp,      // 延音时长 → 分档按压用
                keys: [m.idx]
            });
        }
        if (!evs.length) continue;
        tonics.push(rt);
        // 轨名按【有音符的轨】的顺序编（音轨1、音轨2…），和「导入MIDI/转化选中MIDI」
        // 转出来的 txt 头部一致 —— 以前按 MIDI 原始轨号编，同一条轨在直读里叫
        // 音轨2、在转出的谱里叫音轨1，看着像两首歌。
        var nm = midiTrackName(tr, tracks.length);
        var defOn = true;
        if (nameCount[nm] === 1 && oldOn[nm] != null) defOn = oldOn[nm];
        else if (onList && onList[tracks.length] != null) defOn = !!onList[tracks.length];
        else if (oldOn[nm] != null) defOn = oldOn[nm];
        tracks.push({ name: nm, on: defOn,
                      events: evs, msMode: true, bpm: bpm, srcNotes: '', warn: [] });
    }

    entry.bpm = bpm;
    entry.tracks = tracks;
    entry.startBeat = 0;
    entry.endBeat = null;
    entry.midiDirect = true;
    entry.midiDropped = dropped;
    entry._tonics = tonics;                   // 各轨实际用的主音（转化导出时标注用）
    entry._built = { key: key, song: entry };
    return entry;
}

/* ---------------- MIDI 直读的起音 / 止音 ----------------
 * 直读模式没有拍网格（时序是原始毫秒，还可能中途变速），
 * 所以裁剪单位不是「拍」而是「音」：起音=从第几个音开始播（1 起），
 * 止音=播到第几个音（含）。头 = 1，尾 = 空。和 BPM/倍数/循环一样按
 * 「演奏模式|乐器|曲名」进参数缓存，重扫/切模式/重启都不丢。
 */

/**
 * 把勾选音轨的全部音符按起点聚成「音」。分组口径与 buildTimeline 的
 * 合并窗口（3ms 内算同一击）一致，这样按音序裁出来的段和实际听到的
 * 一击一一对应。返回 { starts:[每组起点ms], maxEnd:最后结束ms }。
 */
function midiNoteGroups(song, sel) {
    var ms = [], maxEnd = 0;
    for (var i = 0; i < sel.length; i++) {
        var tk = song.tracks[sel[i]];
        if (!tk || !tk.events || !tk.msMode) continue;
        for (var j = 0; j < tk.events.length; j++) {
            var e = tk.events[j];
            if (!e.keys || !e.keys.length) continue;
            if (!filterKeysForInstrument(e.keys).length) continue;   // 7键琴跳过的音不算
            ms.push(e.beat);
            var en = e.beat + (e.dur || 0);
            if (en > maxEnd) maxEnd = en;
        }
    }
    ms.sort(function (a, b) { return a - b; });
    var starts = [];
    for (var k = 0; k < ms.length; k++) {
        if (!starts.length || ms[k] - starts[starts.length - 1] > 3) starts.push(ms[k]);
    }
    return { starts: starts, maxEnd: maxEnd };
}

/**
 * 起音/止音 → buildTimeline 的毫秒裁剪窗口（{cutA, cutB, ...}）。
 * 没设（头~尾）返回 null。切掉后时间轴整体前移，循环也按这段反复；
 * 起音超出总音数按最后一音算，止音 < 起音按只播一个音算。
 */
function midiSliceOpt(song, sel) {
    if (!song || !song.isMidiFile) return null;
    var fromN = song._fromNote || 1;
    var toN = (song._toNote == null) ? null : song._toNote;
    if (fromN <= 1 && toN == null) return null;
    var g = midiNoteGroups(song, sel);
    if (!g.starts.length) return null;
    if (fromN > g.starts.length) fromN = g.starts.length;
    if (toN != null) {
        if (toN < fromN) toN = fromN;
        if (toN > g.starts.length) toN = g.starts.length;
    }
    var cutA = g.starts[fromN - 1];
    var cutB = (toN != null && toN < g.starts.length) ? g.starts[toN] : Math.max(g.maxEnd, cutA + 1);
    if (cutB <= cutA) cutB = cutA + 1;
    return { cutA: cutA, cutB: cutB, totalNotes: g.starts.length, fromN: fromN, toN: toN };
}

/** 把当前曲库（含你在面板里的修改）导出成 .txt 存回【当前乐器】的曲谱目录。 */
function exportSongFile(song) {
    try {
        ensureDirs();
        var safe = String(song.name || 'untitled').replace(/[\\/:*?"<>|]/g, '_');
        var path = files.join(songDirOf(), safe + '.txt');
        var buf = [];
        buf.push('@name ' + song.name);
        buf.push('@bpm ' + song.bpm);
        if (song.speed && song.speed !== 1) buf.push('@speed ' + song.speed);
        if (song.loop && song.loop !== 1) buf.push('@loop ' + song.loop);
        if (song.startBeat) buf.push('@from ' + song.startBeat);
        if (song.endBeat != null) buf.push('@to ' + song.endBeat);
        buf.push('');
        for (var i = 0; i < song.tracks.length; i++) {
            buf.push('[' + song.tracks[i].name + ']');
            buf.push(song.tracks[i].srcNotes || '(该音轨是结构化 JSON，无法用简谱文本导出)');
            buf.push('');
        }
        files.write(path, buf.join('\n'));
        return path;
    } catch (e) { logd('导出失败: ' + e); return null; }
}

/** CURATED：全曲库（内置 + 导入）。UI 直接读它。 */
var LIBRARY = [];

/* ---------------- 曲目参数缓存 ----------------
 * 重扫目录 / 切乐器 / 切演奏模式都会整库重建，你调过的 BPM、倍速、循环、
 * 起拍、止拍、音轨勾选、改过的谱如果不存下来就全丢。这里按
 * 「演奏模式|乐器|曲名」缓存这些用户参数（持久化到 storages，重启也在），
 * 重建后原样还原；重扫时扫不到的曲名就把它从缓存里删掉。
 * 选中曲目同样按名缓存：重扫后自动回到你上次选的那首。
 */
var _songTweaks = null;      // { key: {bpm,speed,loop,startBeat,endBeat,trackOn:{名:bool}} }
var _lastSelName = null;     // { key: 曲名 }

function tweakKey() {
    return (CONFIG.playSource || 'txt') + '|' + (CONFIG.instrument || 'piano15');
}

/** 读出持久化的缓存（懒加载一次）。 */
function songTweaks() {
    if (!_songTweaks) {
        _songTweaks = {};
        _lastSelName = {};
        try {
            var s = store();
            var t = s.get('songTweaks', null);
            if (t && typeof t === 'object') _songTweaks = t;
            var l = s.get('lastSelName', null);
            if (l && typeof l === 'object') _lastSelName = l;
        } catch (e) {}
    }
    return _songTweaks;
}

function saveSongTweaks() {
    try {
        var s = store();
        s.put('songTweaks', _songTweaks || {});
        s.put('lastSelName', _lastSelName || {});
    } catch (e) {}
}

/** 把一首歌当前的用户参数写进缓存（参数步进 / 勾选 / 编辑保存后调用）。 */
function snapshotSong(song) {
    if (!song || !song.name) return;
    var t = songTweaks();
    var key = tweakKey() + '|' + song.name;
    var prev = t[key] || {};
    var entry = {
        bpm: song.bpm, speed: song.speed || 1, loop: song.loop || 1,
        startBeat: song.startBeat || 0, endBeat: song.endBeat == null ? null : song.endBeat,
        fromNote: (song.isMidiFile && song._fromNote > 1) ? song._fromNote : null,
        toNote: (song.isMidiFile && song._toNote != null) ? song._toNote : null
    };
    if (song.tracks.length) {
        // 音轨已解析：记录勾选（按名 + 按位置双份）。按名的一份在轨重名时
        // 会串味（Interstellar 两条都叫 Piano），按位置的一份是准的；
        // 轨名被改过时按名那份对不上，靠位置兜底。
        entry.trackOn = (function () {
            var m = {};
            for (var i = 0; i < song.tracks.length; i++) m[song.tracks[i].name] = !!song.tracks[i].on;
            return m;
        })();
        entry.trackOnList = song.tracks.map(function (tk) { return !!tk.on; });
        entry.trackTonics = (song.isMidiFile && song.trackTonics && song.trackTonics.length)
            ? song.trackTonics.slice() : null;
    } else {
        // MIDI 直读曲目还没解析过（tracks 为空）：绝不能用空数据覆盖缓存里的
        // 勾选/调性 —— 否则播放前碰一下参数，勾选就全丢了（历史 bug）。
        entry.trackOn = prev.trackOn || null;
        entry.trackOnList = prev.trackOnList || null;
        entry.trackTonics = prev.trackTonics || null;
    }
    t[key] = entry;
    saveSongTweaks();
}

/** 记住「这个模式+乐器下当前选中的曲名」（重扫后按它还原）。 */
function rememberSel() {
    var song = (typeof LIBRARY !== 'undefined' && typeof UI !== 'undefined' && LIBRARY[UI.sel]) ? LIBRARY[UI.sel] : null;
    if (!song) return;
    songTweaks();
    _lastSelName[tweakKey()] = song.name;
    saveSongTweaks();
}

/**
 * rebuildLibrary 之后调用：把缓存里的用户参数套回同名曲目、清理失效缓存、
 * 按缓存的曲名还原选中项（扫不到才退回第 0 首）。
 * MIDI 直读曲目只套 speed/loop/音轨勾选/起音止音（BPM 由 .mid 决定）。
 */
function applySongTweaks() {
    var t = songTweaks();
    var seen = {};                        // 本次扫到的 key，用来清理失效缓存
    var dirty = false;
    for (var i = 0; i < LIBRARY.length; i++) {
        var song = LIBRARY[i];
        if (!song || !song.name) continue;
        var key = tweakKey() + '|' + song.name;
        seen[key] = 1;
        var tw = t[key];
        if (!tw) continue;
        if (!song.isMidiFile) {
            if (tw.bpm) song.bpm = tw.bpm;
            song.speed = tw.speed || song.speed || 1;
            song.loop = tw.loop || song.loop || 1;
            song.startBeat = tw.startBeat || 0;
            song.endBeat = tw.endBeat == null ? null : tw.endBeat;
        } else {
            song.speed = tw.speed || song.speed || 1;
            song.loop = tw.loop || song.loop || 1;
            if (tw.trackOn) song._tweakTrackOn = tw.trackOn;   // 懒解析的轨勾选，解析时套用
            if (tw.trackOnList) song._tweakTrackOnList = tw.trackOnList;   // 按位置的勾选（重名/改名时更准）
            if (tw.trackTonics) song._tweakTrackTonics = tw.trackTonics;   // 逐轨调性同理
            song._fromNote = tw.fromNote || 1;                 // 起音/止音同样按名还原
            song._toNote = (tw.toNote == null) ? null : tw.toNote;
        }
        if (tw.trackOn) {
            for (var j = 0; j < song.tracks.length; j++) {
                var nm = song.tracks[j].name;
                if (tw.trackOn[nm] != null) song.tracks[j].on = !!tw.trackOn[nm];
            }
        }
    }
    // 清理失效缓存：只清【当前 演奏模式+乐器】这一组里扫不到的曲名。
    // ⚠ 必须按前缀过滤！缓存 key 是 "模式|乐器|曲名"，切到 MIDI 直读（或
    //   7键琴）时曲库完全是另一批歌，不带前缀一刀切会把 txt 模式 / 15键琴
    //   的参数缓存全部误删 —— 切回去参数就"又重置了"。就是这里之前写坏了。
    var prefix = tweakKey() + '|';
    for (var k in t) {
        if (k.indexOf(prefix) === 0 && !seen[k]) { delete t[k]; dirty = true; }
    }
    // 还原选中：按缓存的曲名找，找不到才停在 0
    if (typeof UI !== 'undefined' && UI) {
        var wantName = _lastSelName ? _lastSelName[tweakKey()] : null;
        var found = -1;
        if (wantName) {
            for (var q = 0; q < LIBRARY.length; q++) if (LIBRARY[q].name === wantName) { found = q; break; }
        }
        UI.sel = found >= 0 ? found : 0;
        UI.songPage = Math.floor(UI.sel / Math.max(1, UI._perSong || 5));
        if (UI.sel >= LIBRARY.length) UI.sel = Math.max(0, LIBRARY.length - 1);
    }
    if (dirty || found >= 0) saveSongTweaks();
    return LIBRARY;
}

function rebuildLibrary() {
    // 重扫/切模式/切乐器不清续播缓存：只有真的播放了别的音乐才会覆盖它
    if (CONFIG.pcMode) {   // PC模式:曲库 = pc长按/ 文件夹,播放由 PC 程序演奏
        LIBRARY = scanPcFiles().map(function (e) {
            return { name: e.name, pc: true, file: e.file, kind: e.kind, path: e.path,
                     bpm: 0, speed: 1, loop: 1, startBeat: 0, endBeat: null,
                     tracks: [], source: 'pcfile' };
        });
        return applySongTweaks();
    }
    // 「演奏:MIDI直读」：曲库 = 当前乐器文件夹里能扫到的 .mid 文件列表，
    // 选中/播放时才解析（ensureMidiParsed），不在建库时全量转。
    if (CONFIG.playSource === 'midi') {
        LIBRARY = scanMidiFiles().map(function (e) {
            return { name: e.base, isMidiFile: true, path: e.path,
                     bpm: 0, speed: 1, loop: 1, startBeat: 0, endBeat: null,
                     tracks: [], source: 'midifile' };
        });
        return applySongTweaks();
    }

    LIBRARY = [];
    var have = {};
    for (var i = 0; i < SONGS.length; i++) {
        var s = coerceSong(SONGS[i], SONGS[i].name);
        s.source = 'builtin';
        LIBRARY.push(s);
        have[s.name] = 1;
    }
    var ext = loadExternalSongs();
    for (var j = 0; j < ext.length; j++) {
        // 已经用 jianpu_tool.py bundle 打进 SONGS 的曲子，曲谱目录里那份就别再导入了，
        // 否则曲目列表里每首都会出现两遍（内置一份 + 文件一份）。
        if (have[ext[j].name]) { logd('· 「' + ext[j].name + '」已内置，跳过目录里的同名文件'); continue; }
        have[ext[j].name] = 1;
        LIBRARY.push(ext[j]);
    }
    return applySongTweaks();
}

/* ==========================================================================
 *  10. 键位校准
 * ========================================================================== */

/**
 * 两点标定：把红点拖到左上角「1」和右下角「1̈」的中心，
 * 脚本按 3×5 均匀网格反推出全部 15 个键位。
 * 只需点两次，比逐键标定省事得多，键距是均匀的所以够用。
 */

/**
 * 给标定 mini 面板的文字行挂上「拖动整个窗口」。
 * mini 面板会挡住琴键，按住提示文字上下拖即可挪开；按钮不受影响。
 * pos 是窗口当前位置的记录对象 {x,y}（AutoX.js 没有 getPosition，自己记）。
 */
function makeDragHandle(win, view, pos) {
    if (!view || !view.setOnTouchListener) return;
    var sx = 0, sy = 0, wx = 0, wy = 0, moved = false;
    view.setOnTouchListener(function (v, e) {
        switch (e.getAction()) {
            case e.ACTION_DOWN:
                sx = e.getRawX(); sy = e.getRawY();
                wx = pos.x; wy = pos.y; moved = false;
                return true;
            case e.ACTION_MOVE:
                var dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                if (!moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) moved = true;
                if (moved) { pos.x = wx + dx; pos.y = wy + dy; winSetPos(win, pos.x, pos.y); }
                return true;
        }
        return true;
    });
}

var Calib = {
    marker: null,
    panel: null,
    panelPos: { x: 20, y: 0 },   // mini 面板窗口位置（自己记，可拖动）
    step: 0,
    p1: null, p2: null,
    done: null,
    active: false,
    markerPos: { x: 0, y: 0 },    // 红点窗口左上角，脚本自己记（AutoX.js 没有 getPosition）
    markerSize: 50,               // 红点边长（dp），与下面 XML 里的 w/h 保持一致

    start: function (onFinish) {
        if (this.active) return;
        this.active = true;
        this.step = 0; this.p1 = null; this.p2 = null;
        this.done = onFinish || function () {};
        var self = this;

        // floaty.window() 不能在 UI 线程里调（内部是 post+闭锁等待，会自锁）。
        // 标定是由面板按钮点出来的，已经在 UI 线程，所以另起一个脚本线程来建窗口。
        threads.start(function () {
          try {
            var s = gameScreen();
            var d = screenSize().dp;
            var half = Math.round(self.markerSize * d / 2);
            clearInterrupt();                            // 否则 floaty 建窗会抛 InterruptedException
            self.marker = floaty.window(
                '<text id="dot" text="✛" w="' + self.markerSize + '" h="' + self.markerSize + '" gravity="center" ' +
                'textSize="26sp" textColor="#FFFFFF" bg="#B4FF3B30" />'
            );
            self.markerPos = {
                x: Math.round(s.w * 0.3571) - half,
                y: Math.round(s.h * 0.1713) - half
            };
            winSetPos(self.marker, self.markerPos.x, self.markerPos.y);

            self.panel = floaty.window(
                '<vertical w="-2" h="auto" bg="#E6202428" padding="10 8 10 8">' +
                '  <text id="hint" text="① 把红圈拖到左上角的「1」键中心" textColor="#FFFFFF" textSize="14sp" w="*" />' +
                '  <text id="pos" text="" textColor="#8FD3FF" textSize="11sp" marginTop="3" />' +
                '  <horizontal marginTop="6">' +
                '    <button id="left"  text="←" w="52" h="44" textSize="16sp" />' +
                '    <button id="right" text="→" w="52" h="44" textSize="16sp" />' +
                '    <button id="up"    text="↑" w="52" h="44" textSize="16sp" />' +
                '    <button id="down"  text="↓" w="52" h="44" textSize="16sp" />' +
                '  </horizontal>' +
                '  <horizontal marginTop="4">' +
                '    <button id="ok"   text="记录此点" w="110" h="46" textColor="#00E676" />' +
                '    <button id="back" text="上一步"   w="86"  h="46" />' +
                '    <button id="quit" text="取消"     w="72"  h="46" textColor="#FF6B6B" />' +
                '  </horizontal>' +
                '</vertical>'
            );
            // 原来写死 s.h - 260（px）。横屏时 s.h 只有 1200px，
            // 而面板自身就有 ~200dp（两个按钮行 + 两行文字），
            // 于是「记录此点 / 上一步 / 取消」整排掉到屏幕外面去了。
            // 改成按估算高度往上顶，并且夹住不越界。
            var estH = Math.round(210 * screenSize().dp);
            var cy = Math.max(8, Math.min(s.h - estH - 8, Math.round(s.h * 0.28)));
            self.panelPos = { x: 20, y: cy };
            winSetPos(self.panel, self.panelPos.x, self.panelPos.y);
            deMinHeightAll(self.panel, ['left', 'right', 'up', 'down', 'ok', 'back', 'quit']);
            self.bind();
            self.render();
            // 挡住琴键时：按住上面两行提示文字即可拖走面板
            makeDragHandle(self.panel, self.panel.hint, self.panelPos);
            makeDragHandle(self.panel, self.panel.pos, self.panelPos);
          } catch (err) {
            self.active = false;
            logd('标定窗口创建失败: ' + (err && err.message ? err.message : err));
            say('标定窗口创建失败，请检查悬浮窗权限');
            var cb = self.done; self.done = null;
            if (cb) { try { cb(); } catch (e) {} }
          }
        });
    },

    /** 绑定箭头微调和拖动事件（必须在脚本线程里注册）。 */
    bind: function () {
        var self = this;
        var dot = this.marker.dot;
        if (!dot && this.marker.getWindowView) dot = this.marker.getWindowView();

        var dx0 = 0, dy0 = 0, wx0 = 0, wy0 = 0;
        if (dot && dot.setOnTouchListener) {
            dot.setOnTouchListener(function (view, event) {
                switch (event.getAction()) {
                    case event.ACTION_DOWN:
                        dx0 = event.getRawX(); dy0 = event.getRawY();
                        wx0 = self.markerPos.x; wy0 = self.markerPos.y;   // 用自己记录的位置
                        return true;
                    case event.ACTION_MOVE:
                        self.markerPos = {
                            x: wx0 + (event.getRawX() - dx0),
                            y: wy0 + (event.getRawY() - dy0)
                        };
                        winSetPos(self.marker, self.markerPos.x, self.markerPos.y);
                        self.showPos();
                        return true;
                }
                return true;
            });
        }

        function nudge(dxx, dyy) {
            self.markerPos = { x: self.markerPos.x + dxx, y: self.markerPos.y + dyy };
            winSetPos(self.marker, self.markerPos.x, self.markerPos.y);
            self.showPos();
        }
        this.panel.left.click(function () { nudge(-2, 0); });
        this.panel.right.click(function () { nudge(2, 0); });
        this.panel.up.click(function () { nudge(0, -2); });
        this.panel.down.click(function () { nudge(0, 2); });
        this.panel.ok.click(function () { self.record(); });
        this.panel.back.click(function () {
            if (self.step === 1) { self.step = 0; self.p1 = null; self.render(); }
            else self.close();
        });
        this.panel.quit.click(function () { self.close(); });
        this.showPos();
    },

    /**
     * 红点中心坐标。
     * 尺寸用「XML 里写的 dp × 屏幕密度」自己算，不调 getWidth()/getHeight()
     * —— 这两个方法在部分 AutoX.js 版本的 FloatyWindow 上不存在，
     * 一旦调用就 undefined，标定功能会整个崩掉。
     */
    markerCenter: function () {
        var d = screenSize().dp;
        var half = Math.round(this.markerSize * d / 2);
        return { x: Math.round(this.markerPos.x + half), y: Math.round(this.markerPos.y + half) };
    },

    showPos: function () {
        if (!this.panel) return;
        var c = this.markerCenter(), s = gameScreen();
        var txt = 'x=' + Math.round(c.x) + '  y=' + Math.round(c.y) +
                  '   (' + (c.x / s.w * 100).toFixed(1) + '%, ' + (c.y / s.h * 100).toFixed(1) + '%)';
        var self = this;
        uiRun(function () { self.panel.pos.setText(txt); });
    },

    render: function () {
        var self = this;
        uiRun(function () {
            self.panel.hint.setText(self.step === 0
                ? '① 红圈拖到左上角「1」键中心（按住本行拖动面板）'
                : '② 红圈拖到右下角「1̈」键中心（行3列5）');
        });
    },

    record: function () {
        var c = this.markerCenter(), self = this;
        if (this.step === 0) {
            this.p1 = c; this.step = 1; this.render();
            say('已记录第 1 点，现在拖到右下角的 1̈');
            return;
        }
        this.p2 = c;
        var s = gameScreen();
        var dxw = this.p2.x - this.p1.x, dyh = this.p2.y - this.p1.y;
        if (dxw < 40 || dyh < 30) {
            say('两点太近了，请确认第2点是不是右下角的 1̈');
            this.step = 0; this.p1 = null; this.render();
            return;
        }
        var colX = [], rowY = [];
        for (var k = 0; k < 5; k++) colX.push((this.p1.x + dxw * k / 4) / s.w);
        for (var r = 0; r < 3; r++) rowY.push((this.p1.y + dyh * r / 2) / s.h);
        // 两点标定只属于 15键琴；做完即覆盖全键标定（后用的优先）
        CALIB15 = { mode: 'twopoint', grid: { colX: colX, rowY: rowY }, keys: null };
        saveCalibration();
        logd('两点标定完成 键距 X=' + Math.round(dxw / 4) + 'px  Y=' + Math.round(dyh / 2) + 'px');
        say('两点标定完成！可以播放「全键测试」验证');
        this.close();
    },

    close: function () {
        this.active = false;
        try { if (this.marker) this.marker.close(); } catch (e) {}
        try { if (this.panel) this.panel.close(); } catch (e) {}
        this.marker = null; this.panel = null;
        var cb = this.done; this.done = null;
        if (cb) { try { cb(); } catch (e) {} }
    }
};

/**
 * 全键标定：把红点【逐个】拖到每个键的中心，依次记录。
 *   15键琴标 15 次（1 2 3 4 5 6 7 1'…7' 1''），7键琴标 7 次（1~7）。
 * 和两点标定不同，它不假设键位是均匀网格 —— 游戏以后改了键位布局也不怕。
 * ⚠ 15键琴的两点标定 / 全键标定只能生效一个：后做完的那个覆盖前一个
 *   （CALIB15.mode 记录当前生效的是哪种）。7键琴只有全键标定一种。
 */
var FullCalib = {
    marker: null,
    panel: null,
    count: 15,             // 这次标几个键（15 或 7）
    idx: 0,                // 正在标第几个（0 起）
    positions: [],         // 已记录的屏幕百分比坐标 [{x,y}]
    done: null,
    active: false,
    markerPos: { x: 0, y: 0 },
    panelPos: { x: 20, y: 0 },   // mini 面板窗口位置（自己记，可拖动）
    markerSize: 50,

    start: function (count, onFinish) {
        if (this.active) return;
        this.active = true;
        this.count = count || 15;
        this.idx = 0;
        this.positions = [];
        this.done = onFinish || function () {};
        var self = this;

        // floaty.window() 不能在 UI 线程里调（内部 post+闭锁等待会自锁），
        // 所以和两点标定一样另起脚本线程建窗。
        threads.start(function () {
          try {
            var s = gameScreen();
            var d = screenSize().dp;
            var half = Math.round(self.markerSize * d / 2);
            clearInterrupt();
            self.marker = floaty.window(
                '<text id="dot" text="✛" w="' + self.markerSize + '" h="' + self.markerSize + '" gravity="center" ' +
                'textSize="26sp" textColor="#FFFFFF" bg="#B4FF3B30" />'
            );
            // 起始位置：15键琴放到「1」键的默认坐标附近；7键琴没有默认布局，放屏幕中间
            var fx = (self.count === 15) ? COL_X[0] : 0.5;
            var fy = (self.count === 15) ? ROW_Y[0] : 0.5;
            self.markerPos = { x: Math.round(s.w * fx) - half, y: Math.round(s.h * fy) - half };
            winSetPos(self.marker, self.markerPos.x, self.markerPos.y);

            self.panel = floaty.window(
                '<vertical w="-2" h="auto" bg="#E6202428" padding="10 8 10 8">' +
                '  <text id="hint" text="" textColor="#FFFFFF" textSize="14sp" w="*" />' +
                '  <text id="pos" text="" textColor="#8FD3FF" textSize="11sp" marginTop="3" />' +
                '  <horizontal marginTop="6">' +
                '    <button id="left"  text="←" w="52" h="44" textSize="16sp" />' +
                '    <button id="right" text="→" w="52" h="44" textSize="16sp" />' +
                '    <button id="up"    text="↑" w="52" h="44" textSize="16sp" />' +
                '    <button id="down"  text="↓" w="52" h="44" textSize="16sp" />' +
                '  </horizontal>' +
                '  <horizontal marginTop="4">' +
                '    <button id="ok"   text="记录此键" w="110" h="46" textColor="#00E676" />' +
                '    <button id="back" text="上一步"   w="86"  h="46" />' +
                '    <button id="quit" text="取消"     w="72"  h="46" textColor="#FF6B6B" />' +
                '  </horizontal>' +
                '</vertical>'
            );
            var estH = Math.round(210 * screenSize().dp);
            var cy = Math.max(8, Math.min(s.h - estH - 8, Math.round(s.h * 0.28)));
            self.panelPos = { x: 20, y: cy };
            winSetPos(self.panel, self.panelPos.x, self.panelPos.y);
            deMinHeightAll(self.panel, ['left', 'right', 'up', 'down', 'ok', 'back', 'quit']);
            self.bind();
            self.render();
            // 挡住琴键时：按住上面两行提示文字即可拖走面板
            makeDragHandle(self.panel, self.panel.hint, self.panelPos);
            makeDragHandle(self.panel, self.panel.pos, self.panelPos);
          } catch (err) {
            self.active = false;
            logd('全键标定窗口创建失败: ' + (err && err.message ? err.message : err));
            say('全键标定窗口创建失败，请检查悬浮窗权限');
            var cb = self.done; self.done = null;
            if (cb) { try { cb(); } catch (e) {} }
          }
        });
    },

    /** 绑定箭头微调、拖动和三个按钮（必须在脚本线程里注册）。 */
    bind: function () {
        var self = this;
        var dot = this.marker.dot;
        if (!dot && this.marker.getWindowView) dot = this.marker.getWindowView();

        var dx0 = 0, dy0 = 0, wx0 = 0, wy0 = 0;
        if (dot && dot.setOnTouchListener) {
            dot.setOnTouchListener(function (view, event) {
                switch (event.getAction()) {
                    case event.ACTION_DOWN:
                        dx0 = event.getRawX(); dy0 = event.getRawY();
                        wx0 = self.markerPos.x; wy0 = self.markerPos.y;
                        return true;
                    case event.ACTION_MOVE:
                        self.markerPos = {
                            x: wx0 + (event.getRawX() - dx0),
                            y: wy0 + (event.getRawY() - dy0)
                        };
                        winSetPos(self.marker, self.markerPos.x, self.markerPos.y);
                        self.showPos();
                        return true;
                }
                return true;
            });
        }

        function nudge(dxx, dyy) {
            self.markerPos = { x: self.markerPos.x + dxx, y: self.markerPos.y + dyy };
            winSetPos(self.marker, self.markerPos.x, self.markerPos.y);
            self.showPos();
        }
        this.panel.left.click(function () { nudge(-2, 0); });
        this.panel.right.click(function () { nudge(2, 0); });
        this.panel.up.click(function () { nudge(0, -2); });
        this.panel.down.click(function () { nudge(0, 2); });
        this.panel.ok.click(function () { self.record(); });
        this.panel.back.click(function () { self.stepBack(); });
        this.panel.quit.click(function () { self.close(); });
        this.showPos();
    },

    /**
     * 红点中心坐标。尺寸用「XML 里写的 dp × 屏幕密度」自己算，
     * 不调 getWidth()/getHeight()（部分 AutoX.js 版本的 FloatyWindow 上没有）。
     */
    markerCenter: function () {
        var d = screenSize().dp;
        var half = Math.round(this.markerSize * d / 2);
        return { x: Math.round(this.markerPos.x + half), y: Math.round(this.markerPos.y + half) };
    },

    showPos: function () {
        if (!this.panel) return;
        var c = this.markerCenter(), s = gameScreen();
        var txt = 'x=' + Math.round(c.x) + '  y=' + Math.round(c.y) +
                  '   (' + (c.x / s.w * 100).toFixed(1) + '%, ' + (c.y / s.h * 100).toFixed(1) + '%)';
        var self = this;
        uiRun(function () { self.panel.pos.setText(txt); });
    },

    /** 当前要标的键名（1、2、…、1'、…、1''）。 */
    keyName: function () { return indexToName(Math.min(this.idx, this.count - 1)); },

    render: function () {
        var self = this;
        uiRun(function () {
            self.panel.hint.setText('全键标定 第' + (self.idx + 1) + '/' + self.count + '键：' +
                                    '红圈拖到「' + self.keyName() + '」中心（按住本行拖动面板）');
        });
    },

    record: function () {
        var s = gameScreen();
        var c = this.markerCenter();
        this.positions[this.idx] = { x: c.x / s.w, y: c.y / s.h };
        this.idx++;
        if (this.idx >= this.count) { this.finish(); return; }
        // 红点跳到下一个键的【默认】坐标附近（15键琴有默认网格可参考）；
        // 7键琴没有默认布局，红点留在原地，拖到下一个键即可。
        if (this.count === 15) {
            var d = screenSize().dp, half = Math.round(this.markerSize * d / 2);
            var rc = KEYMAP[SCALE_ORDER[this.idx]];
            this.markerPos = { x: Math.round(COL_X[rc[1]] * s.w) - half,
                               y: Math.round(ROW_Y[rc[0]] * s.h) - half };
            winSetPos(this.marker, this.markerPos.x, this.markerPos.y);
            this.showPos();
        }
        this.render();
    },

    /** 上一步：退回上一个键重标，红点挪回已记录的位置方便微调。 */
    stepBack: function () {
        if (this.idx <= 0) { say('已经在第一个键了'); return; }
        this.idx--;
        var p = this.positions[this.idx];
        if (p) {
            var s = gameScreen(), d = screenSize().dp, half = Math.round(this.markerSize * d / 2);
            this.markerPos = { x: Math.round(p.x * s.w) - half, y: Math.round(p.y * s.h) - half };
            winSetPos(this.marker, this.markerPos.x, this.markerPos.y);
            this.showPos();
        }
        this.render();
    },

    finish: function () {
        if (this.count === 7) {
            CALIB7 = { keys: this.positions.slice(0, 7) };
            say('7键琴全键标定完成！共 7 键');
        } else {
            // 全键标定做完即覆盖两点标定（后用的优先）
            CALIB15 = { mode: 'fullkey', grid: null, keys: this.positions.slice(0, 15) };
            say('15键全键标定完成！可以播放「全键测试」验证');
        }
        saveCalibration();
        logd('全键标定完成：' + this.count + ' 键（' + (this.count === 7 ? '7键琴' : '15键琴') + '）');
        this.close();
    },

    close: function () {
        this.active = false;
        try { if (this.marker) this.marker.close(); } catch (e) {}
        try { if (this.panel) this.panel.close(); } catch (e) {}
        this.marker = null; this.panel = null;
        var cb = this.done; this.done = null;
        if (cb) { try { cb(); } catch (e) {} }
    }
};

/** 逐个点亮键，用于验证标定 / 默认坐标是否对得上（随乐器自动 15 键 / 7 键）。 */
function testAllKeys(interval, cb) {
    var oldFlash = CONFIG.clickFlash;
    CONFIG.clickFlash = true;
    var n = (CONFIG.instrument === 'lute7') ? 7 : 15;
    var tl = { chords: [], totalMs: 0, count: n, adjusted: 0, notes: [] };
    for (var i = 0; i < n; i++) {
        tl.chords.push({ ms: i * (interval || 420), keys: [i], dur: interval || 420, label: KEY_LABEL[SCALE_ORDER[i]] });
    }
    tl.totalMs = n * (interval || 420);
    Player.play(tl, {
        stop: function () { CONFIG.clickFlash = oldFlash; flashClose(); if (cb) cb(); }
    });
}

/* ==========================================================================
 *  11. 悬浮窗 UI
 * ========================================================================== */

/**
 * 布局策略：
 *   · 面板宽度按【竖屏屏宽】算，且第一次排版就冻结 —— 横竖屏同一套值，
 *     转屏不重排（竖屏里排好的 284×364dp 面板，进游戏横屏后还是这么宽、这么排）
 *   · 面板高度按「参考宽 / 当前真实屏高」取小，横屏（最挤的情形）也放得下
 *   · 固定标题栏 + 固定底栏（播放/停止、状态）永远在屏内
 *   · 中间是【唯一】一个外层 scroll，其余控件全部用明确 dp 高度
 *   · 曲目 / 音轨 / 编辑器一律「分页」显示，不再嵌套 scroll
 *     （Android 里外层 scroll 套内层 scroll 会导致手势互相吃掉，
 *       这正是之前"只有曲目能滑、下面滑不动"的原因）
 *   · 参数排成两列，用宽度换高度
 */

var MAX_SONG_ROWS = 8;     // 预建的曲目行按钮数（分页复用，不随曲库增长）
var MAX_TRACK_ROWS = 8;    // 预建的音轨行按钮数
var MAX_EDIT_ROWS = 10;    // 预建的编辑器输入框数（每页只显示其中 1 条）

var COL_HOT = null, COL_DIM = null, COL_SEL_BG = null, COL_TRANSPARENT = 0;
(function () {
    function pc(s) {
        try { return colors.parseColor(s); }
        catch (e) { return android.graphics.Color.parseColor(s); }
    }
    try {
        COL_HOT = pc('#82E0AA');
        COL_DIM = pc('#DDDDDD');
        COL_SEL_BG = pc('#26405C6E');       // 选中行的淡蓝底，text 行没有按下反馈，靠这个区分
        COL_TRANSPARENT = pc('#00000000');
    } catch (e) {}
})();

/**
 * 生成 n 个 id 前缀为 p 的列表行（高度由布局给）。
 * 用 <text> 而不是 <button>：AppCompatButton 有 48dp 的默认 minHeight，
 * 在 30~40dp 的行高里会把文字垂直裁掉一半（线上"曲目只显示上半行"就是这么来的），
 * <text> 没有这个坑。选中项靠背景色 + ▶ 标记区分。
 */
function rowButtons(p, n, h) {
    var s = '';
    for (var i = 0; i < n; i++) {
        s += '<text id="' + p + i + '" text="" w="*" h="' + h + '" textSize="13sp" ' +
             'textColor="#EAEAEA" bg="#00000000" gravity="left|center" ' +
             'paddingLeft="8" visibility="gone" />';
    }
    return s;
}

/**
 * 分页条：[◀上页][下页▶]  …… 页码
 *
 * 排版规则（照搬线上确认过的那版样式）：
 *   · 两个翻页按钮【固定 dp 宽 + 紧挨着排在最左边】，先占好自己的位置；
 *   · 页码文本用 w="0" + layout_weight="1" 吃掉这一行【剩下】的宽度，右对齐。
 *     这样不管面板多窄，按钮一定在屏内，页码被挤也是挤它自己（省略号），
 *     绝不会反过来把「下页▶」顶出屏幕。
 *
 * ⚠ 之前那版三个子控件都用 w="0" + layout_weight 想等分，看着挺合理，
 *   但 Button 有个默认 minWidth=88dp：LinearLayout 量宽度时会先让每个按钮
 *   至少 88dp，两个就 176dp，窄面板里剩下的负空间由 weight 再分配，
 *   「下页▶」直接被推到屏幕外 —— 线上"横屏只能点上一页"就是这么来的。
 *   所以除了这里给死宽度，deMinHeight() 里还必须把 minWidth 一起清掉。
 */
function pageBar(p, h, wBtn) {
    return '<horizontal w="*" h="' + h + '" gravity="center_vertical">' +
             '<button id="' + p + 'L" text="◀上页" w="' + wBtn + '" h="' + h + '" gravity="center" ' +
               'textSize="12sp" textColor="#8FD3FF" bg="#243040" marginLeft="0" paddingLeft="1" paddingRight="1" />' +
             '<button id="' + p + 'R" text="下页▶" w="' + wBtn + '" h="' + h + '" gravity="center" ' +
               'textSize="12sp" textColor="#8FD3FF" bg="#243040" marginLeft="2" paddingLeft="1" paddingRight="1" />' +
             '<text id="' + p + 'N" text="1/1" w="0" layout_weight="1" h="' + h + '" ' +
               'gravity="right|center_vertical" textSize="12sp" textColor="#9FB4C7" marginLeft="6" />' +
           '</horizontal>';
}

/** 步进控件：[-] 值 [+]。带 layout_weight，两个并排时自动等分宽度。 */
function stepper(label, idp, h, labW, valW, btnW) {
    return '<horizontal w="*" layout_weight="1" h="' + h + '" gravity="center_vertical">' +
             '<text text="' + label + '" w="' + labW + '" textSize="12sp" textColor="#9FB4C7" />' +
             '<button id="' + idp + 'M" text="−" w="' + btnW + '" h="' + h + '" textSize="15sp" textColor="#8FD3FF" bg="#00000000" />' +
             '<text id="' + idp + 'V" text="0" w="' + valW + '" gravity="center" textSize="13sp" textColor="#FFFFFF" />' +
             '<button id="' + idp + 'P" text="+" w="' + btnW + '" h="' + h + '" textSize="15sp" textColor="#8FD3FF" bg="#00000000" />' +
           '</horizontal>';
}

/**
 * 面板宽度的【参考值】：第一次排版时按当时的屏幕短边（= 竖屏屏宽）定下来，
 * 之后不管屏幕转成什么方向都不再改 —— 这就是「竖屏 284dp 宽的面板，
 * 进游戏横屏还是 284dp 宽、同样排法」的实现方式。
 *
 * 为什么不能每次都按「当前短边」现算：不少机型横屏下系统栏/手势区会吃掉
 * 十几 dp，横竖屏报出来的短边并不相等（实测 369dp vs 353dp），现算的话
 * 面板宽度还是会跟着方向变一下，用户就看到"进游戏 UI 又重排了"。
 * 冻结之后横屏只可能比这个值小，面板宽度一定放得下。
 */
var _panelRefWdp = 0;
function panelRefWdp() {
    if (!_panelRefWdp) {
        var s = screenSize();
        _panelRefWdp = Math.min(s.wdp, s.hdp);
        logd('面板参考宽 ' + Math.round(_panelRefWdp) + 'dp（屏幕短边，之后转屏不再改）');
    }
    return _panelRefWdp;
}

/**
 * 布局策略 —— 【一套布局，转屏不重排】：
 *   · 面板宽度按冻结的参考宽 panelRefWdp()（= 竖屏屏宽）算，与当前方向无关。
 *     竖屏排出来的面板（例：284×364dp）进游戏转横屏后还是同样的宽度、
 *     同样的排法 —— 只是窗口在新方向下重新落位，等于「把竖屏那块 UI 转过来」。
 *     转屏时窗口销毁重建一次（面板闪一下再出现，没有旋转动画），
 *     但每个控件的位置都和转屏前一样，不会来回抽动。
 *   · 面板高度按「参考宽」和「当前真实屏高」取小来钳制：横屏比竖屏矮十几 dp
 *     的机型（系统栏吃掉的）上，宁可让中间滚动区少显示一行，也不能把
 *     固定底栏顶出屏幕外。
 *   · 固定标题栏 + 固定底栏（▶开始 / ■停止 / 状态行）永远在屏内，
 *     中间是唯一一个可滚动的区域。
 *   · 曲目 / 音轨 / 编辑器全部「分页」，不嵌套 scroll
 *     （外层 scroll 套内层 scroll，Android 会互相吃掉手势）。
 *   · 参数两列并排，把纵向空间省下来给曲目列表。
 *   · 编辑谱时换一套【紧凑矮面板】（见下面 editing 分支）：横屏才 ~370dp 高，
 *     输入法一弹就吃掉下半屏，满屏高的面板根本留不出放谱框的地方。
 *
 * ⚠ 所有进 XML 的尺寸必须是【整数 dp】：Auto.js 解析 XML 尺寸走的是
 *   Integer.parseInt()，喂它一个小数（比如 1200/3.25=369.23 算出来的
 *   347.2307692307692）就会抛 NumberFormatException，整个悬浮窗创建失败。
 *   函数末尾对所有尺寸字段做一次统一取整，别把这个循环删掉。
 */
function computeLayout() {
    var real = screenSize();
    // 面板大小固定为「小」档：窗口按 panelScale 缩，
    // 窗口内的控件 / 文字再乘一层 uiShrink —— 面板外框不变，里面更紧凑，
    // 每页能多显示几行曲目/音轨。
    var sc = CONFIG.panelScale || 0.78;
    var us = sc * (CONFIG.uiShrink != null ? CONFIG.uiShrink : 0.85);

    var RW = function (v) { return Math.round(v * sc); };   // 窗口级尺寸
    var R  = function (v) { return Math.round(v * us); };   // 控件级尺寸

    // 冻结的参考宽：竖屏屏宽（横屏时就是屏高那一侧），转屏不再变。
    var refWdp = panelRefWdp();

    var L = {
        screenWdp: real.wdp, screenHdp: real.hdp, density: real.dp,
        pad:      R(7),
        titleH:   R(40),
        labelH:   R(17),
        pageH:    R(34),
        rowH:     R(36),
        stpH:     R(34),
        btnH:     R(44),
        toolH:    R(36),
        statH:    R(30),
        gapS:     R(2),
        gapM:     R(5),
        songRows: 7,                                    // 每页曲目行数（UI 缩小后一页能放更多）
        trkRows:  5,                                    // 每页音轨行数
        cols:     2,                                    // 步进器列数
        ballSize: RW(44),
        // 分页条里单个翻页按钮的固定宽度。
        // 文字也会跟着 uiShrink 缩（scaleXmlTextSizes），所以下限可以比
        // 以前低一点；给个 40dp 下限防止极端窄屏把「◀上页」挤没。
        pgBtnW:   Math.max(40, R(52)),
        editRows: 8
    };

    // 编辑谱输入框的高度。默认按参考宽（= 横屏时的屏高那一侧）给一小截，
    // 横屏本来就没多少纵向空间；想调就改 CONFIG.editInputH。
    L.editInputH = Math.round(Math.max(36, Math.min(CONFIG.editInputH || R(refWdp * 0.17), 260)));

    /**
     * 编辑模式走【紧凑布局】，这是能弹出输入法的前提：
     * 横屏游戏屏幕只有 ~370dp 高，输入法一出来就吃掉下半屏 100 多 dp。
     * 菜单那套满屏高的面板（360dp+）不管怎么摆都会被键盘盖住输入框，
     * 所以进入编辑页时整窗换成一个矮面板，只留「标题 / 音轨名 / 谱框 /
     * 翻页条 / 保存取消 / 一行提示」，再由 openEditor() 把它顶到屏幕最上面，
     * 输入框正好落在键盘上方的可视区里。
     */
    var editing = !!(UI && (UI.editMode || UI.importMode));
    if (editing) {
        L.titleH = R(34);
        L.labelH = R(16);   // 「音轨：xxx 32 音」是 12sp，15dp 会把汉字下沿切掉
        L.pageH  = R(32);
        L.btnH   = R(40);
        L.statH  = R(15);
    }

    // 宽度：按【冻结的参考宽】（= 竖屏屏宽）夹，上限 600dp，再乘 panelScale
    // （窗口档位）。控件那层 uiShrink 不影响窗口宽度 —— 面板外框和原来
    // 「小」档一模一样，只是里面更紧凑。
    // 例：1200×2652 / density 3.25 的手机参考宽 369dp，panelScale=0.78 时
    //     面板宽 284dp —— 横竖屏都是这个宽度，进游戏【不会】被拉宽重排。
    // 横屏屏宽是长边，≥ 参考宽，所以这个宽度在横屏下也一定放得下。
    // 注意别在这里写死下限——高dpi窄屏（如 density 4 的 1080p 横屏只有
    // 270dp 宽）会因为一个固定下限而横向溢出屏幕。
    var maxW = Math.max(120, refWdp - RW(6));
    L.PW = RW(Math.min(600, maxW));

    // 步进器：5 组，两列并排 -> 3 行
    L.stepRows = Math.ceil(5 / L.cols);

    // 滚动区自然高度。播放/停止属于【固定底栏】，不计入。
    L.bodyNatural = editing
        ? (L.labelH                    +   // 编辑页标题「音轨：xxx NN 音」
           L.editInputH                +   // 谱框本体
           L.pageH                     +   // 音轨翻页条
           L.labelH)                       // 报错/提示行
        : (
        L.labelH                         +   // 「曲目」标签
        L.pageH                          +   // 曲目分页条
        L.songRows * L.rowH              +   // 曲目行
        L.labelH + L.gapS                +   // 「音轨」标签
        L.pageH                          +   // 音轨分页条
        L.trkRows * L.rowH               +   // 音轨行
        L.labelH                         +   // info 行
        L.gapM                           +
        L.stepRows * L.stpH              +   // 参数区
        L.gapS + L.toolH);                   // 工具按钮（单行）

    // 固定部分：标题栏 + 底栏(播放/停止) + 状态行 + 上下 padding
    L.footerH = L.btnH + L.gapS + L.statH;
    L.fixedH = L.pad * 2 + L.titleH + L.footerH;
    L.naturalH = L.fixedH + L.bodyNatural;

    // 高度上限：参考宽（横屏时的屏高那一侧）与【当前真实屏高】取小。
    // 后者是必须的：有的机型横屏下可用高度只有 ~353dp（系统栏吃掉十几 dp），
    // 只按参考宽（369dp）排的话固定底栏会露出一截在屏幕外面。
    // 差出来的那十几个 dp 只会让中间滚动区少显示一行，控件排法完全不变。
    L.maxH = Math.max(180, Math.min(refWdp, real.hdp) - RW(6));
    L.PH = Math.min(L.naturalH, L.maxH);

    // 编辑谱 / 输入导入页：固定用更高的面板（284×360dp）。
    // 之前那套紧凑矮面板只露出一小截谱框，长谱根本没法编辑；
    // 现在面板定高，谱框自动填满中间滚动区的全部剩余空间。
    if (editing) {
        L.PH = Math.max(L.naturalH, Math.min(360, L.maxH));
        L.editInputH = (CONFIG.editInputH > 0)
            ? Math.round(CONFIG.editInputH)                        // 手动设了上限就用它
            : Math.max(40, Math.round(L.PH - L.fixedH - (L.labelH * 2 + L.pageH + L.gapS * 4)));
    }

    // ---- 统一取整：任何一个尺寸字段带小数都会让 floaty 建窗直接崩 ----
    ['pad', 'titleH', 'labelH', 'pageH', 'rowH', 'stpH', 'btnH', 'toolH', 'statH',
     'gapS', 'gapM', 'ballSize', 'pgBtnW', 'editInputH', 'stepRows', 'PW', 'PH', 'maxH',
     'naturalH', 'fixedH', 'footerH', 'bodyNatural'].forEach(function (k) {
        L[k] = Math.round(L[k]);
    });
    // bodyH 必须在取整之后算差值，保证 fixedH + bodyH === PH 这条恒等式不破
    L.bodyH = Math.max(R(60), L.PH - L.fixedH);
    L.needScroll = L.bodyNatural > L.bodyH;
    return L;
}

/**
 * 当前曲目五个参数的【显示字符串】（XML 生成和输入框刷新共用）。
 * 曲谱模式：止拍为空显示「尾」；MIDI 直读：起拍/止拍变成 起音/止音，
 * 头显示「头」、尾显示「尾」；曲库空给通用默认值。
 */
function paramDisplayVals() {
    var s = (typeof LIBRARY !== 'undefined' && typeof UI !== 'undefined') ? LIBRARY[UI.sel] : null;
    if (!s) return { bpm: '100', sp: '1', lp: '1', fr: '0', to: '尾' };
    var v = {};
    if (s.isMidiFile) {
        v.bpm = String(s.bpm || '?');
        v.fr = (s._fromNote && s._fromNote > 1) ? String(s._fromNote) : '头';
        v.to = s._toNote == null ? '尾' : String(s._toNote);
    } else {
        v.bpm = String(s.bpm);
        v.fr = String(s.startBeat || 0);
        v.to = s.endBeat == null ? '尾' : String(s.endBeat);
    }
    v.sp = fnum(s.speed || 1, 2);
    v.lp = String(s.loop || 1);
    return v;
}

/** 生成整个面板 XML。尺寸全部来自 computeLayout()，且都已是整数 dp。 */
function buildPanelXml(L) {
    var sRows = rowButtons('s', MAX_SONG_ROWS, L.rowH);
    var tRows = rowButtons('t', MAX_TRACK_ROWS, L.rowH);

    var eg = '';
    for (var e = 0; e < MAX_EDIT_ROWS; e++) {
        eg += '<vertical id="eg' + e + '" w="*" visibility="gone">' +
                 '<text id="el' + e + '" text="" textSize="12sp" textColor="#FFD166" w="*" />' +
                 '<input id="en' + e + '" text="" textSize="13sp" textColor="#EAEAEA" ' +
                   'bg="#20262C" padding="6" w="*" h="' + L.editInputH + '" />' +
              '</vertical>';
    }

    // 曲目参数：点数值弹键盘直接输入（± 按钮已删）。
    // 输入框的实现和「输入导入」页那个验证过能正常打字的谱框完全同构
    // （同样的 textColor/padding/textSize，固定宽度不吃 weight），
    // 【默认值直接写进 XML】——就算运行时 setText 失效，面板一出来就有数。
    // 单位标在框外。止拍「尾」= 播到谱尾。
    // 起拍/止拍 的标签和单位带 id：MIDI 直读模式下由 refresh 改写成 起音/止音。
    var PV0 = paramDisplayVals();
    var PARAMS = [
        ['BPM', 'bpmIn', '',    PV0.bpm, null,    null],
        ['倍数', 'spIn', 'x',   PV0.sp,  null,    null],
        ['循环', 'lpIn', '遍',  PV0.lp,  null,    null],
        ['起拍', 'frIn', '拍',  PV0.fr,  'frLab', 'frUnit'],
        ['止拍', 'toIn', '拍',  PV0.to,  'toLab', 'toUnit']
    ];
    var IN_H = Math.max(24, L.stpH - 2);
    var stpXml = '', per = L.cols, i;
    for (i = 0; i < PARAMS.length; i += per) {
        var cells = '';
        for (var j = i; j < Math.min(i + per, PARAMS.length); j++) {
            var PM = PARAMS[j];
            cells += '<horizontal w="*" layout_weight="1" h="' + L.stpH + '" gravity="center_vertical">' +
                       '<text' + (PM[4] ? ' id="' + PM[4] + '"' : '') + ' text="' + PM[0] + '" w="30" textSize="12sp" textColor="#9FB4C7" />' +
                       '<input id="' + PM[1] + '" text="' + PM[3] + '" w="' + 48 + '" h="' + IN_H + '" ' +
                         'textSize="13sp" textColor="#EAEAEA" bg="#20262C" padding="4" />' +
                       '<text' + (PM[5] ? ' id="' + PM[5] + '"' : '') + ' text="' + PM[2] + '" w="' + (PM[2] ? 15 : 3) + '" h="' + L.stpH + '" ' +
                         'textSize="10sp" textColor="#9FB4C7" gravity="left|center_vertical" paddingLeft="2" />' +
                     '</horizontal>';
        }
        // 不满一行时补个等权占位，保证两列等宽
        for (var k = Math.min(i + per, PARAMS.length); k < i + per; k++) {
            cells += '<text w="*" layout_weight="1" h="' + L.stpH + '" text="" />';
        }
        stpXml += '<horizontal w="*" h="' + L.stpH + '">' + cells + '</horizontal>';
    }

    // 工具按钮：只留最常用的 4 个在主界面，其余低频操作收进 ⚙设置 抽屉
    var toolXml =
      '<horizontal w="*" h="' + L.toolH + '" marginTop="' + L.gapS + '">' +
        '<button id="editBtn"  text="✎ 编辑谱" w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" />' +
        '<button id="calibBtn" text="🎯 标定"  w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" />' +
        '<button id="testBtn"  text="🧪 全键"  w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" />' +
        '<button id="setBtn"   text="⚙ 设置"  w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" />' +
      '</horizontal>';

    var setBox =
      '<vertical id="setBox" w="*" visibility="gone" marginTop="' + L.gapS + '" bg="#1B2127" padding="5">' +
        '<horizontal w="*" h="' + L.toolH + '">' +
          '<button id="impBtn"    text="⌨ 输入导入曲谱" w="*" layout_weight="3" h="' + L.toolH + '" textSize="12sp" />' +
          '<button id="reloadBtn" text="↺ 重扫目录"     w="*" layout_weight="2" h="' + L.toolH + '" textSize="12sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<horizontal w="*" h="' + L.stpH + '" marginTop="' + L.gapS + '">' +
          '<text text="播放进度" w="' + 52 + '" h="' + L.stpH + '" gravity="center_vertical" textSize="12sp" textColor="#9FB4C7" />' +
          '<button id="progBtn" text="" w="*" h="' + L.stpH + '" textSize="12sp" />' +
        '</horizontal>' +
        '<horizontal w="*" h="' + L.stpH + '" marginTop="' + L.gapS + '">' +
          
          '<button id="pressBtn" text=""         w="*" layout_weight="1" h="' + L.stpH + '" textSize="12sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<horizontal w="*" h="' + L.stpH + '" marginTop="' + L.gapS + '">' +
          '<button id="instBtn"  text=""         w="*" layout_weight="1" h="' + L.stpH + '" textSize="12sp" />' +
          '<button id="flashBtn" text=""         w="*" layout_weight="1" h="' + L.stpH + '" textSize="12sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<horizontal w="*" h="' + L.stpH + '" marginTop="' + L.gapS + '">' +
          stepper('偏移X', 'ox', L.stpH, 34, 50, 32) +
          stepper('偏移Y', 'oy', L.stpH, 34, 50, 32) +
        '</horizontal>' +
        '<horizontal w="*" h="' + L.toolH + '" marginTop="' + L.gapS + '">' +
          '<button id="fkBtn"  text="🔢 全键标定" w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" />' +
          '<button id="clrBtn" text="清除标定"    w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<horizontal w="*" h="' + L.toolH + '" marginTop="' + L.gapS + '">' +
          '<button id="expBtn"  text="📄 导出选中曲.txt" w="*" layout_weight="2" h="' + L.toolH + '" textSize="12sp" />' +
          '<button id="exitBtn" text="⏏ 退出脚本"        w="*" layout_weight="1" h="' + L.toolH + '" textSize="12sp" textColor="#FF6B6B" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        // ---- MIDI 直接导入：不需要电脑，也不需要 Termux ----
        // 这行（导入MIDI + 全局调:）只在「演奏:曲谱」模式显示；
        // MIDI 直读模式下换成下面那行三个【逐轨调性】按钮
        '<horizontal id="midiRow" w="*" h="' + L.toolH + '" marginTop="' + L.gapS + '">' +
          '<button id="midiBtn" text="🎼 导入MIDI" w="*" layout_weight="3" h="' + L.toolH + '" textSize="12sp" textColor="#8FD3FF" />' +
          '<button id="tonicBtn" text=""          w="*" layout_weight="2" h="' + L.toolH + '" textSize="12sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        // MIDI 直读模式专属：音轨1/2/3 各自的调（点不动 = 这首没有那条轨）
        '<horizontal id="tkRow" w="*" h="' + L.toolH + '" visibility="gone" marginTop="' + L.gapS + '">' +
          '<button id="tk1Btn" text="轨1调:auto" w="*" layout_weight="1" h="' + L.toolH + '" textSize="11sp" />' +
          '<button id="tk2Btn" text="轨2调:—"   w="*" layout_weight="1" h="' + L.toolH + '" textSize="11sp" marginLeft="' + L.gapS + '" />' +
          '<button id="tk3Btn" text="轨3调:—"   w="*" layout_weight="1" h="' + L.toolH + '" textSize="11sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<text id="midiHelp" text="" w="*" textSize="9sp" textColor="#5F7182" marginTop="' + L.gapS + '" />' +
        '<text id="dirHelp" text="" w="*" textSize="9sp" textColor="#5F7182" marginTop="' + L.gapS + '" />' +
      '</vertical>';

    var xml =
      '<vertical id="root" w="' + L.PW + '" h="' + L.PH + '" bg="#F2171B20" padding="' + L.pad + '">' +

        // ---- 固定标题栏（兼作拖动手柄）----
        '<horizontal id="title" w="*" h="' + L.titleH + '" gravity="center_vertical">' +
          '<text text="🎹 奇葩钢琴X" textSize="14sp" textColor="#FFFFFF" w="*" layout_weight="1" />' +
          '<text id="orient" text="" textSize="11sp" textColor="#7C8B99" marginRight="6" />' +
          '<button id="collapse" text="—" w="' + 40 + '" h="' + 34 + '" textSize="14sp" textColor="#9FB4C7" />' +
        '</horizontal>' +

        // ---- 唯一的外层滚动区 ----
        '<scroll id="body" w="*" h="' + L.bodyH + '">' +
          '<vertical id="bodyBox" w="*" h="auto">' +

            // 菜单模式
            '<vertical id="menu" w="*" h="auto">' +
              '<text text="曲目" w="*" h="' + L.labelH + '" textSize="11sp" textColor="#7C8B99" />' +
              pageBar('songPg', L.pageH, L.pgBtnW) +
              '<horizontal w="*" h="auto" marginTop="2">' +
              '<button id="pcModeBtn" text="PC模式" w="*" layout_weight="1" h="' + L.pageH + '" textSize="12sp" textColor="#FFD27E" bg="#33406B" />' +
              '<button id="pcSrcBtn" text="' + (CONFIG.playSource === 'midi' ? '演奏:MIDI直读' : '演奏:曲谱') + '" w="*" layout_weight="1" h="' + L.pageH + '" textSize="12sp" textColor="#DCE6F5" bg="#33406B" marginLeft="4" />' +
              '</horizontal>' +
              '<vertical id="sbox" w="*" h="auto">' + sRows + '</vertical>' +

              '<text id="trkHead" text="音轨（点击勾选）" w="*" h="' + L.labelH + '" textSize="11sp" textColor="#7C8B99" marginTop="' + L.gapS + '" />' +
              pageBar('trkPg', L.pageH, L.pgBtnW) +
              '<vertical id="trkBox" w="*" h="auto">' + tRows + '</vertical>' +

              '<text id="info" text="" w="*" h="' + L.labelH + '" textSize="11sp" textColor="#00E676" marginTop="' + L.gapS + '" />' +

              '<vertical w="*" h="auto" marginTop="' + L.gapM + '">' + stpXml + '</vertical>' +
              toolXml +
              setBox +
            '</vertical>' +

            // 编辑模式（每页一条音轨）。
            // 顺序是「曲名 → 音轨名 → 谱框 → 翻页条」：谱框必须排在最上面，
            // 因为输入法弹出后遮住的是屏幕下半部分，翻页条被盖住无所谓
            // （先按返回收起键盘就能点），谱框被盖住就没法编辑了。
            '<vertical id="editv" w="*" h="auto" visibility="gone">' +
              '<text id="editHead" text="" w="*" h="' + L.labelH + '" textSize="12sp" textColor="#FFD166" />' +
              '<vertical id="edBox" w="*" h="auto" marginTop="' + L.gapS + '">' + eg + '</vertical>' +
              pageBar('editPg', L.pageH, L.pgBtnW) +
              '<text id="editErr" text="" w="*" h="' + L.labelH + '" textSize="11sp" textColor="#FF8A80" marginTop="' + L.gapS + '" />' +
            '</vertical>' +

            // 输入导入模式：不读剪贴板，直接用系统输入法打简谱。
            // 和编辑谱一样用紧凑矮面板 + 顶到屏幕最上面，键盘弹出来盖不到输入框。
            '<vertical id="impv" w="*" h="auto" visibility="gone">' +
              '<text id="impHead" text="⌨ 输入简谱导入（歌名填在 @name 后，曲速默认 60）" w="*" h="' + L.labelH + '" textSize="12sp" textColor="#FFD166" />' +
              '<input id="impText" text="" textSize="13sp" textColor="#EAEAEA" ' +
                'bg="#20262C" padding="6" w="*" h="' + L.editInputH + '" marginTop="' + L.gapS + '" />' +
              '<text text="记号：1~7 中音 · 1\u0027 高音 · 1\u0027\u0027 倍高音 · 0 休止 · - 延音 · _1 八分 · 1. 附点 · [1 3 5] 和弦" w="*" textSize="9sp" textColor="#5F7182" marginTop="' + L.gapS + '" />' +
              '<text id="impErr" text="" w="*" h="' + L.labelH + '" textSize="11sp" textColor="#FF8A80" marginTop="' + L.gapS + '" />' +
            '</vertical>' +

          '</vertical>' +
        '</scroll>' +

        // ---- 固定底栏：播放/停止 与 保存/取消 二选一 ----
        '<horizontal id="footerPlay" w="*" h="' + L.btnH + '" marginTop="' + L.gapS + '">' +
          '<button id="playBtn" text="▶ 开始" w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" textColor="#FFFFFF" bg="#1E88E5" />' +
          '<button id="stopBtn" text="■ 停止" w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" textColor="#FFFFFF" bg="#C62828" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<horizontal id="footerEdit" w="*" h="' + L.btnH + '" marginTop="' + L.gapS + '" visibility="gone">' +
          '<button id="editSave" text="💾 保存" w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" textColor="#FFFFFF" bg="#2E7D32" />' +
          '<button id="editCanc" text="✕ 取消" w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        // 输入导入页的底栏：确认 = 进曲库并设为当前曲目；导出.txt = 写进曲谱目录
        '<horizontal id="footerImp" w="*" h="' + L.btnH + '" marginTop="' + L.gapS + '" visibility="gone">' +
          '<button id="impOk"   text="✓ 确认"    w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" textColor="#FFFFFF" bg="#2E7D32" />' +
          '<button id="impExp"  text="📄 导出.txt" w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" textColor="#FFFFFF" bg="#1E88E5" marginLeft="' + L.gapS + '" />' +
          '<button id="impCanc" text="✕ 取消"    w="*" layout_weight="1" h="' + L.btnH + '" textSize="15sp" marginLeft="' + L.gapS + '" />' +
        '</horizontal>' +
        '<text id="stat" text="就绪" w="*" h="' + L.statH + '" textSize="10sp" textColor="#7C8B99" marginTop="' + L.gapS + '" />' +

      '</vertical>';
    // 小档下面板内 UI 再缩一档：所有 textSize 乘 CONFIG.uiShrink（下限 8sp）。
    // 窗口尺寸（PW/PH）不受这里影响，面板外框和原来「小」档一样大。
    return fixXmlDimensions(scaleXmlTextSizes(xml, CONFIG.uiShrink != null ? CONFIG.uiShrink : 0.85));
}

/**
 * 把面板 XML 里所有 textSize="Nsp" 按比例缩小（下限 8sp）。
 * 和 fixXmlDimensions 一样是对生成结果做兜底式后处理，
 * 这样 pageBar / stepper / rowButtons 里的字号不用一个个改。
 */
function scaleXmlTextSizes(xml, f) {
    if (!f || f >= 1) return String(xml);
    return String(xml).replace(/textSize="(\d+)sp"/g, function (m, v) {
        return 'textSize="' + Math.max(8, Math.round(parseInt(v, 10) * f)) + 'sp"';
    });
}

/** 悬浮球 XML（横屏下缩小一圈，别挡住游戏）。 */
function buildBallXml(L) {
    return fixXmlDimensions(
        '<text id="bb" text="♪" w="' + L.ballSize + '" h="' + L.ballSize + '" gravity="center" ' +
        'textSize="20sp" textColor="#FFFFFF" bg="#E01565C0" />'
    );
}

/**
 * 兜底：把生成好的 XML 里任何带小数的 w/h 尺寸就地取整。
 * computeLayout() 已经取整过了，这里是防止以后改动漏掉 ——
 * 只要有一个小数尺寸漏进 XML，floaty 建窗就会整个抛 NumberFormatException。
 */
function fixXmlDimensions(xml) {
    return String(xml).replace(/\b([wh])="(-?\d+\.\d+)"/g, function (m, k, v) {
        logd('⚠ XML 尺寸出现小数 ' + m + '，已自动取整');
        return k + '="' + Math.round(parseFloat(v)) + '"';
    });
}

/**
 * 清掉当前线程可能残留的中断标志。
 * Auto.js 停止脚本时会 interrupt 线程，标志如果没清干净，
 * 紧接着的 floaty 建窗（内部是 post + 闭锁等待）就会立刻抛
 * "RuntimeException: InterruptedException"，面板建不出来。
 */
function clearInterrupt() {
    try { java.lang.Thread.currentThread().interrupted(); } catch (e) {}
}

/**
 * 移动悬浮窗。
 * 【不要】用 win.getPosition() 回读位置 —— AutoX.js 的 FloatyWindow 只有
 * setPosition，没有 getPosition（线上就是这么崩的：
 *   TypeError: Cannot call property getPosition ... it is "undefined"）。
 * 位置一律由脚本自己记录（UI.panelPos / UI.ballPos / Calib.markerPos），
 * 这里只负责把记录值推给窗口。
 */
function winSetPos(win, x, y) {
    if (!win) return false;
    x = Math.round(x); y = Math.round(y);
    try { win.setPosition(x, y); return true; } catch (e) {}
    try { win.setX(x); win.setY(y); return true; } catch (e2) { logd('移动悬浮窗失败: ' + e2); }
    return false;
}

/** 轻微震动，用于悬浮球长按的触感反馈。 */
function vib(ms) {
    try { device.vibrate(ms || 25); } catch (e) {}
}

/**
 * 修掉 Android Button 的默认最小尺寸。
 * AppCompatButton 默认 minHeight = 48dp、minWidth = 88dp，还带上下 inset：
 *   · minHeight 会把 30~40dp 的行高里的文字垂直裁掉一半
 *     （线上"曲目只显示上半行"、分页箭头 ◀ ▶ 看不见，都是它）；
 *   · minWidth 会把分页条那两个给了固定窄宽度的按钮重新撑到 88dp，
 *     两个加起来 176dp，窄面板里「下页▶」又被顶出屏幕
 *     （线上"横屏点不到下一页"就是它）。
 * 两个都必须清掉，只清高度没用。
 */
function deMinHeight(view) {
    if (!view) return;
    try { view.setMinHeight(0); } catch (e) {}
    try { view.setMinimumHeight(0); } catch (e) {}
    try { view.setMinWidth(0); } catch (e) {}
    try { view.setMinimumWidth(0); } catch (e) {}
    try {
        view.setPadding(view.getPaddingLeft(), 0, view.getPaddingRight(), 0);
    } catch (e) {}
    try {
        view.setSingleLine(true);
        view.setEllipsize(android.text.TextUtils.TruncateAt.END);
    } catch (e) {}
    // MaterialButton 的上下 inset 也会吃掉高度
    try { view.setInsetTop(0); view.setInsetBottom(0); } catch (e) {}
}

/** 对面板里所有按钮统一去 minHeight/minWidth。ids 可以是字符串数组或前缀+数量。 */
function deMinHeightAll(win, ids) {
    for (var i = 0; i < ids.length; i++) {
        try { deMinHeight(win[ids[i]]); } catch (e) {}
    }
}

/**
 * 页码文本：强制单行 + 尾部省略号。
 * 分页条现在把「剩下的宽度」全给它，面板再窄也只是页码显示成
 * 「第1/2页·共…」，绝不会反过来把翻页按钮挤出去。
 */
function oneLine(view) {
    if (!view) return;
    try {
        view.setSingleLine(true);
        view.setMaxLines(1);
        view.setHorizontallyScrolling(false);
        view.setEllipsize(android.text.TextUtils.TruncateAt.END);
    } catch (e) {}
}

var UI = {
    ball: null,
    panel: null,
    L: null,
    expanded: false,
    editMode: false,
    importMode: false,     // 「⌨ 输入导入」页（键盘输入简谱，不读剪贴板）
    sel: 0,
    panelPos: null,
    ballPos: null,
    songPage: 0,
    trkPage: 0,
    editIdx: 0,
    _editFilled: {},       // 编辑器：哪些音轨输入框已填过原谱（翻页不冲掉未保存的修改）
    _impText: '',          // 输入导入页的草稿（整窗重建后还原，别让转屏吃掉打的字）
    _imeOn: false,         // 面板当前是不是「可聚焦 + 输入法已弹出」状态
    _imeId: null,          // 该状态属于哪个输入框（'en3' / 'imp'），重建后照原样再弹一次
    _menuPanelY: null,     // 进编辑页前的面板 y（编辑页要顶到屏幕最上面，退出时还原）
    _midiBusy: false,      // 「🎼 导入MIDI」正在跑？防止连点重复转
    _rebuilding: false,    // 整窗重建进行中？（防止两次重建叠在一起产生孤儿窗口）
    _rebuildAgain: null,   // 重建途中又来了一次请求，记下来建完补跑
    setOpen: false,        // 设置抽屉开合状态，重建面板后要保持
    _perSong: 1,
    _perTrk: 1,
    _lastW: 0, _lastH: 0,
    _t0: 0, _tickLabel: '',

    /* ---------------- 创建 / 重建 ---------------- */

    init: function () {
        // 面板宽度在第一次排版时就冻结了（panelRefWdp），转屏不会重排；
        // rebuild() 仍然整窗重建一次，目的只是把窗口搬到新方向下。
        // 不去改控件尺寸：floaty 窗口里改 LayoutParams 未必会传导到窗口，
        // 整窗重建虽然会闪一下但结果确定。
        try {
            if (floaty.checkPermission && !floaty.checkPermission()) {
                say('请授予 AutoX.js「显示在其他应用上层」权限');
                if (floaty.requestPermission) floaty.requestPermission();
            }
        } catch (e) {}

        var self = this;
        this._buildOnce = true;
        this._rebuildSync(function () { self._buildOnce = false; });
    },

    /**
     * 在「脚本线程」里整窗重建。floaty.window() 内部是 post+闭锁等待，
     * 在 UI 线程里调会自锁，所以【建窗】这一步必须留在脚本线程。
     *
     * ⚠ 但建完窗之后，所有碰控件的动作都必须回到 UI 线程。
     *   uiRun() 里的 ui.run 是阻塞式的，它会先把队列里 FloatyService.addWindow
     *   那条 post 放掉 —— 也就是说等我们的回调开始跑，新窗口已经挂上
     *   WindowManager 了。这时再从脚本线程调 setVisibility / setPadding /
     *   setMinHeight，都会走 requestLayout() → ViewRootImpl.checkThread()
     *   → CalledFromWrongThreadException。
     *   _renderEditor() 正是这么被掐在半路的：menu 已经置成 GONE，
     *   editv 还没来得及 VISIBLE，异常被那个空 catch 吞掉，
     *   于是「第二次开始打开编辑谱就是一片空白」（只剩标题、▶播放中和状态行）。
     *   setText 侥幸没炸，是因为面板里那些文本控件宽度都是写死的，
     *   TextView.checkForRelayout() 走 invalidate 快路径，不会 requestLayout。
     *
     * ⚠ 还要串行。转屏心跳和用户点「✎编辑谱 / 💾保存」可能同时要求重建，
     *   两边各建一个窗、oldPanel 又都指向同一个旧窗，就会有一个新窗永远没人
     *   close，变成关不掉的孤儿窗（只能杀脚本）。所以这里加了 _rebuilding 锁，
     *   重建途中再来的请求排一次队，结束后自动补跑。
     */
    _rebuildSync: function (after) {
        var self = this;
        if (this._rebuilding) {                 // 上一次还没建完：记一笔，建完再补一次
            this._rebuildAgain = after || true;
            logd('面板正在重建中，本次重排请求已排队');
            return;
        }
        this._rebuilding = true;

        var drafts = this.editMode ? this._readEditorDrafts() : null;
        var impDraft = this.importMode ? this._readImpDraft() : null;
        var oldPanel = this.panel, oldBall = this.ball;

        function build() {
            var created = [];
            try {
                var s = screenSize();
                var L = computeLayout();
                self.L = L;
                self._lastW = s.w; self._lastH = s.h;

                clearInterrupt();                            // 否则 floaty 建窗会抛 InterruptedException
                self.panel = floaty.window(buildPanelXml(L)); created.push(self.panel);
                self.ball = floaty.window(buildBallXml(L));   created.push(self.ball);

                // ---- 下面全部回到 UI 线程执行 ----
                uiRun(function () {
                    self.fixButtonMetrics();                 // 修 Button 默认 48dp minHeight/88dp minWidth
                    self.bindEvents();
                    self.setupParamInputs();                 // 曲目参数：点数值弹键盘输入
                    self.enableEditorInputs();
                    if (drafts) self._writeEditorDrafts(drafts);
                    if (impDraft != null) self._writeImpDraft(impDraft);
                    self.fitToScreen();
                    if (self.expanded) self.showPanel(); else winSetPos(self.panel, -9999, -9999);
                    self._refreshNow();
                    // 重建会丢失临时 UI 状态，这几项要手动还原
                    try {
                        self.panel.setBox.setVisibility(self.setOpen ? android.view.View.VISIBLE : android.view.View.GONE);
                    } catch (e) { logd('还原设置抽屉状态失败: ' + e); }
                    if (self.editMode) self._renderEditor();
                    if (self.importMode) self._renderImport();
                    // 可聚焦状态是挂在【窗口】上的，整窗重建后就没了。
                    // 正在打字时转屏，这里照原样把输入法再弹回来。
                    if ((self.editMode || self.importMode) && self._imeOn && self._imeId) self._showIme(self._imeId);
                });

                // 新窗口完全就位了再关旧的，中间不留空档
                try { if (oldPanel) oldPanel.close(); } catch (e) {}
                try { if (oldBall) oldBall.close(); } catch (e) {}
                created.length = 0;
            } catch (e) {
                // 建到一半失败：把这次新建出来的窗口关掉，句柄滚回旧窗口，
                // 否则屏幕上会留一个再也关不掉、还盖在最上面的孤儿面板
                for (var i = 0; i < created.length; i++) { try { created[i].close(); } catch (e2) {} }
                self.panel = oldPanel; self.ball = oldBall;
                throw e;
            }
        }

        function done(err) {
            self._rebuilding = false;
            if (after) { try { after(); } catch (e) {} }
            var again = self._rebuildAgain;
            self._rebuildAgain = null;
            if (!again) return;
            var cb = (again === true) ? null : again;
            threads.start(function () { self._rebuildSync(cb); });   // 排队那次另起线程，别在这儿递归
            if (err) logd('注：上一次重建失败的原因是 ' + err);
        }

        if (this._buildOnce) {                      // 首次创建：本来就在脚本线程
            var err1 = null;
            try { build(); } catch (e) {
                err1 = (e && e.message ? e.message : e);
                logd('悬浮窗创建失败: ' + err1);
                say('悬浮窗创建失败：' + err1);
            }
            done(err1);
            return;
        }
        threads.start(function () {                 // 之后重建：另起线程离开 UI 线程
            var err = null;
            try { build(); } catch (e) {
                err = (e && e.message ? e.message : e);
                logd('面板重建失败: ' + err);
                try { say('面板重建失败：' + err); } catch (e2) {}
            }
            done(err);
        });
    },

    /** 转屏或改了面板比例后调用。整窗按新布局重建。 */
    relayout: function (cb) {
        var self = this;
        // uiRun 保证 _rebuildSync 在 UI 线程被调用；它内部再 spawn 一个
        // 脚本线程去建窗口，从而绕开「UI 线程里调 floaty.window 会自锁」。
        uiRun(function () { self._rebuildSync(cb); });
    },

    /** 把面板和悬浮球拉回屏幕可视范围内。 */
    fitToScreen: function () {
        var s = screenSize(), L = this.L;
        var pw = Math.round(L.PW * s.dp), ph = Math.round(L.PH * s.dp);
        var bs = Math.round(L.ballSize * s.dp);

        if (!this.panelPos) this.panelPos = { x: Math.round(s.w * 0.02), y: Math.round(s.h * 0.5 - ph / 2) };
        this.panelPos.x = Math.max(0, Math.min(s.w - pw, this.panelPos.x));
        this.panelPos.y = Math.max(0, Math.min(s.h - ph, this.panelPos.y));

        if (!this.ballPos) this.ballPos = { x: s.w - bs - 24, y: Math.round(s.h * 0.6) };
        this.ballPos.x = Math.max(0, Math.min(s.w - bs, this.ballPos.x));
        this.ballPos.y = Math.max(0, Math.min(s.h - bs, this.ballPos.y));

        winSetPos(this.ball, this.ballPos.x, this.ballPos.y);
        if (this.expanded) winSetPos(this.panel, this.panelPos.x, this.panelPos.y);
    },

    /**
     * 面板里所有 <button> 的 id。建窗后统一清掉 Android Button 的默认
     * minHeight(48dp) + 上下 inset，否则在 34~44dp 的行高里文字会被裁掉一半，
     * 分页箭头 ◀ ▶ 甚至会整个看不见（线上"翻不了页"的真凶）。
     */
    fixButtonMetrics: function () {
        var ids = ['collapse', 'songPgL', 'songPgR', 'trkPgL', 'trkPgR', 'editPgL', 'editPgR',
                   'playBtn', 'stopBtn', 'editSave', 'editCanc', 'impOk', 'impExp', 'impCanc',
                   'editBtn', 'calibBtn', 'testBtn', 'setBtn',
                   'impBtn', 'reloadBtn', 'progBtn', 'pressBtn', 'instBtn', 'flashBtn', 'fkBtn', 'expBtn', 'exitBtn', 'clrBtn', 'pcModeBtn', 'pcSrcBtn',
                   'midiBtn', 'tonicBtn', 'tk1Btn', 'tk2Btn', 'tk3Btn',
                   'oxM', 'oxP', 'oyM', 'oyP'];
        for (var i = 0; i < MAX_SONG_ROWS; i++) ids.push('s' + i);
        for (var j = 0; j < MAX_TRACK_ROWS; j++) ids.push('t' + j);
        deMinHeightAll(this.panel, ids);

        // 分页条那三处页码：单行 + 省略号，见 pageBar() 的注释
        var P = this.panel;
        oneLine(P.songPgN); oneLine(P.trkPgN); oneLine(P.editPgN);
        oneLine(P.info); oneLine(P.stat);
    },

    /**
     * 让编辑器输入框支持多行，并且【点它就能呼出系统输入法】。
     *
     * 线上"编辑谱呼不出手机键盘"的根因：floaty.window() 建出来的悬浮窗
     * 默认带 WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE（源码里写死的
     * flags = 520 = FLAG_LAYOUT_NO_LIMITS | FLAG_NOT_FOCUSABLE）。
     * 不可聚焦的窗口永远拿不到输入焦点，里面的 EditText 无论怎么点，
     * InputMethodManager 都不会给它开输入法会话。
     *
     * AutoX.js 把开关暴露在面板对象上，必须成对使用：
     *   panel.requestFocus()  → 清掉 FLAG_NOT_FOCUSABLE（能打字了）
     *   panel.disableFocus()  → 把 flag 加回去（触摸还回游戏）
     * 加不回去的后果很重：可聚焦窗口没有 FLAG_NOT_TOUCH_MODAL，
     * 整块屏幕的触摸都会被它吃掉，收起面板后画面直接点不动。
     * 所以 hidePanel / closeEditor / 保存 之前一律先 _hideIme()。
     */
    enableEditorInputs: function () {
        var IT = android.text.InputType;
        var self = this;
        for (var i = 0; i < MAX_EDIT_ROWS; i++) {
            (function (k) {
                try {
                    var et = self.panel['en' + k];
                    if (!et) return;
                    et.setInputType(IT.TYPE_CLASS_TEXT | IT.TYPE_TEXT_FLAG_MULTI_LINE);
                    et.setGravity(android.view.Gravity.TOP);
                    et.setSingleLine(false);
                    et.setHorizontallyScrolling(false);
                    et.setFocusable(true);
                    et.setFocusableInTouchMode(true);
                    et.setOnTouchListener(function (v, e) {
                        // 只在抬起时叫键盘；return false 让 EditText 继续自己
                        // 处理这次触摸（定位光标 / 拖动选择），别把事件吃掉。
                        if (e.getAction() === e.ACTION_UP) self._showIme(k);
                        return false;
                    });
                } catch (e) {}
            })(i);
        }
        // 「⌨ 输入导入」页的输入框，同一套处理：点它就能呼出输入法
        try {
            var im = this.panel.impText;
            if (im) {
                im.setInputType(IT.TYPE_CLASS_TEXT | IT.TYPE_TEXT_FLAG_MULTI_LINE);
                im.setGravity(android.view.Gravity.TOP);
                im.setSingleLine(false);
                im.setHorizontallyScrolling(false);
                im.setFocusable(true);
                im.setFocusableInTouchMode(true);
                im.setOnTouchListener(function (v, e) {
                    if (e.getAction() === e.ACTION_UP) self._showIme('impText');
                    return false;
                });
            }
        } catch (e) {}
    },

    /* ---------------- 输入法开关 ---------------- */

    /** 把软键盘叫出来。k = 输入框 id（'en3' / 'impText'）或编辑器下标（数字）。 */
    _showIme: function (k) {
        var self = this;
        var id = (typeof k === 'number') ? ('en' + k) : String(k || '');
        if (!id) return;
        this._imeId = id;
        uiRun(function () {
            var et = null;
            try { et = self.panel[id]; } catch (e0) {}
            if (!et) return;
            self._imeOn = true;
            try { self.panel.requestFocus(); }             // 清 flag，窗口这才可聚焦
            catch (e1) { logd('面板请求焦点失败: ' + e1); }
            var imm = null;
            try {
                imm = et.getContext().getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
            } catch (e2) {}
            function pop() {
                try { et.setFocusableInTouchMode(true); et.requestFocus(); } catch (e) {}
                if (!imm) return;
                try { imm.showSoftInput(et, 0); } catch (e) {}
            }
            pop();
            // 改 window flag 之后系统要过一两帧才真正把输入焦点给它，
            // 立刻 showSoftInput 经常白调，所以再补两次延时重试。
            setTimeout(function () { uiRun(pop); }, 130);
            setTimeout(function () { uiRun(pop); }, 340);
        });
    },

    /** 收键盘 + 把面板还原成不可聚焦，触摸才能重新落回游戏上。 */
    _hideIme: function () {
        // 收键盘前把正在输入的参数保底提交一次（仅内部路径触发：隐藏面板、
        // 进出编辑页等；不是「点空白」手势 —— 那个已按需求删除，确认只认回车）
        if (this._imeOn && this._imeId) {
            var pk = { bpmIn: 'bpm', spIn: 'sp', lpIn: 'lp', frIn: 'fr', toIn: 'to' }[this._imeId];
            if (pk) { try { this.commitParam(pk); } catch (e0) {} }
        }
        if (!this._imeOn) return;
        var self = this;
        this._imeOn = false;
        this._imeId = null;
        uiRun(function () {
            var p = self.panel;
            if (!p) return;
            // 输入法的会话是挂在【窗口】上的，用面板根视图 root 的 windowToken
            // 就能收掉它；不用去找"当前是哪个 EditText 有焦点"（GONE 掉的
            // 输入框 windowToken 是 null，拿它去收反倒收不干净）。
            try {
                var rv = p.root;
                if (rv) {
                    var imm = rv.getContext().getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
                    if (imm) imm.hideSoftInputFromWindow(rv.getWindowToken(), 0);
                }
            } catch (e) {}
            for (var i = 0; i < MAX_EDIT_ROWS; i++) {
                try {
                    var et = p['en' + i];
                    if (et && et.hasFocus && et.hasFocus()) et.clearFocus();
                } catch (e2) {}
            }
            var pids = ['bpmIn', 'spIn', 'lpIn', 'frIn', 'toIn'];
            for (var pi = 0; pi < pids.length; pi++) {
                try {
                    var pe = p[pids[pi]];
                    if (pe && pe.hasFocus && pe.hasFocus()) pe.clearFocus();
                } catch (e2b) {}
            }
            try {
                var im2 = p.impText;
                if (im2 && im2.hasFocus && im2.hasFocus()) im2.clearFocus();
            } catch (e2c) {}
            try { if (p.disableFocus) p.disableFocus(); }   // 把 FLAG_NOT_FOCUSABLE 加回去
            catch (e3) { logd('面板释放焦点失败: ' + e3); }
        });
    },

    /* ---------------- 曲目参数：键盘输入 ---------------- */

    /**
     * 把 BPM / 倍数 / 循环 / 起拍 / 止拍 五个输入框配成「点了就能打字」。
     *
     * 实现完全照着「输入导入」页那个验证过能正常打字的谱框（impText）抄：
     * setInputType / setFocusable / setFocusableInTouchMode / 触摸弹键盘，
     * 不调 setSingleLine（它会改写输入类型）、不给输入框吃 layout_weight。
     *
     * 输入法就是你手机自己的输入法；唯一特殊处理是带上
     * IME_FLAG_NO_EXTRACT_UI / NO_FULLSCREEN —— 横屏下不进那个占满全屏、
     * 带独立确认键的「提取窗口」（在那个窗口里打字提交不回来），
     * 键盘只贴在屏幕下沿，文字直接进面板上的框。
     *
     * 确认方式（只保留一种）：键盘上的【回车/完成】= 生效并收键盘收光标。
     */
    setupParamInputs: function () {
        var self = this;
        var IT = android.text.InputType;
        var IME_OPTS = 6 | 0x1000000 | 0x2000000;   // DONE + 禁全屏提取 + 禁全屏
        var pairs = [['bpmIn', 'bpm'], ['spIn', 'sp'], ['lpIn', 'lp'], ['frIn', 'fr'], ['toIn', 'to']];
        for (var i = 0; i < pairs.length; i++) {
            (function (pair) {
                var et = null, kind = pair[1];
                try { et = self.panel[pair[0]]; } catch (e0) {}
                if (!et) return;
                try {
                    et.setInputType(kind === 'sp'
                        ? (IT.TYPE_CLASS_NUMBER | IT.TYPE_NUMBER_FLAG_DECIMAL)
                        : IT.TYPE_CLASS_NUMBER);
                    et.setGravity(android.view.Gravity.CENTER_VERTICAL);
                    et.setImeOptions(IME_OPTS);
                    et.setFocusable(true);
                    et.setFocusableInTouchMode(true);
                    et.setOnTouchListener(function (v, e) {
                        if (e.getAction() === e.ACTION_UP) {
                            var s = cur();
                            // 直读曲目只有 BPM 改不了（时序来自 .mid 本身）；
                            // 起音/止音是按「第几个音」裁剪，照常可以填
                            if (s && s.isMidiFile && kind === 'bpm') {
                                say('MIDI 直读的 BPM 来自 .mid 本身，改不了；起音/止音可以填');
                                return false;
                            }
                            self._showIme(pair[0]);
                        }
                        return false;
                    });
                    et.setOnEditorActionListener(function (v, actionId, ev) {
                        var done = actionId === 6 ||
                                   (ev && ev.getKeyCode && ev.getKeyCode() === 66 && ev.getAction() === 0);  // 回车
                        if (done) {
                            self.commitParam(kind);
                            self._hideIme();
                            return true;
                        }
                        return false;
                    });
                } catch (e) { logd('参数框 ' + pair[0] + ' 初始化失败: ' + e); }
            })(pairs[i]);
        }
        this._syncParamInputs();        // 建好再刷一遍当前值（XML 里已带默认值，这里保证换曲后同步）
    },

    /**
     * 把当前曲目的参数值刷进五个输入框。
     * · 正在输入（有焦点）的那个框不动，免得键盘每敲一个字就被刷回去；
     * · 止拍为空显示「尾」（= 播到谱尾）；
     * · MIDI 直读曲目 BPM/起止拍显示「—」。
     */
    _syncParamInputs: function () {
        var P = this.panel;
        if (!P || !P.bpmIn) return;
        var vals = paramDisplayVals();
        var idMap = { bpm: 'bpmIn', sp: 'spIn', lp: 'lpIn', fr: 'frIn', to: 'toIn' };
        for (var k in idMap) {
            var et = P[idMap[k]];
            if (!et) continue;
            try {
                if (et.hasFocus && et.hasFocus()) continue;   // 打字中，别覆盖
                et.setText(vals[k]);
            } catch (e) { try { et.setText(vals[k]); } catch (e2) {} }
        }
    },

    /** 读取输入框并应用（带范围钳制；输错/为空则保持原值并还原显示）。 */
    commitParam: function (kind) {
        var s = cur();
        if (!s) return;
        var idMap = { bpm: 'bpmIn', sp: 'spIn', lp: 'lpIn', fr: 'frIn', to: 'toIn' };
        var et = null;
        try { et = this.panel[idMap[kind]]; } catch (e0) {}
        if (!et) return;
        var t = String(et.getText()).trim();

        if (kind === 'bpm') {
            var v = parseInt(t, 10);
            if (!isNaN(v)) s.bpm = Math.max(20, Math.min(400, v));
        } else if (kind === 'sp') {
            var v2 = parseFloat(t);
            if (!isNaN(v2)) s.speed = fnum(Math.max(0.2, Math.min(4, v2)), 2);
        } else if (kind === 'lp') {
            var v3 = parseInt(t, 10);
            if (!isNaN(v3)) s.loop = Math.max(1, Math.min(999, v3));
        } else if (kind === 'fr') {
            if (s.isMidiFile) {
                // MIDI直读：单位是「音」，从头数（1 或「头」= 从头播）
                if (t === '' || t === '头') s._fromNote = 1;
                else { var n4 = parseInt(t, 10); if (!isNaN(n4)) s._fromNote = Math.max(1, Math.min(999999, n4)); }
            } else {
                var v4 = parseInt(t, 10);
                if (!isNaN(v4)) s.startBeat = Math.max(0, v4);
            }
        } else if (kind === 'to') {
            if (s.isMidiFile) {
                // MIDI直读：「尾」或留空 = 播到最后一音；数字 = 播到第几个音（含）
                if (t === '' || t === '尾') s._toNote = null;
                else { var n5 = parseInt(t, 10); if (!isNaN(n5)) s._toNote = Math.max(1, Math.min(999999, n5)); }
            } else {
                // 「尾」或留空 = 播到谱尾；数字 = 播到该拍（不早于起拍+1）
                s.endBeat = (t === '' || t === '尾' || isNaN(parseFloat(t))) ? null
                    : Math.max((s.startBeat || 0) + 1, Math.min(99999, parseFloat(t)));
            }
        }
        snapshotSong(s);          // 立刻进缓存：重扫/切模式/重启都不丢
        this.refresh(true);
    },

    _readEditorDrafts: function () {
        var a = [];
        for (var i = 0; i < MAX_EDIT_ROWS; i++) {
            try { a.push(String(this.panel['en' + i].getText())); } catch (e) { a.push(''); }
        }
        return a;
    },
    _writeEditorDrafts: function (a) {
        for (var i = 0; i < MAX_EDIT_ROWS; i++) {
            try { this.panel['en' + i].setText(a[i] || ''); } catch (e) {}
        }
    },
    _readImpDraft: function () {
        try { return String(this.panel.impText.getText()); } catch (e) { return this._impText || ''; }
    },
    _writeImpDraft: function (t) {
        try { this.panel.impText.setText(t || ''); } catch (e) {}
    },

    /* ---------------- 事件绑定 ---------------- */

    /**
     * 拖动手势。位置以脚本自己记录的 panelPos / ballPos 为准，
     * 绝不回读 win.getPosition()（AutoX.js 没有这个方法，回读必崩）。
     *
     * 悬浮球三种手势：
     *   单击   = 播放 / 停止当前曲目
     *   长按   = 开关面板（按住 480ms 触发，带震动反馈，不用等松手）
     *   拖动   = 移动位置
     * 面板标题栏只负责拖动。
     */
    bindDrag: function (win, handle, isBall) {
        var self = this;
        var sx = 0, sy = 0, wx = 0, wy = 0;
        var moved = false, longFired = false, longTimer = null, posKey = isBall ? 'ballPos' : 'panelPos';

        handle.setOnTouchListener(function (v, e) {
            switch (e.getAction()) {
                case e.ACTION_DOWN:
                    sx = e.getRawX(); sy = e.getRawY();
                    var cur = self[posKey] || { x: 0, y: 0 };      // 用自己的记录，不回读窗口
                    wx = cur.x; wy = cur.y;
                    moved = false; longFired = false;
                    if (isBall) {
                        // 按住悬浮球期间音量键切歌临时失效：长按悬浮球的 480ms 里
                        // 还在播放，握持手机极易蹭到音量键 → 误切一两只歌（历史 bug：
                        // "长按呼出面板时选歌往后跳两三首"）。球被按住时音量键
                        // 一定是无意的；抬起后再给 400ms 余量防手指回弹。
                        self.ballHeld = true;
                        self._ballGuardUntil = 0;
                        if (longTimer) clearTimeout(longTimer);
                        longTimer = setTimeout(function () {
                            longTimer = null;
                            if (!moved && !longFired) {
                                longFired = true; vib(30);
                                // 播放中长按 = 停止 + 打开面板（不用先点一下暂停再开面板）
                                // 空闲时长按 = 开关面板
                                if (Player.running) { self.doStop(); self.showPanel(); }
                                else self.toggle();
                            }
                        }, 480);
                    }
                    return true;

                case e.ACTION_MOVE:
                    var ddx = e.getRawX() - sx, ddy = e.getRawY() - sy;
                    if (!moved && (Math.abs(ddx) > 12 || Math.abs(ddy) > 12)) {
                        moved = true;
                        if (longTimer) { clearTimeout(longTimer); longTimer = null; }
                    }
                    if (moved) {
                        var nx = wx + ddx, ny = wy + ddy;
                        self[posKey] = { x: nx, y: ny };
                        winSetPos(win, nx, ny);
                    }
                    return true;

                case e.ACTION_UP:
                case e.ACTION_CANCEL:
                    if (longTimer) { clearTimeout(longTimer); longTimer = null; }
                    if (isBall) {
                        self.ballHeld = false;
                        self._ballGuardUntil = Date.now() + 400;   // 抬起余量：防回弹误触
                    }
                    if (isBall && !moved && !longFired) self.onBallTap();
                    return true;
            }
            return true;
        });
    },

    /** 悬浮球单击：面板开着 → 只收面板（不播放，再点一下才开始播）；面板收着 → 播放/停止。 */
    onBallTap: function () {
        if (this.expanded) { this.hidePanel(); return; }
        if (Player.running) { this.doStop(); vib(18); }
        else { this.doPlay(); }
    },

    bindEvents: function () {
        var self = this;
        this.bindDrag(this.ball, this.ball.bb, true);
        this.bindDrag(this.panel, this.panel.title, false);

        this.panel.collapse.click(function () { self.hidePanel(); });
        this.panel.playBtn.click(function () { self.doPlay(); });
        this.panel.stopBtn.click(function () { self.doStop(); });
        this.panel.pcModeBtn.click(function () { self.togglePcMode(); });
        this.panel.pcSrcBtn.click(function () { self.switchPlaySource(); });
        this.panel.calibBtn.click(function () {
            // 7键琴没有 3×5 网格，两点标定不适用，只能全键标定
            if (CONFIG.instrument === 'lute7') {
                say('7键琴用全键标定，已为你打开');
                self.startFullCalib();
                return;
            }
            self.startCalib();
        });
        this.panel.fkBtn.click(function () { self.startFullCalib(); });
        this.panel.instBtn.click(function () { self.switchInstrument(); });
        // 「演奏:」按钮已搬到曲目分页条右侧(pcSrcBtn),抽屉里不再放
        this.panel.pressBtn.click(function () { self.togglePressMode(); });
        this.panel.exitBtn.click(function () {
            say('脚本已退出');
            shutdown('面板「⏏ 退出脚本」按钮');
        });
        this.panel.testBtn.click(function () { self.runTest(); });
        this.panel.setBtn.click(function () { self.toggleSet(); });
        this.panel.reloadBtn.click(function () { self.reloadLibrary(); });
        this.panel.impBtn.click(function () {
            if (CONFIG.playSource === 'midi') {
                say('请先切回「演奏:曲谱」再输入导入');
                self.setStat('MIDI 直读模式下曲库是 .mid 文件列表，切回「演奏:曲谱」再导入');
                return;
            }
            self.openImport();
        });
        this.panel.editBtn.click(function () {
            if (cur() && cur().isMidiFile) {
                say('MIDI 直读曲目不能编辑；想改谱请切回「演奏:曲谱」用「导入MIDI」转成曲谱');
                self.setStat('MIDI 直读曲目不支持编辑');
                return;
            }
            self.openEditor();
        });
        this.panel.editSave.click(function () { self.saveEditor(); });
        this.panel.editCanc.click(function () { self.closeEditor(); });
        this.panel.impOk.click(function () { self.confirmImport(); });
        this.panel.impExp.click(function () { self.exportImport(); });
        this.panel.impCanc.click(function () { self.closeImport(); });
        this.panel.expBtn.click(function () {
            var s = LIBRARY[self.sel];
            // MIDI 直读模式：导出键 = 按当前各轨调性把选中的 .mid 转成 .txt
            if (CONFIG.playSource === 'midi') { self.exportMidiDirect(); return; }
            if (s && s.isMidiFile) {
                say('MIDI 直读曲目不支持导出；切回「演奏:曲谱」后用「导入MIDI」转成曲谱即可保存');
                self.setStat('MIDI 直读曲目不支持导出');
                return;
            }
            var p = s ? exportSongFile(s) : null;
            self.setStat(p ? '已导出 ' + p : '导出失败');
            say(p ? '已导出到 ' + p : '导出失败');
        });
        this.panel.clrBtn.click(function () {
            clearCalibration();
            var m = (CONFIG.instrument === 'lute7')
                ? '已清除 7键琴标定（播放前需重新全键标定）'
                : '已恢复 15键琴默认识别坐标';
            self.setStat(m);
            say(m);
        });
        this.panel.flashBtn.click(function () {
            CONFIG.clickFlash = !CONFIG.clickFlash;
            if (!CONFIG.clickFlash) flashClose();
            self.panel.flashBtn.setText(self.flashText());
        });

        // ---- 播放进度开关（取代旧「点击方式/按压时长」）----
        // 亚缓存 = 内存单槽（切歌不清，播放别的音乐覆盖，退出失效）；
        // 超缓存 = 持久化到 storages（切歌/重启都在），每首歌各记各的；
        // 互斥清空：切到亚 → 超的全部进度清空；切到超 → 亚的记录清空。
        this.panel.progBtn.click(function () {
            if (Player.running) self.doStop();          // 换模式前先停
            CONFIG.progressMode = (CONFIG.progressMode === 'super') ? 'sub' : 'super';
            saveCalibration();
            if (CONFIG.progressMode === 'super') {
                _resumePos = null;                                       // 亚的记录清空
                say('播放进度:超缓存 —— 每首歌的进度永久记录（重启也在），切歌后接着上次播；播完一首清一首');
            } else {
                try { store().put('progressSuper', {}); } catch (e) {}   // 超的记录全清
                say('播放进度:亚缓存 —— 只记当前歌的暂停位置，播放别的音乐即覆盖，退出脚本失效');
            }
            self.panel.progBtn.setText(self.progText());
            self.setStat(self.panel.progBtn.getText() + ' · 已按新模式重新记录');
            self.refresh(true);
        });

        // ---- MIDI 导入 ----
        this.panel.midiBtn.click(function () { self.importMidi(); });
        // ---- MIDI 直读模式：音轨1/2/3 各自的调 ----
        for (var tk = 0; tk < 3; tk++) {
            (function (idx) {
                var btn = self.panel['tk' + (idx + 1) + 'Btn'];
                if (btn) btn.click(function () {
                    var s = cur();
                    if (!s || !s.isMidiFile) return;
                    try { ensureMidiParsed(s); } catch (e) { return; }
                    if (!s.tracks[idx]) { say('这首没有音轨' + (idx + 1) + '，调不了'); return; }
                    var now = (s.trackTonics && s.trackTonics[idx]) || 'auto';
                    var next = TONIC_CHOICES[(TONIC_CHOICES.indexOf(now) + 1) % TONIC_CHOICES.length];
                    if (!s.trackTonics) s.trackTonics = [];
                    s.trackTonics[idx] = next;
                    snapshotSong(s);                       // 调性进缓存，重扫/重启不丢
                    ensureMidiParsed(s);                   // key 变了，按新调重映射
                    self.setStat('音轨' + (idx + 1) + '「' + s.tracks[idx].name + '」的调: ' +
                                 (next === 'auto' ? '自动' : next) + '，直接播放试听');
                    self.refresh(true);
                });
            })(tk);
        }
        this.panel.tonicBtn.click(function () {
            // 循环切主音(1=do)。auto = 自动挑最优的那个；转完在日志里能看到
            // 「原样弹对 XX%」，嫌低就切到别的调重转一次，挑百分比最高的。
            var i = TONIC_CHOICES.indexOf(CONFIG.midiTonic);
            CONFIG.midiTonic = TONIC_CHOICES[(i + 1) % TONIC_CHOICES.length];
            saveCalibration();
            self.panel.tonicBtn.setText(self.tonicText());
            self.setStat('主音(1=do) = ' + self.tonicText().replace('调:', '') + '；' +
                         (CONFIG.playSource === 'midi'
                             ? 'MIDI 直读会按新调重新映射音高，看列表刷新后直接播放试听'
                             : '重新点「🎼 导入MIDI」按新调转一遍'));
        });

        // 分页
        this.panel.songPgL.click(function () { self.songPage--; self.refresh(true); });
        this.panel.songPgR.click(function () { self.songPage++; self.refresh(true); });
        this.panel.trkPgL.click(function () { self.trkPage--; self.refresh(true); });
        this.panel.trkPgR.click(function () { self.trkPage++; self.refresh(true); });

        // 曲目行 / 音轨行（槽位固定，全局下标在点击时按当前页换算）
        // 面板弹出的保护期（_panelGraceUntil，见 showPanel）内忽略这两类点击：
        // 那一下多半是"想点悬浮球"落在了面板上，误选歌/误勾选的历史根源。
        function panelGraceActive() { return Date.now() < (self._panelGraceUntil || 0); }
        for (var i = 0; i < MAX_SONG_ROWS; i++) {
            (function (k) {
                var b = self.panel['s' + k];
                if (b) b.click(function () {
                    if (panelGraceActive()) return;
                    var gi = self.songPage * self._perSong + k;
                    if (gi < 0 || gi >= LIBRARY.length) return;
                    var prevSong = LIBRARY[self.sel];
                    self.sel = gi;
                    // 只选歌不清续播缓存：等真的"播放了别的音乐"再覆盖/作废
                    rememberSel();               // 记住你选的这首，重扫后自动回来
                    self.refresh(true);
                });
            })(i);
        }
        for (var j = 0; j < MAX_TRACK_ROWS; j++) {
            (function (k) {
                var b = self.panel['t' + k];
                if (b) b.click(function () {
                    if (panelGraceActive()) return;
                    var s = cur();
                    if (!s) return;
                    var gi = self.trkPage * self._perTrk + k;
                    if (!s.tracks[gi]) return;
                    s.tracks[gi].on = !s.tracks[gi].on;
                    snapshotSong(s);             // 勾选状态也缓存，重扫不丢
                    self.refresh(true);
                });
            })(j);
        }

        // 编辑模式的音轨分页
        this.panel.editPgL.click(function () { self.stepEditor(-1); });
        this.panel.editPgR.click(function () { self.stepEditor(1); });

        // 设置抽屉里的步进器（偏移X / 偏移Y）。
        // 曲目参数（BPM/倍数/循环/起止拍）键盘输入；按压时长步进已删除
        // （固定短按永远 30ms，延音手感走「长按:分档/固定」开关）。
        function step(id, fn) {
            var m = self.panel[id + 'M'], p = self.panel[id + 'P'];
            if (m) m.click(function () { fn(-1); });
            if (p) p.click(function () { fn(1); });
        }
        step('ox', function (d) { GRID_OFFSET.dx = fnum(GRID_OFFSET.dx + d * 0.002, 4); saveCalibration(); self.refresh(true); });
        step('oy', function (d) { GRID_OFFSET.dy = fnum(GRID_OFFSET.dy + d * 0.002, 4); saveCalibration(); self.refresh(true); });
    },

    /** 「播放进度」按钮上的文字。 */
    progText: function () {
        return CONFIG.progressMode === 'super' ? '进度:超缓存' : '进度:亚缓存';
    },
    flashText: function () { return '红点:' + (CONFIG.clickFlash ? '开' : '关'); },
    /** 「调:」按钮上显示的文字。auto 就是自动挑最优主音。 */
    tonicText: function () {
        var t = CONFIG.midiTonic || 'auto';
        if (t === 'auto') return '调:自动';
        if (TONIC_CHOICES.indexOf(t) < 0) return '调:' + t;
        return '调:' + t;
    },

    /* ---------------- 刷新 ---------------- */

    /** 播放中只做轻量刷新，避免每 250ms 重写几十个控件。 */
    refresh: function (force) {
        var self = this;
        uiRun(function () {
            if (!force && Player.running && Player.timeline) self._tickOnly();
            else self._refreshNow();
        });
    },

    _tickOnly: function () {
        try {
            var P = this.panel, tl = Player.timeline;
            var pc = Math.floor(Player.progress() * 100);
            var ch = tl.chords[Player.index];
            var el = ((Date.now() - this._t0) / 1000).toFixed(1);
            P.stat.setText('♪ ' + (this._tickLabel || '') + '  ' + pc + '%  ' +
                           (Player.index + 1) + '/' + tl.count + '  ' + (ch ? ch.label : '') + '  ' + el + 's');
            P.playBtn.setText('▶ 播放中');
        } catch (e) {}
    },

    _refreshNow: function () {
        var P = this.panel;
        if (!P || !this.L) return;
        var L = this.L;
        var GONE = android.view.View.GONE, VIS = android.view.View.VISIBLE;

        // 方向提示：面板尺寸横竖屏一样，这里只是告诉你现在是哪个方向
        try {
            P.orient.setText((isLandscapeNow() ? '横屏 ' : '竖屏 ') +
                             L.PW + '×' + L.PH + 'dp' + (L.needScroll ? ' ·可滑' : ''));
        } catch (e) {}

        // ---- 曲目分页 ----
        var per = Math.min(L.songRows, MAX_SONG_ROWS);
        var pages = Math.max(1, Math.ceil(LIBRARY.length / per));
        if (this.songPage < 0) this.songPage = 0;
        if (this.songPage > pages - 1) this.songPage = pages - 1;
        this._perSong = per;
        for (var i = 0; i < MAX_SONG_ROWS; i++) {
            var b = P['s' + i];
            if (!b) continue;
            var gi = this.songPage * per + i;
            if (i >= per || gi >= LIBRARY.length) { b.setVisibility(GONE); continue; }
            b.setVisibility(VIS);
            var sg = LIBRARY[gi];
            b.setText((gi === this.sel ? '▶ ' : '　 ') + (gi + 1) + '. ' +
                      (sg.isMidiFile ? '🎼 ' : '') + sg.name +
                      (sg.broken ? ' ✗' : '') + (sg.source && sg.source !== 'builtin' && !sg.isMidiFile ? ' 📄' : ''));
            try {
                b.setTextColor(gi === this.sel ? COL_HOT : COL_DIM);
                b.setBackgroundColor(gi === this.sel ? COL_SEL_BG : COL_TRANSPARENT);
            } catch (e) {}
        }
        // 页码写清楚「第几页/共几页」和总数，翻页按钮本身也带文字，
        // 之前只画两个 ◀ ▶ 小箭头，被 Button 的 minHeight 裁到看不见，
        // 用户根本不知道还能翻页。文案做短一点：分页条现在把「剩下的宽度」
        // 全给页码并右对齐，窄面板里放不下时会以省略号收尾，而不是把按钮挤走。
        P.songPgN.setText('第' + (this.songPage + 1) + '/' + pages + '页 · ' + LIBRARY.length + '首');

        var song = LIBRARY[this.sel];
        // MIDI 直读模式：选中哪首就解析哪首（懒加载，其余文件不碰）
        if (song && song.isMidiFile && !song.broken) {
            try { ensureMidiParsed(song); }
            catch (e) {
                song.broken = true;
                logd('· ' + song.name + '.mid 解析失败: ' + (e && e.message ? e.message : e));
            }
        }
        if (!song) {
            P.info.setText('曲库为空');
            for (var z = 0; z < MAX_TRACK_ROWS; z++) if (P['t' + z]) P['t' + z].setVisibility(GONE);
            P.trkPgN.setText('0/0');
            return;
        }
        // 注意：这里【不】自动翻页去追选中项。用户手动翻页浏览时，
        // 每次刷新都跳回选中页会打架。程序改 sel 的地方（导入、重载）
        // 自己负责把 songPage 设对。

        // ---- 音轨分页 ----
        var tper = Math.min(L.trkRows, MAX_TRACK_ROWS);
        var tp = Math.max(1, Math.ceil(song.tracks.length / tper));
        if (this.trkPage < 0) this.trkPage = 0;
        if (this.trkPage > tp - 1) this.trkPage = tp - 1;
        this._perTrk = tper;
        for (var j = 0; j < MAX_TRACK_ROWS; j++) {
            var tb = P['t' + j];
            if (!tb) continue;
            var gj = this.trkPage * tper + j;
            var tk = song.tracks[gj];
            if (j >= tper || !tk) { tb.setVisibility(GONE); continue; }
            tb.setVisibility(VIS);
            tb.setText((tk.on ? '☑ ' : '☐ ') + tk.name + ' (' + (tk.events ? tk.events.length : 0) + '音)');
            try {
                tb.setTextColor(tk.on ? COL_HOT : COL_DIM);
                tb.setBackgroundColor(tk.on ? COL_SEL_BG : COL_TRANSPARENT);
            } catch (e) {}
        }
        P.trkPgN.setText('第' + (this.trkPage + 1) + '/' + tp + '页 · ' + song.tracks.length + '轨');

        // ---- 时间轴试算 ----
        var sel = [];
        for (var q = 0; q < song.tracks.length; q++) if (song.tracks[q].on) sel.push(q);
        var cut = midiSliceOpt(song, sel);            // 直读的起音/止音 → 毫秒窗口
        var tlOpt = { trackIdx: sel };
        if (cut) { tlOpt.startBeat = cut.cutA; tlOpt.endBeat = cut.cutB; }
        var tl = (Player.running && Player.timeline) ? Player.timeline : null;
        if (!tl) {
            try { tl = buildTimeline(song, tlOpt); } catch (e) { logd('buildTimeline: ' + e); }
        }
        var tb2 = songTotalBeats(song);
        this._syncParamInputs();       // 参数值刷进输入框（正在输入的那个不动）
        var sec = tl ? (tl.totalMs / 1000).toFixed(1) : '0';
        P.info.setText(song.isMidiFile
            ? ('MIDI直读 · 共' + (cut ? cut.totalNotes : midiNoteGroups(song, sel).starts.length) + '音' +
               (cut ? ' 播第' + cut.fromN + '~' + cut.toN + '音' : '') +
               ' · 播' + sec + '秒 · ' +
               (tl ? tl.count : 0) + '击 · 选中' + sel.length + '/' + song.tracks.length + '轨' +
               (song.midiDropped ? ' · 弃' + song.midiDropped + '音' : ''))
            : ('共' + Math.round(tb2) + '拍 · 播' + sec + '秒 · ' +
               (tl ? tl.count : 0) + '击 · 选中' + sel.length + '/' + song.tracks.length + '轨'));

        // 起拍/止拍 的标签和单位随演奏模式切换（直读 = 起音/止音）
        try {
            P.frLab.setText(song.isMidiFile ? '起音' : '起拍');
            P.frUnit.setText(song.isMidiFile ? '音' : '拍');
            P.toLab.setText(song.isMidiFile ? '止音' : '止拍');
            P.toUnit.setText(song.isMidiFile ? '音' : '拍');
        } catch (e) {}

        P.progBtn.setText(this.progText());
        P.instBtn.setText(this.instText());
        if (P.srcBtn) P.srcBtn.setText(this.srcText());
        P.pressBtn.setText(this.pressText());

        // 设置抽屉里的 MIDI 相关两行按演奏模式互换：
        // 曲谱模式 = 「导入MIDI + 全局调:」；MIDI 直读 = 三个逐轨调性按钮
        var isMidiMode = CONFIG.playSource === 'midi';
        try {
            P.midiRow.setVisibility(isMidiMode ? GONE : VIS);
            P.tkRow.setVisibility(isMidiMode ? VIS : GONE);
        } catch (e) {}
        P.expBtn.setText(isMidiMode ? '📄 转化选中MIDI' : '📄 导出选中曲.txt');
        if (isMidiMode) {
            for (var ti = 0; ti < 3; ti++) {
                var tbtn = P['tk' + (ti + 1) + 'Btn'];
                if (!tbtn) continue;
                var has = song && song.isMidiFile && song.tracks && song.tracks[ti];
                try {
                    tbtn.setEnabled(!!has);
                    tbtn.setText('轨' + (ti + 1) + '调:' +
                        (has ? ((song.trackTonics && song.trackTonics[ti]) || 'auto') : '—'));
                } catch (e) {}
            }
        }
        try { P.dirHelp.setText(this.dirHelpText()); } catch (eh) {}
        try { P.midiHelp.setText(this.midiHelpText()); } catch (eh) {}
        P.oxV.setText((GRID_OFFSET.dx * 100).toFixed(1) + '%');
        P.oyV.setText((GRID_OFFSET.dy * 100).toFixed(1) + '%');
        P.flashBtn.setText(this.flashText());
        P.tonicBtn.setText(this.tonicText());

        // 播放按钮的文字先复位再走告警分支：以前告警分支直接 return，
        // 按钮就永远停在「▶ 播放中」，明明已经停了。
        if (!Player.running) P.playBtn.setText('▶ 开始');
        if (tl && tl.notes.length) { this.setStat('⚠ ' + tl.notes[0]); return; }
    },

    setStat: function (t) {
        var self = this;
        uiRun(function () { try { self.panel.stat.setText(String(t)); } catch (e) {} });
    },

    /* ---------------- 显示 / 隐藏 ---------------- */

    toggle: function () { if (this.expanded) this.hidePanel(); else this.showPanel(); },

    showPanel: function () {
        this.expanded = true;
        // 面板刚弹出的 700ms 内忽略曲目行/音轨行的点击 —— 长按悬浮球呼出面板时，
        // 面板往往盖住了球原来的位置，接下来"想点球"的一下会落到曲目行（=莫名
        // 选别的歌）或音轨行（=莫名取消勾选）上。历史 bug 的另一个根源。
        this._panelGraceUntil = Date.now() + 700;
        var self = this;
        this.fitToScreen();
        uiRun(function () {
            self.refresh(true);
            winSetPos(self.panel, self.panelPos.x, self.panelPos.y);
        });
    },

    hidePanel: function () {
        this.expanded = false;
        var self = this;
        // 收面板前一定要把「可聚焦」还回去：可聚焦的悬浮窗是模态窗口，
        // 屏幕上的触摸会被它全吃掉，藏在屏外也照样拦，游戏就点不动了。
        this._hideIme();
        uiRun(function () { winSetPos(self.panel, -9999, -9999); });
    },

    toggleSet: function () {
        this.setOpen = !this.setOpen;
        var self = this, open = this.setOpen;
        uiRun(function () {
            self.panel.setBox.setVisibility(open ? android.view.View.VISIBLE : android.view.View.GONE);
        });
    },

    /* ---------------- 播放 ---------------- */

    /** 「PC模式」按钮文字。 */
    pcModeText: function () {
        return CONFIG.pcMode ? 'PC模式✓' : 'PC模式';
    },

    /** PC模式:让 PC 程序(pc_piano 服务器)演奏选中曲目,手机只发指令不弹。
     *  通道 = adb reverse tcp:8766(服务器在设备上线时自动建立)。 */
    pcPlay: function (song) {
        var self = this;
        if (Player.running) this.doStop(true);      // 本地残留先停
        if (this._pcBusy) { say('PC 正在处理上一个请求…'); return; }
        this._pcBusy = true;
        this.setStat('▶ PC演奏请求中: ' + song.name + ' …');
        threads.start(function () {
            try {
                var res = http.post('http://127.0.0.1:8766/api/pcplay',
                    { file: song.file, kind: song.kind || 'midi' },
                    { timeout: 30000 });
                var body = res.body ? res.body.string() : '';
                var j = {}; try { j = JSON.parse(body); } catch (e) {}
                if (j.ok) { self.setStat('▶ PC演奏: ' + song.name + ' · ' + (j.durationSec || 0) + 's(进度看 PC 网页)'); say('PC演奏: ' + song.name); }
                else { self.setStat('PC播放失败: ' + (j.err || body.slice(0, 80))); say('PC播放失败: ' + (j.err || '')); }
            } catch (e) {
                self.setStat('PC连接失败(要插USB且PC钢琴服务器在跑): ' + e);
                say('PC连接失败：确认 USB 已插、PC 服务器在跑');
            }
            self._pcBusy = false;
        });
    },

    /** PC模式:让 PC 程序停止(等效网页的■停止,PC 侧记断点)。 */
    pcStop: function () {
        var self = this;
        threads.start(function () {
            try { http.post('http://127.0.0.1:8766/api/pcstop', {}, { timeout: 15000 }); } catch (e) {}
            self.setStat('■ 已让 PC 停止(断点已记,PC 网页可续播)');
        });
    },

    /** 「PC模式」开关:开 = 曲库切到 pc长按/,播放走 PC;关 = 回到当前演奏模式的曲库。 */
    togglePcMode: function () {
        if (Player.running) this.doStop();
        CONFIG.pcMode = !CONFIG.pcMode;
        this.songPage = 0; this.trkPage = 0;
        rebuildLibrary();
        this.panel.pcModeBtn.setText(this.pcModeText());
        var msg = CONFIG.pcMode
            ? 'PC模式 ✓ · 曲库 = pc长按/ 的 ' + LIBRARY.length + ' 个文件 · 播放由 PC 演奏,手机不弹'
            : '已退出 PC模式 · 曲库回到「' + this.srcText() + '」· ' + LIBRARY.length + ' 首';
        this.setStat(msg);
        say(msg);
        this.refresh(true);
    },

    doPlay: function () {
        this._hideIme();                        // 正在改参数就先提交
        var song = LIBRARY[this.sel];
        if (!song) {
            say(CONFIG.playSource === 'midi' ? 'midi 目录里没有 .mid 文件' : '曲库为空');
            return;
        }
        if (CONFIG.pcMode) { this.pcPlay(song); return; }   // PC模式:手机只点歌,由 PC 程序演奏,手机不弹
        // 竖屏 = 不在游戏里。这时点击只会落到桌面/别的 App 上（误触），
        // 游戏本身只能横屏跑，所以竖屏一律禁止播放。
        if (!isLandscapeNow()) {
            this.setStat('竖屏不播放：游戏只能横屏运行，竖屏点击会误触其他应用');
            say('竖屏禁止播放（防误触），进游戏横屏后再按');
            return;
        }
        if (song.isMidiFile) {
            if (song.broken) { this.setStat('这个 .mid 解析失败（文件损坏或不是标准 MIDI）'); say('这个 .mid 解析失败'); return; }
            try { ensureMidiParsed(song); }
            catch (e) { song.broken = true; this.setStat('解析失败：' + e); say('解析失败'); return; }
        }
        if (CONFIG.instrument === 'lute7' && !calib7Ready()) {
            this.setStat('7键琴还没标定：⚙设置 → 🔢 全键标定（7 键）');
            say('7键琴还没标定，先做一次全键标定');
            return;
        }
        if (Player.running) { this.doStop(); return; }

        var sel = [];
        for (var i = 0; i < song.tracks.length; i++) if (song.tracks[i].on) sel.push(i);
        if (!sel.length) { say('至少勾选一条音轨'); return; }

        var cut2 = midiSliceOpt(song, sel);           // 直读的起音/止音 → 毫秒窗口
        var tlOpt = { trackIdx: sel };
        if (cut2) { tlOpt.startBeat = cut2.cutA; tlOpt.endBeat = cut2.cutB; }
        var tl;
        try { tl = buildTimeline(song, tlOpt); }
        catch (e) { this.setStat('构建时间轴失败: ' + e); return; }
        if (!tl.chords.length) { this.setStat('这一段没有音符：' + (tl.notes[0] || '')); say('没有音符可播放'); return; }

        // 暂停续播：上次中途停在这首歌里 → 从大概那里接着播（内存缓存，
        // 切歌/重建曲库/退出脚本即失效；自然播完也会清掉）。曲子只剩结尾
        // 一点点时就不续了，等于从头。
        tl.wantResume = true;
        tl.resumeKey = resumeKeyOf(song);
        var resumeMs = progressTake(song);
        var resumed = resumeMs > 800 && resumeMs < tl.chords[tl.chords.length - 1].ms;
        if (resumed) tl.resumeMs = resumeMs;

        var self = this;
        var msg = '▶ ' + song.name + ' · ' + sel.length + '轨 · ' + tl.count + '键 · ' + (tl.totalMs / 1000).toFixed(0) + 's' +
            (resumed ? ' · 从 ' + (resumeMs / 1000).toFixed(1) + 's 继续' : '');
        this.setStat(msg);
        say(msg);
        if (tl.notes.length) logd('提示: ' + tl.notes.join(' | '));

        Player.play(tl, {
            tick: function () {},
            stop: function (finished) {
                self.setStat(finished ? '✓ 播放完成' : '■ 已停止');
                self.refresh(true);
            }
        });
        this._t0 = Date.now();
        this._tickLabel = song.name + ' · ' + sel.map(function (i) { return song.tracks[i].name; }).join('+');
        this.refresh(true);

        // 收面板，别挡住琴键。留 hideDelayMs 让 toast 先看清楚。
        // 能执行到这里说明上面的失败分支都没中（曲目为空 / 没勾音轨 / 这段没音符
        // 都已经 return 了），所以不用再回头查 Player.running —— 查了反倒会漏掉
        // 极短的曲子（放完时 running 已经 false，面板就赖着不收了）。
        if (CONFIG.autoHideOnPlay && this.expanded) {
            setTimeout(function () { self.hidePanel(); }, CONFIG.hideDelayMs || 0);
        }
    },

    /**
     * 停止 = 暂停。没播完就停的话，续播位置会记进内存缓存（见 Player 线程
     * 退出处的记账），下次 ▶ 这首歌从大概停下的地方接着播；自然播完则清掉。
     * @param {boolean} saveResume 传 false = 这次不记（切歌时用）
     */
    doStop: function (saveResume) {
        if (CONFIG.pcMode) { this.pcStop(); return; }
        Player.stop(saveResume !== false);
        this.setStat('■ 已停止');
        this.refresh(true);
    },

    /**
     * 切上一曲(-1) / 下一曲(+1) 并【马上播放】（音量↑ / 音量↓）。
     * 只在正在播放时有效（bindKeys 已挡掉非播放状态），循环到头尾时绕回。
     * 解析失败的占位曲目（✗ 开头）会被跳过。
     */
    stepSong: function (d) {
        if (!Player.running || !LIBRARY.length) return;
        var n = LIBRARY.length, tries = 0;
        // 切歌【不清】续播缓存（2026-10-27 用户改的需求）：只是换一首播，
        // 切回原曲还能从暂停处继续；真清缓存要等"播放了别的音乐"（单槽
        // 被新歌的暂停位置覆盖）或自然播完/退出脚本。
        this.sel = ((this.sel + d) % n + n) % n;
        while (LIBRARY[this.sel] && LIBRARY[this.sel].broken && tries++ < n) {
            this.sel = ((this.sel + d) % n + n) % n;
        }
        rememberSel();                         // 音量键切的歌也记住，重扫后停在这首
        this.songPage = Math.floor(this.sel / Math.max(1, this._perSong));
        this.refresh(true);
        this.doStop(false);          // doPlay 里"正在播就先停"的分支会直接 return，这里先停掉（不记续播）
        this.doPlay();
    },

    /* ---------------- 标定 / 测试 ---------------- */

    /** 「乐器」按钮上的文字。 */
    instText: function () {
        return CONFIG.instrument === 'lute7' ? '乐器:7键琴' : '乐器:15键钢琴';
    },

    /** 「演奏:」按钮上的文字。 */
    srcText: function () {
        return CONFIG.playSource === 'midi' ? '演奏:MIDI直读' : '演奏:曲谱';
    },

    /** 「长按:」按钮上的文字。 */
    pressText: function () {
        return CONFIG.pressByDuration ? '长按:分档' : '长按:固定' + CONFIG.tapDuration + 'ms';
    },

    /**
     * ⚙设置 →「演奏:」：曲谱(.txt) ⇄ MIDI 直读(.mid)。
     * · 曲谱模式：曲库 = songs/ 里的 .txt/.json（可编辑、可裁起止拍、BPM 可调）；
     * · MIDI 直读：曲库 = 当前乐器文件夹里扫到的 .mid（播放时直接按 MIDI
     *   原始毫秒时序点击，节奏/延音不经简谱量化，最忠实原曲）。
     * 切换即整库换掉；两种模式记住各自的选择（sel 存在 LIBRARY 重建时丢失，
     * 切回会回到第 0 首——目录是按文件名排序的，位置不变）。
     */
    switchPlaySource: function () {
        if (Player.running) this.doStop();
        CONFIG.playSource = (CONFIG.playSource === 'midi') ? 'txt' : 'midi';
        saveCalibration();
        this.trkPage = 0;
        // 曲库重建：按这个模式上次缓存的位置还原选中（没缓存过=第 0 首）
        rebuildLibrary();
        if (this.panel.srcBtn) this.panel.srcBtn.setText(this.srcText());
        if (this.panel.pcSrcBtn) this.panel.pcSrcBtn.setText(this.srcText());
        var msg = (CONFIG.playSource === 'midi')
            ? '演奏:MIDI直读 · 曲库 ' + LIBRARY.length + ' 个 .mid（节奏延音忠实原曲，调: 可换调）'
            : '演奏:曲谱(.txt) · 曲库 ' + LIBRARY.length + ' 首';
        this.setStat(msg);
        say(msg);
        this.refresh(true);
    },

    /** ⚙设置 →「长按:」：延音分档按压 ⇄ 固定短按。 */
    togglePressMode: function () {
        CONFIG.pressByDuration = !CONFIG.pressByDuration;
        this.panel.pressBtn.setText(this.pressText());
        this.setStat(CONFIG.pressByDuration
            ? '长按:分档 —— 按压时长随音符时长定档（' + CONFIG.pressTiers[0] + '~' +
              CONFIG.pressTiers[CONFIG.pressTiers.length - 1] + 'ms），延音有手感'
            : '长按:固定 —— 所有音统一按 ' + CONFIG.tapDuration + 'ms 点一下');
        say(CONFIG.pressByDuration ? '长按:分档（延音按得久）' : '长按:固定（全部短按）');
        this.refresh(true);
    },

    /** 设置抽屉里两段帮助文字（按当前乐器生成：目录提示 + 标定提示）。 */
    dirHelpText: function () {
        return (CONFIG.instrument === 'lute7'
            ? '当前乐器：7键琴 · 只弹 1~7，谱里其他音自动跳过；曲谱/批量导入只认 /sdcard/QipaHarp/（songs/ 放 .txt，midi/ 放 .mid），产出的 .txt 也只写进 QipaHarp/songs/。'
            : '当前乐器：15键钢琴 · 曲谱/批量导入只认 /sdcard/QipaPiano/（songs/ 放 .txt，midi/ 放 .mid，也扫手机「下载」），产出的 .txt 也只写进 QipaPiano/songs/。') +
            ' 两琴的曲库、MIDI、导出完全独立，切换乐器即切换曲库。' +
            ' 演奏:曲谱=读 songs/ 的 .txt（可编辑裁剪）；演奏:MIDI直读=直接按 .mid 原始时序播放（节奏延音最准，不能编辑，BPM 不可调，起音/止音可裁剪，调: 换调有效）。' +
            ' 曲库已有同名曲目时「导入MIDI」一律跳过不覆盖；想重转先删 songs/ 里的 .txt 再重扫。';
    },
    midiHelpText: function () {
        return '把 .mid 放进 ' + midiDirOf() + '（或 ' + songDirOf() +
               (CONFIG.instrument === 'lute7' ? '）' : '、手机「下载」') +
               '，点「🎼 导入MIDI」就转成简谱进曲库。转完看日志里的「原样弹对 XX%」，不够高就点「调:」换个主音(1=do)重转。标定：🎯两点(仅15键)/🔢全键只生效最后用的那种；两琴标定各自独立。';
    },

    /**
     * ⚙设置 →「乐器」：15键钢琴 ⇄ 7键琴。
     * · 两琴的曲库完全独立：切换后立刻重扫【自己】文件夹的 songs/，
     *   曲目列表整个换掉（15键琴那套曲谱不会出现在 7键琴模式下，反之亦然）。
     * · 标定数据各自独立保存，切换只是换用哪一套，不会清掉另一套。
     * · 切到 7键琴且从未标定过 → 立刻引导做一次 7 键全键标定（首次定位）。
     */
    switchInstrument: function () {
        var was7 = CONFIG.instrument === 'lute7';
        if (Player.running) this.doStop();          // 换乐器就别继续播了，键位完全不同
        CONFIG.instrument = was7 ? 'piano15' : 'lute7';
        saveCalibration();
        ensureDirs();                               // 新乐器的目录顺手建好
        this.panel.instBtn.setText(this.instText());
        this.trkPage = 0;
        // 曲库重建：按这个乐器上次缓存的位置还原选中（没缓存过=第 0 首）
        rebuildLibrary();
        var self = this;
        if (!was7) {
            if (calib7Ready()) {
                this.setStat('已切到 7键琴 · 曲库 ' + LIBRARY.length + ' 首（QipaHarp 文件夹）');
                say('已切到 7键琴：只弹 1~7，其他音自动跳过');
            } else {
                this.setStat('7键琴首次使用：请完成 7 键全键标定');
                say('已切到 7键琴，先做一次 7 键全键标定');
                this.refresh(true);
                this.startFullCalib();
                return;
            }
        } else {
            this.setStat('已切到 15键钢琴 · 曲库 ' + LIBRARY.length + ' 首（QipaPiano 文件夹）');
            say('已切到 15键钢琴');
        }
        this.refresh(true);
    },

    /** 「🔢 全键标定」：当前乐器逐键标定（15键琴 15 次，7键琴 7 次）。 */
    startFullCalib: function () {
        var n = (CONFIG.instrument === 'lute7') ? 7 : 15;
        this.hidePanel();
        this.setStat('全键标定中：红点拖到键中心 → 记录此键（共 ' + n + ' 键）');
        var self = this;
        FullCalib.start(n, function () { self.refresh(true); self.showPanel(); });
        say('第 1/' + n + ' 键：把红点拖到「1」键中心，点「记录此键」');
    },

    startCalib: function () {
        this.hidePanel();
        this.setStat('标定中：把红点拖到键中心后点「记录此点」');
        var self = this;
        Calib.start(function () { self.refresh(true); self.showPanel(); });
        say('第①步：把红点拖到左上角「1」键中心，点「记录此点」');
    },

    runTest: function () {
        if (Player.running) { this.doStop(); return; }
        if (!isLandscapeNow()) {                 // 和播放同规矩：竖屏不点屏幕
            this.setStat('竖屏不测试：进游戏横屏后再试');
            say('竖屏禁止测试（防误触）');
            return;
        }
        if (CONFIG.instrument === 'lute7' && !calib7Ready()) {
            this.setStat('7键琴还没标定：⚙设置 → 🔢 全键标定（7 键）');
            say('7键琴还没标定，先做一次全键标定');
            return;
        }
        var n = (CONFIG.instrument === 'lute7') ? 7 : 15;
        this.hidePanel();
        this.setStat((n === 7 ? '7键' : '全键') + '测试中');
        say('依次点亮 ' + n + ' 个键，确认每个都响');
        var self = this;
        testAllKeys(420, function () { self.refresh(true); self.showPanel(); });
    },

    /* ---------------- 曲库 ---------------- */

    reloadLibrary: function () {
        // rebuildLibrary 内部会：还原各曲缓存参数 + 按你上次选的曲名还原选中项
        // （目录里那首还在就回到它，不在了才退回第 0 首）
        rebuildLibrary();
        var what = CONFIG.playSource === 'midi' ? ' 个 .mid' : ' 首曲谱';
        this.setStat('已重载，共 ' + LIBRARY.length + what +
                     (LIBRARY[this.sel] ? ' · 停在「' + LIBRARY[this.sel].name + '」' : ''));
        say('已重载：' + LIBRARY.length + what);
        this.refresh(true);
    },

    /* ---------------- 键盘输入导入（不读剪贴板） ---------------- */

    /**
     * 进「⌨ 输入导入」页：和编辑谱一样换成紧凑矮面板并顶到屏幕最上面，
     * 输入法弹出来盖不到输入框；进页后自动呼出键盘，直接打简谱。
     * 打完点底栏「✓ 确认」（进曲库并设为当前曲目）或「📄 导出.txt」（写进曲谱目录）。
     */
    openImport: function () {
        var self = this;
        this.importMode = true;
        this._hideIme();
        // 预填 @name / @bpm 模板：歌名自己填在 @name 后面，曲速默认 60
        if (!this._impText || !this._impText.trim()) this._impText = '@name \n@bpm 60\n\n';
        if (this.panelPos && this._menuPanelY == null) {
            this._menuPanelY = this.panelPos.y;  // 退出导入页时还原
            this.panelPos.y = 0;                 // 导入页置顶，把下半屏留给输入法
        }
        this.expanded = true;
        this.relayout(function () {
            // 回调跑在重建线程上，碰控件必须回 UI 线程
            uiRun(function () {
                self._writeImpDraft(self._impText);
                // 光标放到 "@name " 后面，进去直接打歌名
                try {
                    var et = self.panel.impText;
                    et.setSelection(Math.min(6, String(et.getText()).length));
                } catch (e) {}
                self.setStat('填好歌名和谱子后点「✓确认」或「📄导出.txt」');
                self._showIme('impText');        // 直接弹键盘，省一次点击
            });
        });
    },

    /** 把面板切成「输入导入页」。必须在 UI 线程上调（全是 setVisibility）。 */
    _renderImport: function () {
        var P = this.panel;
        if (!P) return;
        var GONE = android.view.View.GONE, VIS = android.view.View.VISIBLE;
        try {
            P.impv.setVisibility(VIS);                   // 先亮
            P.footerImp.setVisibility(VIS);
            P.menu.setVisibility(GONE);                  // 后灭
            P.footerPlay.setVisibility(GONE);
            P.editv.setVisibility(GONE);
            P.footerEdit.setVisibility(GONE);
        } catch (e) { logd('切换输入导入页可见性失败: ' + e); }
    },

    /** 退导入页：收键盘放焦点 → 换回菜单面板 → 回到原来的位置。 */
    closeImport: function (statMsg) {
        var self = this;
        this._hideIme();
        this.importMode = false;
        uiRun(function () {
            try {
                self.panel.menu.setVisibility(android.view.View.VISIBLE);
                self.panel.footerPlay.setVisibility(android.view.View.VISIBLE);
                self.panel.impv.setVisibility(android.view.View.GONE);
                self.panel.footerImp.setVisibility(android.view.View.GONE);
            } catch (e) { logd('退出导入页切换可见性失败: ' + e); }
            self.refresh(true);
        });
        if (this.panelPos && this._menuPanelY != null) {
            this.panelPos.y = this._menuPanelY;
            this._menuPanelY = null;
        }
        this.expanded = true;
        this.relayout(function () { if (statMsg) self.setStat(statMsg); });
    },

    /** 导入页的红色提示行（不退页，改完再点一次按钮就行）。 */
    _impErr: function (msg) {
        var self = this;
        uiRun(function () { try { self.panel.impErr.setText('⚠ ' + msg); } catch (e) {} });
    },

    /** 读导入页输入框里的谱子（先收键盘，把输入法没上屏的拼音提交掉）。 */
    _readImportText: function () {
        this._hideIme();
        var t = '';
        try { t = String(this.panel.impText.getText()) || ''; } catch (e) {}
        this._impText = t;
        return t;
    },

    /** 把输入框里的文本解析成一首歌；解析不了返回 null 并把原因写到提示行。 */
    _parseImportText: function (t) {
        var s = null;
        try {
            var head = t.charAt(0);
            s = (head === '{' || head === '[')
                  ? coerceSong(t, '输入谱 ' + (LIBRARY.length + 1))
                  : parseTxtSong(t, '输入谱 ' + (LIBRARY.length + 1));
        } catch (e) {
            this._impErr('解析失败：' + (e && e.message ? e.message : e));
            return null;
        }
        if (!s.tracks.length || !s.tracks.some(function (k) { return k.events && k.events.length; })) {
            this._impErr('解析不出音符，检查记号（1~7、0、-、_、[1 3 5]）');
            return null;
        }
        return s;
    },

    /**
     * 「✓ 确认」：把输入的谱子加进曲库并设为【当前曲目】。
     * 之后 ▶开始 / 悬浮球 / 音量键默认播放的就是这份输入内容，
     * 直到你在曲目列表里另选一首为止。
     */
    confirmImport: function () {
        var t = this._readImportText().trim();
        if (!t) { this._impErr('谱子是空的，先输入简谱'); return; }
        var s = this._parseImportText(t);
        if (!s) return;
        s.source = 'input';
        LIBRARY.push(s);
        this.sel = LIBRARY.length - 1;                       // 设为当前曲目
        rememberSel();
        var per = Math.min(this.L ? this.L.songRows : 7, MAX_SONG_ROWS);
        this.songPage = Math.floor(this.sel / Math.max(1, per));   // 翻到新曲所在页
        this.closeImport('已导入「' + s.name + '」并设为当前曲目 · 点▶开始播放');
        this._impText = '';                    // 下次打开重新预填模板
        say('导入成功：' + s.name + '（现在默认播放这首，直到你在曲目里选别的）');
    },

    /** 「📄 导出.txt」：把输入的谱子写成 .txt 存进曲谱目录。 */
    exportImport: function () {
        var t = this._readImportText().trim();
        if (!t) { this._impErr('谱子是空的，先输入简谱'); return; }
        var s = this._parseImportText(t);
        if (!s) return;
        var p = exportSongFile(s);
        if (!p) { this._impErr('导出失败，看 AutoX.js 日志'); return; }
        this.closeImport('已导出 ' + p);
        this._impText = '';                    // 下次打开重新预填模板
        say('已导出到 ' + p + '，点「↺ 重扫目录」可载入曲库');
    },

    /* ---------------- MIDI 导入 ---------------- */

    /**
     * 「🎼 导入MIDI」：扫目录里的 .mid，逐个转成简谱进曲库。
     * 全程不用电脑、不用 Termux，也不弹任何新窗口（新窗口在这脚本里踩过太多坑）。
     *
     * ⚠ 转谱是纯计算，放在【另一个线程】里跑：点击回调跑在 UI 线程上，
     *   在那儿转一首几百个音的曲子会把面板冻住几百毫秒到几秒。
     *   这个线程里只碰数据和 logd，改控件一律走 self.setStat / self.refresh（内部 uiRun）。
     *
     * 重复点的处理：【曲库里已有同名曲目就一律跳过，绝不覆盖】——
     *   不管它是上次转的、还是你从 .txt 改过的，你在面板里调好的
     *   起拍/止拍、编辑过的谱子全都保留。
     *   想重转某一首：先在文件管理器里删掉 songs/同名.txt，点「↺ 重扫目录」，
     *   再点「🎼 导入MIDI」。
     */
    importMidi: function () {
        if (this._midiBusy) { say('还在转，等它跑完'); return; }
        if (CONFIG.playSource === 'midi') {
            say('MIDI 直读模式不需要转换；要转成 .txt 曲谱请先切回「演奏:曲谱」');
            this.setStat('请先切回「演奏:曲谱」再导入MIDI');
            return;
        }
        var self = this;
        this._midiBusy = true;
        this.setStat('🎼 正在扫描 .mid 文件…');

        threads.start(function () {
            var added = 0, skipped = 0, failed = 0;
            var firstNew = -1;
            try {
                ensureDirs();
                var list = scanMidiFiles();
                if (!list.length) {
                    self.setStat('没找到 .mid。放进 ' + midiDirOf() + ' 或 ' + songDirOf() +
                                 (CONFIG.instrument === 'lute7' ? ' 再点一次（7键琴只认 QipaHarp 里的文件）'
                                                                : ' 或手机「下载」，再点一次'));
                    say('没找到 .mid 文件');
                    return;
                }
                logd('—— 🎼 MIDI 导入：找到 ' + list.length + ' 个文件 ——');
                self.setStat('🎼 找到 ' + list.length + ' 个 .mid，转谱中…');

                for (var i = 0; i < list.length; i++) {
                    var base = list[i].base;
                    var old = -1;
                    for (var j = 0; j < LIBRARY.length; j++) if (LIBRARY[j].name === base) { old = j; break; }
                    if (old >= 0) {
                        // 曲库已有同名曲目：跳过，不覆盖（起止拍 / 编辑过的谱全部保留）
                        skipped++;
                        logd('· ' + base + '：曲库已有同名曲目，跳过不覆盖。想重转：删掉 songs/' +
                             base + '.txt →「↺重扫目录」→ 再点导入');
                        continue;
                    }
                    try {
                        var r = midiToSong(list[i].path, {});
                        logd('【' + base + '】');
                        for (var q = 0; q < r.report.length; q++) logd('  ' + r.report[q]);
                        LIBRARY.push(r.song);
                        added++;
                        if (firstNew < 0) firstNew = LIBRARY.length - 1;
                    } catch (e) {
                        failed++;
                        logd('· ' + base + ' 转换失败: ' + (e && e.message ? e.message : e));
                    }
                }

                var msg = '🎼 导入完成：新增 ' + added + ' 首' +
                          (skipped ? '，跳过 ' + skipped + ' 首（曲库已有，不覆盖）' : '') +
                          (failed ? '，失败 ' + failed + ' 首' : '') +
                          ' · 共 ' + LIBRARY.length + ' 首';
                if (added === 0) {
                    msg = skipped ? '🎼 ' + skipped + ' 首曲库里已有，全部保留未覆盖。想重转：删掉 songs/ 里对应的 .txt 后重扫再导'
                                  : '🎼 没有找到可导入的 .mid';
                }
                // 选中新导入的第一首，并翻到它所在页
                if (firstNew >= 0) {
                    self.sel = firstNew;
                    rememberSel();
                    self.songPage = Math.floor(firstNew / Math.max(1, self._perSong));
                }
                self.setStat(msg);
                say(msg);
                self.refresh(true);
            } catch (e) {
                logd('MIDI 导入出错: ' + (e && e.stack ? e.stack : e));
                self.setStat('🎼 导入出错：' + (e && e.message ? e.message : e));
                say('MIDI 导入出错，日志里有详情');
            } finally {
                self._midiBusy = false;
            }
        });
    },

    /* ---------------- MIDI 直读：转化选中 .mid ---------------- */

    /**
     * 「📄 转化选中MIDI」（演奏:MIDI直读 模式下的导出键）：
     * 把当前选中的 .mid 按【各轨当前用的调】转成 .txt 写进 songs/。
     * 每条轨的调 = 面板「轨N调:」按钮当前选的（auto = 该轨自动挑的最优调）。
     * 文件名和歌名后缀标注各轨调性，如「爱人错过（G#，C#，F#）.txt」，
     * 三个音轨就是三个、两个就是两个 —— 一眼能看出是按哪套调转的。
     */
    exportMidiDirect: function () {
        var s = LIBRARY[this.sel];
        if (!s || !s.isMidiFile) { say('先在列表里选中一个 .mid'); return; }
        if (s.broken) { say('这个 .mid 解析失败，转不了'); return; }
        var self = this;
        this.setStat('📄 正在按各轨调性转化 ' + s.name + '…');

        threads.start(function () {
            try {
                ensureMidiParsed(s);
                var tonics = [], labels = [];
                for (var i = 0; i < s.tracks.length; i++) {
                    var t = (s._tonics && s._tonics[i]) ? s._tonics[i] : null;
                    var pitch = t ? t.tonic : 60;
                    tonics.push(pitch);
                    labels.push(PITCH_NAMES[pitch % 12]);
                }
                if (!tonics.length) throw new Error('这首没有可转化的音轨');
                var suffix = '（' + labels.join('，') + '）';
                var r = midiToSong(s.path, { name: s.name + suffix, trackTonics: tonics });
                logd('【转化 ' + s.name + ' → ' + labels.join('，') + '】');
                for (var q = 0; q < r.report.length; q++) logd('  ' + r.report[q]);
                var msg = r.path
                    ? '📄 已转化 → ' + r.path + '（切到「演奏:曲谱」重扫即可载入）'
                    : '📄 转化完成，但写文件失败（看日志）';
                self.setStat(msg);
                say(r.path ? '已转化：' + s.name + suffix : '转化完成但写文件失败');
            } catch (e) {
                logd('转化失败: ' + (e && e.stack ? e.stack : e));
                self.setStat('📄 转化失败：' + (e && e.message ? e.message : e));
                say('转化失败，日志里有详情');
            }
        });
    },

    /* ---------------- 谱子编辑器 ---------------- */

    /**
     * 进编辑页。
     * 除了切换可见性，还要整窗重建成那套【紧凑矮面板】并把面板顶到屏幕最上面：
     * 横屏游戏屏幕只有 ~370dp 高，输入法一弹就吃掉下半屏 100 多 dp，
     * 菜单那套满屏高的面板怎么摆都会被键盘盖住谱框，打不了字。
     * computeLayout() 会根据 editMode 自己换成矮布局，所以这里只管置状态 + 重排。
     */
    openEditor: function () {
        var song = LIBRARY[this.sel];
        if (!song) { say('曲库为空'); return; }
        if (this.editIdx >= song.tracks.length) this.editIdx = 0;
        var self = this;
        this.editMode = true;
        this._editFilled = {};                 // 记录哪些输入框已经填过原谱
        this._hideIme();
        if (this.panelPos && this._menuPanelY == null) {
            this._menuPanelY = this.panelPos.y;  // 退出编辑页时还原
            this.panelPos.y = 0;                 // 编辑页置顶，把下半屏留给输入法
        }
        this.expanded = true;
        this.relayout(function () {
            self.setStat('点谱框可呼出键盘 · 键盘挡住按钮就先按返回收起');
        });
    },

    /**
     * 把面板切成「编辑页」并填好当前这一轨。
     * 必须在 UI 线程上调（见 _rebuildSync 的注释）：这里全是
     * setVisibility，非 UI 线程会抛 CalledFromWrongThreadException。
     *
     * 可见性的顺序刻意是【先亮新的、再灭旧的】：万一中间某一步抛了，
     * 屏幕上至少还有内容，不会像以前那样 menu 已 GONE、editv 还没 VISIBLE，
     * 变成一块什么都没有的空面板。异常也不再吞掉，统一打日志。
     */
    _renderEditor: function () {
        var song = LIBRARY[this.sel];
        var P = this.panel;
        if (!P) return;
        var GONE = android.view.View.GONE, VIS = android.view.View.VISIBLE;

        if (!song || !song.tracks.length) {          // 没得编辑，退回菜单，别留个空面板
            try {
                P.editv.setVisibility(GONE);
                P.footerEdit.setVisibility(GONE);
                P.menu.setVisibility(VIS);
                P.footerPlay.setVisibility(VIS);
            } catch (e2) { logd('切换回菜单失败: ' + e2); }
            this.setStat('这首曲子没有可编辑的音轨');
            return;
        }

        var n = song.tracks.length;
        if (this.editIdx < 0) this.editIdx = 0;
        if (this.editIdx > n - 1) this.editIdx = n - 1;

        try {
            P.editv.setVisibility(VIS);              // 先亮
            P.footerEdit.setVisibility(VIS);
            P.menu.setVisibility(GONE);              // 后灭
            P.footerPlay.setVisibility(GONE);
        } catch (e3) {
            logd('切换编辑页可见性失败（是不是在非 UI 线程上改控件？）: ' + e3);
        }
        try {
            var cur = song.tracks[this.editIdx] || null;
            var err = song.tracks.length > MAX_EDIT_ROWS
                ? '这首有 ' + n + ' 条轨，编辑器只显示前 ' + MAX_EDIT_ROWS + ' 条；更多请改文件' : '';
            // 当前这条轨自己的解析告警（解析时就抄下来了，不是全局那份残渣）
            if (cur && cur.warn && cur.warn.length) err = err ? err + '；' + cur.warn[0] : cur.warn[0];
            P.editErr.setText(err);
            P.editHead.setText('编辑：' + song.name + '   BPM ' + song.bpm + '  总' + Math.round(songTotalBeats(song)) + '拍');
            P.editPgN.setText((this.editIdx + 1) + '/' + n + '  ' + (cur ? cur.name : ''));
        } catch (e4) { logd('编辑页标题刷新失败: ' + e4); }

        for (var i = 0; i < MAX_EDIT_ROWS; i++) {
            var g = P['eg' + i];
            if (!g) continue;
            var tk = song.tracks[i];
            if (i !== this.editIdx || !tk) {
                try { g.setVisibility(GONE); } catch (e5) {}
                continue;
            }
            try {
                g.setVisibility(VIS);
                P['el' + i].setText('音轨：' + tk.name +
                    (tk.msMode ? '（结构化数据，转成简谱后可编辑）' : '') +
                    '  ' + (tk.events ? tk.events.length : 0) + ' 音');
                // 只在「这条轨第一次被翻到」时填充；来回翻页要保留没保存的修改
                if (!this._editFilled[i]) {
                    P['en' + i].setText(tk.srcNotes || '');
                    this._editFilled[i] = 1;
                }
            } catch (e7) { logd('填充音轨 ' + i + ' 失败: ' + e7); }
        }
    },

    stepEditor: function (d) {
        var song = LIBRARY[this.sel];
        if (!song) return;
        var n = Math.min(song.tracks.length, MAX_EDIT_ROWS);
        if (n <= 1) return;
        // 焦点还挂在上一页那个已经 GONE 的谱框上，先收掉；
        // 换到新的一轨之后点一下新谱框就会重新弹键盘。
        this._hideIme();
        this.editIdx = (this.editIdx + d + n) % n;
        var self = this;
        uiRun(function () { self._renderEditor(); });
    },

    /** 退编辑页：收键盘放焦点 → 换回菜单那套满屏面板 → 回到原来的位置。 */
    closeEditor: function (statMsg) {
        var self = this;
        this._hideIme();
        this.editMode = false;
        this._editFilled = {};
        // 先在【现有的】面板上把两块内容换回来：万一整窗重建失败，
        // 回滚之后至少还留下一个能用的菜单面板。
        // 顺序同样是「先亮 menu，再灭 editv」，见 _renderEditor 的注释。
        uiRun(function () {
            try {
                self.panel.menu.setVisibility(android.view.View.VISIBLE);
                self.panel.footerPlay.setVisibility(android.view.View.VISIBLE);
                self.panel.editv.setVisibility(android.view.View.GONE);
                self.panel.footerEdit.setVisibility(android.view.View.GONE);
                self.panel.impv.setVisibility(android.view.View.GONE);
                self.panel.footerImp.setVisibility(android.view.View.GONE);
            } catch (e) { logd('退出编辑页切换可见性失败: ' + e); }
            self.refresh(true);
        });
        if (this.panelPos && this._menuPanelY != null) {
            this.panelPos.y = this._menuPanelY;
            this._menuPanelY = null;
        }
        this.expanded = true;
        this.relayout(function () { if (statMsg) self.setStat(statMsg); });
    },

    saveEditor: function () {
        var song = LIBRARY[this.sel];
        if (!song) return;
        var self = this, errs = [], changed = 0;
        var lim = Math.min(MAX_EDIT_ROWS, song.tracks.length);

        // 先把键盘收掉再读文本：中文输入法还有「未上屏」的拼音在 composing
        // 区里，不先提交就把那串拼音当谱子存进去了。（这里跑在 UI 线程上，
        // _hideIme 的 uiRun 是同步执行的，所以往下读到的已经是干净文本。）
        this._hideIme();

        for (var i = 0; i < lim; i++) {
            // 【关键】只处理"这一页真的被翻到过"的音轨。
            // 没翻到的那几轨，输入框是空的（eg{i} 还是 GONE），
            // 老代码会把空串当成"用户把谱子删空了"直接 coerceTrack('') 存回去，
            // 于是【第一次保存就把没看过的音轨整条清空】——
            // 之后再打开编辑器自然"什么也没有"，而且谱子是真的没了。
            if (!this._editFilled[i]) continue;

            var txt = '';
            try { txt = String(this.panel['en' + i].getText()) || ''; } catch (e) { continue; }
            var old = song.tracks[i].srcNotes || '';
            if (txt === old) continue;                     // 这条没改过
            var t2 = coerceTrack(txt, song.tracks[i].name);
            if (!t2.events.length && txt.trim()) errs.push('音轨「' + song.tracks[i].name + '」解析出 0 个音符');
            t2.on = song.tracks[i].on;
            song.tracks[i] = t2;
            changed++;
        }
        if (song.source === 'builtin') song.source = 'builtin(edited)';
        snapshotSong(song);                    // 编辑保存的参数也进缓存

        if (errs.length) {
            uiRun(function () { self.panel.editErr.setText('⚠ ' + errs.join('；')); });
            return;
        }
        say(changed ? '已保存' : '没有改动');
        // closeEditor() 会整窗重排回菜单面板，状态行是新窗口里的，
        // 所以这次的提示要交给重建完成后的回调去写，不能直接 setStat。
        this.closeEditor(changed ? '已保存 ' + changed + ' 条音轨的修改' : '没有改动');
    }
};

/** 当前选中曲目。 */
function cur() { return LIBRARY[UI.sel] || null; }

/* ==========================================================================
 *  12. 主入口
 * ========================================================================== */

/** 优雅退出：关窗口、停播放。只停自己，不影响用户在跑的其他脚本。 */
function shutdown(reason) {
    try { Player.stop(); } catch (e) {}
    try { flashClose(); } catch (e) {}
    try { if (Calib.active) Calib.close(); } catch (e) {}
    try { if (UI.panel) UI.panel.close(); } catch (e) {}
    try { if (UI.ball) UI.ball.close(); } catch (e) {}
    logd('脚本退出: ' + (reason || ''));
    try {
        var me = engines.myEngine();
        if (me && me.forceStop) me.forceStop();
        else engines.stopAll();
    } catch (e) { try { engines.stopAll(); } catch (e2) {} }
}

var _lastVolAct = 0;       // 音量键切歌防抖：短时间内的重复事件（长按调音量的 keyrepeat）只算一次

/**
 * 音量键控制（只在【正在播放】时有效；暂停/停止时按键无动作）：
 *   音量↑ = 实时切到【上一曲】并马上开始播放
 *   音量↓ = 实时切到【下一曲】并马上开始播放
 *   切换范围是当前乐器文件夹里识别到的曲目（15键琴 QipaPiano/，7键琴 QipaHarp/）。
 *
 * ⚠ 长按音量键调游戏音量时，系统会对同一次按住连发一串 keydown（repeatCount>0），
 *   以前每发一次就切一首，看起来像"面板自己疯狂换曲"。现在：
 *   ① 忽略所有 repeat 事件；② 400ms 防抖 —— 按住调音量最多只切一次。
 *
 * 选中曲目【只】会因这几种操作改变：点曲目行 / 音量键切歌（播放中）/
 * 输入导入确认 / 重扫·切模式·切乐器后按【缓存】还原你上次选的那首。
 * 除此之外永远不会自己切换。
 *
 * 之前的「连按两次退出脚本」已删除 —— 退出请用 ⚙设置 →「⏏ 退出脚本」。
 * 悬浮球手势不变：单击 = 播放/停止，长按 = 开关面板，拖动 = 挪位置。
 */
function bindKeys() {
    try {
        events.observeKey();

        function volStep(d) {
            var now = Date.now();
            if (now - _lastVolAct < 400) return;    // 防抖：长按连发的事件只算第一次
            if (UI.ballHeld || now < (UI._ballGuardUntil || 0)) return;
            // ↑ 手正按着悬浮球（或刚抬起 400ms 内）：此时的音量键几乎一定是握持
            //   误触 —— 长按悬浮球的 480ms 里还在播放，蹭一下音量键就切一首歌
            //   还会立刻开始播（历史 bug："长按呼出面板时选歌往后跳两三首"）。
            _lastVolAct = now;
            if (!Player.running) return;            // 不在播放时按键失效
            UI.stepSong(d);
        }

        events.onKeyDown('volume_up', function (keyCode, e) {
            try { if (e && e.getRepeatCount && e.getRepeatCount() > 0) return; } catch (er) {}
            volStep(-1);
        });

        events.onKeyDown('volume_down', function (keyCode, e) {
            try { if (e && e.getRepeatCount && e.getRepeatCount() > 0) return; } catch (er) {}
            volStep(1);
        });
        return true;
    } catch (e) {
        logd('按键监听不可用（' + e + '），请用悬浮球/面板按钮控制');
        return false;
    }
}

(function main() {
    // 1) 无障碍服务（点击的根基）
    try {
        if (!auto.service) {
            say('请先开启 AutoX.js 的无障碍服务');
            auto.waitFor();
        }
    } catch (e) {
        say('⚠ 无障碍服务未开启，点击可能无效');
    }

    // 2) 载入上次的标定 / 偏好
    loadCalibration();

    // 3) 建曲谱目录（第一次运行会生成 README.txt 模板）
    ensureDirs();

    // 4) 组装曲库：按演奏模式（曲谱 .txt / MIDI 直读 .mid），都只认当前乐器的文件夹
    rebuildLibrary();
    logd('曲库就绪：' + (CONFIG.instrument === 'lute7' ? '7键琴' : '15键钢琴') +
         (CONFIG.playSource === 'midi' ? ' · MIDI直读' : '') + ' · ' + songDirOf() + ' · 共 ' + LIBRARY.length + ' 首');

    // 5) 悬浮窗
    try {
        UI.init();
    } catch (e) {
        say('悬浮窗创建失败：' + e + '\n请到系统设置里给 AutoX.js 开启「显示在其他应用上层」权限');
        throw e;
    }

    // 6) 音量键快捷键
    bindKeys();

    // 7) 心跳：① 转屏检测（竖屏 <-> 进游戏横屏）② 播放进度刷新
    //    面板宽度在第一次排版时就冻结成了竖屏那一份，所以转屏【不重排】：
    //    这里整窗重建一次只是为了把窗口在新方向下重新落位（fitToScreen 夹回屏内），
    //    面板闪一下就回来了，没有旋转动画，控件的尺寸和排法和转屏前完全一样。
    setInterval(function () {
        try {
            // 播放中转回竖屏（退出游戏了）→ 立刻停手，别让点击落到别的应用上
            if (Player.running && !isLandscapeNow()) {
                UI.doStop();
                say('已转竖屏，自动停止播放（防误触其他应用）');
            }
            var s = screenSize();
            if (UI.L && (s.w !== UI._lastW || s.h !== UI._lastH)) {
                var oldW = UI._lastW, oldH = UI._lastH;
                UI._lastW = s.w; UI._lastH = s.h;
                logd('屏幕方向变化 ' + oldW + '×' + oldH + ' → ' + s.w + '×' + s.h +
                     '，面板 ' + UI.L.PW + 'dp 宽不重排，只重新落位');
                UI.relayout(function () {
                    UI.setStat('已就位 · 面板 ' + UI.L.PW + '×' + UI.L.PH + 'dp（转屏不重排）');
                });
                return;
            }
            if (Player.running) UI.refresh();
        } catch (e) {}
    }, 250);

    // 8) 保活：没有这一行脚本主体跑完就退出了，悬浮窗会跟着消失
    setInterval(function () {}, 5000);

    // 9) 退出清理
    events.on('exit', function () {
        try { Player.stop(); flashClose(); } catch (e) {}
    });

    setTimeout(function () {
        // 屏幕尺寸现取：上面这 600ms 里方向可能已经变过（缓存 400ms 会自动刷新）
        var sz = screenSize();
        say('🎹 就绪 · 屏幕 ' + sz.w + '×' + sz.h + ' · 曲库 ' + LIBRARY.length + ' 首\n' +
            (isLandscapeNow() ? '现在是横屏（游戏里），面板已就位\n'
                              : '现在是竖屏，进游戏转横屏后面板保持同样大小、不重排\n') +
            '乐器：' + (CONFIG.instrument === 'lute7' ? '7键琴' : '15键钢琴') +
            ' · 演奏：' + (CONFIG.playSource === 'midi' ? 'MIDI直读' : '曲谱') + ' · ' + calibStatusText() + '\n' +
            '音量↑/↓：播放中切上一曲/下一曲；悬浮球长按开关面板');
        UI.setStat('就绪 · ' + LIBRARY.length + ' 首曲 · 面板 ' +
                   (UI.L ? UI.L.PW + '×' + UI.L.PH + 'dp（转屏不重排）' : '?'));
    }, 600);

    logd('—— 奇葩战斗家钢琴脚本已启动 ——');
    logd('提示：首次使用建议先播放「◆ 全键测试」，逐个听 15 个键是否都按对位置。');
    logd('      若某个键按偏，打开面板 → ⚙设置 → 偏移X/偏移Y 微调，或直接用「🎯 标定」。');
})();
