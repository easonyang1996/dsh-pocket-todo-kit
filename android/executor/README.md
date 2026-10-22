# 随手待办 Android 微信小程序测试执行器

可安装 APK：dist/executor.apk。固定 Android 包名：`com.personalai.pocketexecutor`。微信 OpenSDK 6.8.40。Android 8.0 及以上。

## 现在可以做什么

- 复制本 APK 的真实包名和证书签名 MD5，用于微信开放平台登记移动应用。
- 输入登记后获得的移动应用 AppID，填写目标小程序原始 ID、路径和版本。
- 预置“京东购物”和“腾讯电子签”，支持粘贴 DSH 待办“前往”生成的启动 JSON。
- 点击按钮发送 WXLaunchMiniProgram 请求，记录 registerApp、sendReq、onSendFinish 和 WXEntryActivity 的 onResp。
- 人工确认看到的目标页面，记录实际观察结果。该记录明确标为人工验证。

AppID 为空时发送按钮禁用；应用不提供 AppSecret 输入，不会根据名称猜测小程序 ID。填写 AppID 仅说明格式有效，不能说明开放平台审核或权限已通过。

## 你完成注册后的测试步骤

1. 以企业主体在微信开放平台完成 Android 移动应用注册并通过审核。个人账号无法完成本项目需要的移动应用注册。使用 dist/registration-info.md 的包名和签名登记应用，并按平台要求开通拉起小程序能力。
2. 手机上安装微信并登录，打开“随手待办测试器”，填写自己的移动应用 AppID，保存。
3. 首次选“京东购物”，使用正式版、空路径测试首页，点击“通过 OpenSDK 拉起”。京东购物不等于京东内购；后者要单独取得正确原始 ID。
4. 观察是否进入正确的小程序，截图留证；返回执行器查看并复制记录。sendReq=true/onSendFinish=true 仅表示发送结果，不能独立证明成功进入目标页面。回调不一定在打开时立刻返回。
5. 继续验证页面路径和其他第三方目标；权限或平台拒绝以真实返回、微信提示和开放平台配置为准。

## 与 DSH 插件联调

电脑调试仍保留插件“前往”展示 JSON 的行为。在执行器内粘贴该 JSON，点“读取 JSON”后检查并手动发送。

也可通过 USB 传入目标（只打开测试执行器并填写参数，不会自动调用 SDK）：

```sh
node scripts/push-target.mjs target-jd.example.json DEVICE_SERIAL
```

## 重新构建

本项目直接调用官方 Android 构建工具，不需要 Gradle。依赖 Node.js、Python 3、JDK 17 和 Android SDK platform android-34 / build-tools 35.0.0。

```sh
JAVA_HOME=/path/to/jdk17 ANDROID_SDK_ROOT=/path/to/sdk node scripts/build.mjs
```

脚本校验 vendor 中腾讯 OpenSDK AAR 的 SHA-256，编译、DEX、zipalign、签名并验证 APK。第一次构建生成本地测试证书，后续复用 `.signing/` 中的证书。必须妥善保留该目录；删除后重建会改变签名，已有 APK 也无法直接覆盖安装。私钥和口令不放入分发 ZIP 或插件 npm 包。

轻量构建脚本默认路径适用于本机 macOS；其他环境请设置上述两个环境变量。

## 测试

```sh
adb install -r dist/executor.apk
adb install -r dist/executor-tests.apk
adb shell am start -n com.personalai.pocketexecutor/.MainActivity
adb shell am instrument -w com.personalai.pocketexecutor.test/com.personalai.pocketexecutor.test.AdmissionTests
```

测试验证参数准入、错误输入不覆盖原目标、未配置 AppID 时禁用发送等行为，不向微信发送请求。测试会更改测试器内目标字段，且清空移动应用 AppID，建议在正式填 AppID 前运行。

## 来源

- [腾讯 OpenSDK Maven 发行版](https://repo.maven.apache.org/maven2/com/tencent/mm/opensdk/wechat-sdk-android/6.8.40/)，AAR SHA-256：`c3c3215f2bc7f6aad0454541f9bdd91878cdb15b64d35e194a6c9240000c5d48`，发行 POM 标注 Apache-2.0。
- [京东官方小程序跳转说明](https://opendoc.jd.com/jd-jssdk/v4/jm-redirect.html)：京东购物原始 ID `gh_45b306365c3d`。
- [腾讯电子签官方拉起说明](https://qian.tencent.com/developers/partner/openwxminiprogram/)：原始 ID `gh_da88f6188665`。

公开的目标 ID 不等同于调用方自动获得平台许可；实际拉起测试待你自己的移动应用登记完成后进行。
