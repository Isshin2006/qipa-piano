package com.qipa;

import android.content.Context;
import android.os.SystemClock;
import android.view.InputEvent;
import android.view.MotionEvent;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 奇葩钢琴 · 手机端多指注入器（无需 root）
 *
 * 原理：adb shell 以 shell uid 运行（app_process），shell uid 自带
 * INJECT_EVENTS 权限（`input` 命令、scrcpy 都依赖它）。本进程从 stdin
 * 逐行读取事件并用 InputManager.injectInputEvent 注入【聚合了全部活跃
 * 手指】的 MotionEvent —— 这是 scrcpy 刻意不做的多指能力。
 *
 * 协议（每行一条，PC 端负责按时间表喂）：
 *   D <pid> <x> <y>   按下手指 pid
 *   U <pid> <x> <y>   抬起手指 pid
 *   Q                 退出
 * 输出：每个事件打一个点，出错打 !行。PC 端据此确认。
 *
 * 编译：见 build_kit.js（ECJ 编译 + r8 转 dex + 打包成可被 app_process 加载的 jar）。
 * 运行：adb shell "CLASSPATH=/data/local/tmp/qipa_injector.jar app_process / com.qipa.Injector"
 */
public class Injector {

    private static class P {
        int id; float x, y;
        P(int id, float x, float y) { this.id = id; this.x = x; this.y = y; }
    }

    private final List<P> active = new ArrayList<P>();
    private long downTime = 0;

    private Object inputManager;
    private Method inject2;   // (MotionEvent, int) —— 老签名
    private Method inject3;   // (MotionEvent, int, int) —— 带 displayId 的新签名

    private void initInjection() throws Exception {
        /* API 34 适配:injectInputEvent 已不在 InputManager 类上,改走
           ServiceManager 取 IInputManager 绑定代理(scrcpy 同款路径) */
        try {
            Class<?> sm = Class.forName("android.os.ServiceManager");
            Method getSvc = sm.getDeclaredMethod("getService", String.class);
            getSvc.setAccessible(true);
            Object iim = getSvc.invoke(null, "input");
            if (iim != null) {
                try {
                    Class<?> ib = Class.forName("android.os.IBinder");
                    Class<?> stub = Class.forName("android.hardware.input.IInputManager$Stub");
                    Method asI = stub.getDeclaredMethod("asInterface", ib);
                    asI.setAccessible(true);
                    Object proxy = asI.invoke(null, iim);
                    try {
                        Method inject = proxy.getClass().getMethod("injectInputEvent", InputEvent.class, int.class);
                        inject2 = inject; inputManager = proxy;
                        System.out.println("!via:binder IInputManager(typed)");
                        return;
                    } catch (Throwable t2) { System.out.println("!b3:" + t2); }
                    try {
                        Method inject = proxy.getClass().getMethod("injectInputEvent", InputEvent.class, int.class);
                        inject2 = inject; inputManager = proxy;
                        System.out.println("!via:binder IInputManager(typed2)");
                        return;
                    } catch (Throwable t3) { System.out.println("!b2:" + t3); }
                    return;
                } catch (Throwable t) { System.out.println("!b3:" + t); }
                try {
                    Method inject = iim.getClass().getMethod("injectInputEvent", MotionEvent.class, int.class);
                    inject2 = inject; inputManager = iim;
                    System.out.println("!via:binder IInputManager(2)");
                    return;
                } catch (Throwable t) { System.out.println("!b2:" + t); }
            }
        } catch (Throwable t) { System.out.println("!sm:" + t); }
        Class<?> imClass = Class.forName("android.hardware.input.InputManager");
        Object ctx = null;
        try {
            Class<?> at = Class.forName("android.app.ActivityThread");
            Method cur = at.getDeclaredMethod("currentOrCreateApplication");
            cur.setAccessible(true);
            ctx = cur.invoke(null);
        } catch (Throwable t) { System.out.println("!ctx:" + t); }
        Object im = null;
        if (ctx != null) {
            try {
                Method gi2 = imClass.getDeclaredMethod("getInstance", Context.class);
                gi2.setAccessible(true);
                im = gi2.invoke(null, ctx);
            } catch (Throwable t) { System.out.println("!gi2:" + t); }
        }
        if (im == null) {
            try {
                Method gi = imClass.getDeclaredMethod("getInstance");
                gi.setAccessible(true);
                im = gi.invoke(null);
            } catch (Throwable t) { System.out.println("!gi:" + t); }
        }
        inputManager = im;
        try {
            inject2 = imClass.getMethod("injectInputEvent", MotionEvent.class, int.class);
        } catch (NoSuchMethodException e) {
            try { inject2 = imClass.getDeclaredMethod("injectInputEvent", MotionEvent.class, int.class); inject2.setAccessible(true); } catch (Throwable e2) { System.out.println("!e2:" + e2); }
        }
        try {
            inject3 = imClass.getMethod("injectInputEvent", MotionEvent.class, int.class, int.class);
        } catch (NoSuchMethodException e) {
            try { inject3 = imClass.getDeclaredMethod("injectInputEvent", MotionEvent.class, int.class, int.class); inject3.setAccessible(true); } catch (Throwable e3) { System.out.println("!e3:" + e3); }
        }
        if (inject2 == null && inject3 == null) throw new IllegalStateException("injectInputEvent 不可用");
    }

