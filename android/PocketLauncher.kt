package example.pocket

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import com.tencent.mm.opensdk.modelbiz.WXLaunchMiniProgram
import com.tencent.mm.opensdk.openapi.IWXAPI
import org.json.JSONObject

/** Call on the UI thread of the foreground Activity after a user taps “前往”. */
fun Activity.launchPocketTarget(target: JSONObject, wechatApi: IWXAPI): String {
    return try {
        when (target.getString("kind")) {
            "android_app" -> {
                val intent = packageManager.getLaunchIntentForPackage(target.getString("packageName"))
                    ?: return "应用未安装、未启用或不可查询"
                startActivity(intent)
                "启动请求已提交"
            }
            "wechat_mini_program" -> {
                if (!wechatApi.isWXAppInstalled) return "请先安装微信"
                val req = WXLaunchMiniProgram.Req().apply {
                    userName = target.getString("userName") // gh_ 原始 ID，非 wx AppID
                    path = target.optString("path", "") // 留空打开首页
                    miniprogramType = WXLaunchMiniProgram.Req.MINIPTOGRAM_TYPE_RELEASE
                }
                if (wechatApi.sendReq(req)) "请求已交给微信，实际打开结果需验证"
                else "微信拒绝了启动请求，请检查 SDK 配置和能力权限"
            }
            else -> "不支持的目标类型"
        }
    } catch (_: ActivityNotFoundException) { "未找到应用启动入口" }
      catch (_: SecurityException) { "系统拒绝启动" }
}

/** Android 11+ requires the launcher intent query shown in AndroidManifest.fragment.xml. */
fun Activity.scanPocketApps(): List<JSONObject> {
    val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    @Suppress("DEPRECATION")
    return packageManager.queryIntentActivities(launcher, 0)
        .distinctBy { it.activityInfo.packageName }
        .map { info ->
            JSONObject().apply {
                val pkg = info.activityInfo.packageName
                put("id", "android-" + pkg.replace('.', '-'))
                put("name", info.loadLabel(packageManager).toString())
                put("kind", "android_app")
                put("packageName", pkg)
                put("aliases", org.json.JSONArray())
                put("source", "Android 设备启动入口扫描")
                put("origin", "device")
            }
        }
}
