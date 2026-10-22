package com.personalai.pocketexecutor;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class ExecutorState {
    private ExecutorState() {}
    public static SharedPreferences prefs(Context c) { return c.getSharedPreferences("pocket_executor", Context.MODE_PRIVATE); }
    public static synchronized void log(Context c, String message) {
        String prefix = new SimpleDateFormat("HH:mm:ss", Locale.CHINA).format(new Date());
        String text = prefs(c).getString("events", "") + prefix + "  " + message + "\n";
        if (text.length() > 20000) text = text.substring(text.length() - 20000);
        prefs(c).edit().putString("events", text).apply();
        android.util.Log.i("PocketExecutor", message);
    }
    @SuppressWarnings("deprecation")
    public static String identity(Context c) {
        try {
            PackageManager pm = c.getPackageManager();
            PackageInfo info = pm.getPackageInfo(c.getPackageName(), Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES);
            Signature[] signatures = Build.VERSION.SDK_INT >= 28 ? info.signingInfo.getApkContentsSigners() : info.signatures;
            return "应用名称：随手待办测试器\n包名：" + c.getPackageName() + "\n应用签名 MD5：" + digest(signatures[0].toByteArray(), "MD5") + "\n证书 SHA-256：" + digest(signatures[0].toByteArray(), "SHA-256") + "\nOpenSDK：6.8.40";
        } catch (Exception e) { return "登记信息读取失败：" + e.getClass().getSimpleName(); }
    }
    private static String digest(byte[] value, String algorithm) throws Exception {
        byte[] hash = MessageDigest.getInstance(algorithm).digest(value);
        StringBuilder result = new StringBuilder();
        for (byte b : hash) result.append(String.format(Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }
    @SuppressWarnings("deprecation")
    public static String wechat(Context c) {
        try { PackageInfo info = c.getPackageManager().getPackageInfo("com.tencent.mm", 0); return "微信已安装 · " + info.versionName; }
        catch (PackageManager.NameNotFoundException e) { return "未检测到微信，请先安装并登录"; }
    }
}
