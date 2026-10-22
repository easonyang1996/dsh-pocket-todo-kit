package com.personalai.pocketexecutor;

import org.json.JSONObject;

public final class LaunchParams {
    public final String userName;
    public final String path;
    public final int type;
    public LaunchParams(String userName, String path, int type) {
        if (userName == null || !userName.matches("gh_[A-Za-z0-9]{1,100}")) throw new IllegalArgumentException("小程序原始 ID 应以 gh_ 开头；不能填写 wx 开头的 AppID");
        if (path == null || path.length() > 2048 || path.indexOf('\u0000') >= 0) throw new IllegalArgumentException("页面路径无效或超过2048字符");
        if (type < 0 || type > 2) throw new IllegalArgumentException("小程序版本必须是0、1或2");
        this.userName = userName; this.path = path; this.type = type;
    }
    public static boolean validAppId(String appId) { return appId != null && appId.matches("wx[0-9a-fA-F]{16}"); }
    public static LaunchParams fromJson(String json) throws Exception {
        if (json == null || json.length() > 16384) throw new IllegalArgumentException("JSON 为空或超过16KB");
        JSONObject o = new JSONObject(json);
        if (!"wechat_mini_program".equals(o.optString("kind"))) throw new IllegalArgumentException("只接受微信小程序启动参数");
        if (o.has("platform") && !"android".equals(o.getString("platform"))) throw new IllegalArgumentException("只接受 Android 参数");
        if (o.has("schemaVersion") && o.getInt("schemaVersion") != 1) throw new IllegalArgumentException("不支持的参数版本");
        if (!(o.opt("userName") instanceof String)) throw new IllegalArgumentException("缺少 userName 原始ID");
        if (o.has("path") && !(o.opt("path") instanceof String)) throw new IllegalArgumentException("path 必须是字符串");
        int type = 0;
        if (o.has("miniprogramType")) {
            Object value = o.get("miniprogramType");
            if (!(value instanceof Number) || ((Number)value).doubleValue() != ((Number)value).intValue()) throw new IllegalArgumentException("miniprogramType 必须是整数");
            type = ((Number)value).intValue();
        }
        return new LaunchParams(o.getString("userName").trim(), o.optString("path", "").trim(), type);
    }
    public JSONObject json() throws Exception {
        JSONObject result = new JSONObject();
        result.put("schemaVersion", 1); result.put("platform", "android"); result.put("kind", "wechat_mini_program");
        result.put("userName", userName); result.put("path", path); result.put("miniprogramType", type);
        return result;
    }
}