    private void inject(MotionEvent ev) throws Exception {
        if (inject3 != null) {
            inject3.invoke(inputManager, ev, 0, 0);   // mode=ASYNC, displayId=0
        } else {
            inject2.invoke(inputManager, ev, 0);
        }
    }

    private int action(int base, int pointerIndex) {
        // POINTER_DOWN/POINTER_UP 需要在 action 高位携带「哪个指针变了」的索引
        if (base == 5) return 5 | ((pointerIndex & 0xFF) << 8);        // ACTION_POINTER_DOWN
        if (base == 6) return 6 | ((pointerIndex & 0xFF) << 8);        // ACTION_POINTER_UP
        return base;
    }

    private MotionEvent build(int actionBase, int changedIndex) {
        long now = SystemClock.uptimeMillis();
        int n = active.size();
        int[] ids = new int[n];
        MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[n];
        for (int i = 0; i < n; i++) {
            P p = active.get(i);
            ids[i] = p.id;
            MotionEvent.PointerCoords c = new MotionEvent.PointerCoords();
            c.x = p.x; c.y = p.y; c.pressure = 1.0f; c.size = 1.0f;
            coords[i] = c;
        }
        // Android 8+ 的批量 obtain：metaState, xPrecision, yPrecision, deviceId,
        // edgeFlags, source=触摸屏(0x1002，游戏会校验来源), flags
        return MotionEvent.obtain(downTime, now, action(actionBase, changedIndex), n, ids, coords,
                0, 0, 0, 0, 0, 4098, 0);
    }

    private void down(int id, float x, float y) throws Exception {
        for (P p : active) {
            if (p.id == id) { p.x = x; p.y = y; inject(build(2, -1)); return; }  // 已按下 → 当 MOVE
        }
        if (active.isEmpty()) downTime = SystemClock.uptimeMillis();
        active.add(new P(id, x, y));
        inject(build(active.size() == 1 ? 0 : 5, active.size() - 1));
    }

    private void up(int id, float x, float y) throws Exception {
        int idx = -1;
        for (int i = 0; i < active.size(); i++) if (active.get(i).id == id) { idx = i; break; }
        if (idx < 0) return;                                     // 没按下就抬起：忽略
        active.get(idx).x = x; active.get(idx).y = y;
        boolean last = active.size() == 1;
        inject(build(last ? 1 : 6, idx));
        active.remove(idx);
        if (active.isEmpty()) downTime = 0;
    }

    /** 抬起当前所有活跃手指(退出前必调)——否则被杀/断线后游戏侧琴键一直压着,老歌停不下来 */
    private void releaseAll() {
        for (int i = active.size() - 1; i >= 0; i--) {
            P p = active.get(i);
            try { up(p.id, p.x, p.y); } catch (Throwable t) { }
        }
        active.clear();
    }

    public static void main(String[] args) throws Exception {
        Injector inj = new Injector();
        try { final Injector finj = inj; Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() { public void run() { try { finj.releaseAll(); } catch (Throwable t) { } } })); } catch (Throwable t) { }
        try {
            inj.initInjection();
        } catch (Throwable t) {
            System.out.println("!init:" + t);
            Throwable cc = t.getCause();
            while (cc != null) { System.out.println("!cause:" + cc);
                for (StackTraceElement fr : cc.getStackTrace()) System.out.println("!frame:" + fr);
                cc = cc.getCause(); }
            return;
        }
        System.out.println("!v:releaseOnExit");
        System.out.println(".ready");
        System.out.flush();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in), 1 << 16);
        String line;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.length() == 0) continue;
            try {
                if (line.startsWith("D ") || line.startsWith("U ")) {
                    String[] p = line.split(" ");
                    int pid = Integer.parseInt(p[1]);
                    float x = Float.parseFloat(p[2]);
                    float y = Float.parseFloat(p[3]);
                    if (line.charAt(0) == 'D') inj.down(pid, x, y); else inj.up(pid, x, y);
                    System.out.print(".");
                } else if (line.startsWith("W ")) {
                    long ms = Long.parseLong(line.substring(2).trim());
                    if (ms > 0) SystemClock.sleep(ms);
                    System.out.print("o");
                } else if (line.startsWith("Q")) {
                    try { inj.releaseAll(); } catch (Throwable t) { }
                    System.out.println(".bye");
                    System.out.flush();
                    return;
                } else {
                    System.out.println("!bad:" + line);
                }
            } catch (Throwable t) {
                System.out.println("!err:" + t);
            }
            System.out.flush();
        }
        try { inj.releaseAll(); } catch (Throwable t) { }
        System.out.println(".eof-release");
        System.out.flush();
    }
}

