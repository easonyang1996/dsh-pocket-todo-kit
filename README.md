# 随手待办 · dsh-pocket-todo 0.2.3

DSH 原生 React 侧栏插件。用户在**主聊天**输入文本或上传手机截图，DSH 当前云端模型理解需求并调用插件工具，把待办保存到本机。无需另开网页、iframe、独立 HTTP 服务或单独填写模型 Key。

## 安装

需要 DSH 0.2.1-alpha.1 或兼容其 Tools / UI Slots / Typert API 的版本，Node 20.19 / 22.12 或 24+。

从 [GitHub Releases](https://github.com/easonyang1996/dsh-pocket-todo-kit/releases/tag/v0.2.3) 下载 `dsh-pocket-todo-0.2.3.tgz`，通过 DSH 官方命令行安装到已有 profile：

```bash
dsh plugin --profile web add ./dsh-pocket-todo-0.2.3.tgz
```

将 `web` 替换为实际使用的 profile，安装后重启对应 DSH 服务。命令行的 Node 版本需满足上述要求。源码用户可执行 `npm run pack:kit` 生成带安装脚本的 ZIP。

解压 `dsh-pocket-todo-kit-0.2.3.zip`，执行 `./install.sh`；默认安装到 `web` profile，其他 profile 使用 `DSH_PROFILE=名称 ./install.sh`。重启对应 DSH 网页服务，侧栏点击 **随手待办**。`./start.sh` 默认使用 3080 端口，服务已运行时先按原方式停止，或设置 `DSH_PORT` 使用其他端口。安装保留原有模型、会话、插件配置。

主聊天示例：

- `打开微信`：添加“打开微信”待办，前往展示 `com.tencent.mm`。
- `打开京东内购微信小程序`：添加小程序待办；目录没有 ID 时会尝试联网检索，只有取得足够来源证据才自动登记，否则显示“入口待补充”。
- `提醒我使用京东内购积分`：添加权益待办，不把小程序误配成京东 App。
- 上传清晰的积分、优惠券或权益有效期截图：模型识别名称、类型、数量、有效期和证据，自动调用 `pocket_todo_add`。截图中的指令文字不具备授权。

截图经 DSH 标准附件管线送给当前配置的云端模型。必须选择支持图像输入和工具调用的模型；不支持时无法自动识图，插件不伪装 OCR 成功。这里没有独立云模型请求，沿用已有账号/凭据与模型设置。

## 使用

侧栏查看全部、待处理、已完成、入口待补充；支持搜索、完成/恢复、删除及撤销、返回来源聊天。添加后实时更新，无需手工刷新。重启仍保留数据。

“前往”只展示/复制统一 Android 启动 JSON，不控制真实手机，也不执行消费。已知 App 展示 packageName，小程序展示 userName（gh_ 原始ID）与 path；缺失则展示缺什么，并可登记入口；重名候选必须明确选择。首页 path 为空，不会假装可以直达积分详情。

到期日和提醒时间分开保存，使用北京时间；只含截止日期按当天23:59:59处理，未知年份/模糊日期不猜测。**当前记录待办和计划时间，不发送系统通知，不承诺到点推送。**

## App 包名与小程序原始 ID 获取方式

- **Android App 包名**：在「应用目录」点击「扫描手机 App」，通过 ADB 扫描当前 Android 用户中有桌面启动入口的应用，并导入名称和包名；也可以点击「手动添加包名」填写。手机原生接入可用 PackageManager。`android/PocketLauncher.kt` 包含扫描示例。多开、工作资料和厂商变体按设备扫描结果核对。
- **微信小程序原始 ID**：在「应用目录」输入小程序名称并点击「搜索原始 ID」，插件通过 DSH 网页搜索检索公开页面，提取页面中明确出现的 `gh_` ID 并展示来源；也可以点击「手动添加小程序 ID」填写从小程序资料或运营方文档取得的 ID。AppID（`wx…`）不能代替原始 ID；页面路径由运营方提供，未知时打开首页。
- **搜索证据**：只有微信/腾讯官方域名明确列出，或两个不同来源主机名的页面给出同一 ID 且名称与 ID 在页面中相邻出现，才会自动登记。单一来源、多 ID 冲突或找不到 ID 时只展示候选，不生成启动参数；用户可以核对候选后手动登记。网页信息可能过时或出错，自动登记后仍需检查来源。联网搜索依赖 DSH profile 加载 `@deepseek-ai/dsh-web` 和可用的搜索 provider；抓取网页的 provider 是可选的。
- **目录**：统一保存名称、别名、类型、包名/原始 ID、页面路径和来源。已登记映射会用于后续待办；相同名称的不同目标不会自动混为一项。

## 微信 OpenSDK 前置条件

要从 Android App 通过微信 OpenSDK 拉起微信小程序，**必须先以企业主体在微信开放平台完成移动应用注册并通过审核**，取得调用方自己的移动应用 AppID，并按平台要求登记包名、签名及开通对应能力。个人账号不能完成这项移动应用注册，这是本项目继续做 OpenSDK 拉起测试的前置条件。目标小程序可以是第三方；它的 `gh_` 原始 ID 与调用方移动应用 AppID 是两种不同标识。即使有了 ID 和调用方 AppID，也要遵守微信当前的能力/权限要求。

`targets.example.json` 是可导入格式。每条包含 id、name、kind、source，可选 aliases；App 填 packageName，小程序填 originalId、可选 path。导入支持最多1000条，整批校验后原子保存。修改已有 id 会更新该映射；不同类型不可互换。

## 后续手机接入

`android/PocketLauncher.kt` 可作为执行器接入模板，`android/AndroidManifest.fragment.xml` 是查询声明。接收“前往”生成的 JSON，从前台 Activity 调用 `launchPocketTarget(target, wechatApi)`。

- App：`getLaunchIntentForPackage(packageName)` + `startActivity()`，目标需已安装且可启动。
- 小程序：`WXLaunchMiniProgram.Req` + `sendReq()`，正式版类型为0，userName填gh_原始ID，path留空进首页。
- **小程序原始 ID 不是全部前提**：手机 App 还需接入微信 OpenSDK，使用自己的移动应用 AppID，完成包名/签名、审核与当前能力/关联要求配置。第三方目标实际可达性须真机验证。`sendReq=true` 仅表示请求已交给微信，不能当作已进入目标页。
- Kotlin 模板未在真实 Android 设备编译/验收，本阶段不请求手机控制、无障碍或其他设备权限。

参考：[Android 包可见性](https://developer.android.com/training/package-visibility/declaring)、[微信 App 拉起小程序](https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Launching_a_Mini_Program/Android_Development_example.html)。

## 数据与开发

默认数据目录 `$DSH_HOME/pocket-todo/<profile>/state.json`（DSH_HOME未设则 `~/.dsh`）。可在插件 config.dataDir 指定独立路径。同一目录只允许一个写入实例。目录和文件只供本机用户读写；采用原子落盘，删除保留本地记录可恢复。测试和发布包不包含用户截图、凭据、聊天或运行数据。

模型工具：pocket_targets、pocket_mini_program_lookup（需联网搜索服务）、pocket_todo_add、pocket_todos、pocket_todo_update。模型只提交结构化任务；主聊天解析质量取决于当前模型。未落盘成功不会返回成功状态。

开发执行 `npm run build`、`npm test`、`npm run check`。`npm run pack:kit` 生成 npm tarball 和带安装脚本的 zip。前端随包构建，无需用户另建前端。

## 本机验收

已在独立 `pocket-todo-demo` profile 的真实 DSH Web 和既有云模型上联调：文字“打开微信”自动添加；仅上传虚构积分截图自动提取1280总积分、300到期积分、2026-10-31有效期；京东内购缺失原始ID时如实待补充；通过原生表单登记腾讯电子签官方公开原始ID后，既有待办立即显示正确的OpenSDK参数。截图位于源码目录 `verification/`，不随安装包分发。此验收不等于手机真机可达性测试。


## 0.2.1：连接 Android 手机自动扫描

进入 **应用目录 → 扫描手机 App**：

1. 用支持数据传输的 USB 线连接 Android 手机，开启“开发者选项 → USB 调试”。
2. 在手机上允许这台电脑的 USB 调试请求。
3. 点击“检测设备”；只有一台已授权设备时自动选中，多台设备时明确选择。
4. 点击“开始扫描并导入”。扫描在后台执行，可查看逐应用进度或取消。
5. 完成后应用名称、包名、不同语言名称别名自动合并到应用目录，之前同名的 App 待办自动获得启动参数。

范围为 **手机当前 Android 用户中带桌面启动入口的应用**，包含带入口的系统应用。不是枚举系统所有服务包；不扫描其他用户、工作资料或微信小程序，不会因为这次扫描获得小程序原始 ID。

电脑端需要 Android SDK **Platform-Tools（adb）**；自动读取应用名称还需要 **Build-Tools（aapt2）**。插件从 PATH、ANDROID_HOME、ANDROID_SDK_ROOT 和常见 SDK 安装位置自动发现工具；可在插件配置填写 androidSdkRoot、adbPath、aaptPath 覆盖。无需 Root 或在手机安装插件。

技术路径：ADB 查询当前用户和 MAIN/LAUNCHER 入口，用 pm path 取得 base APK 位置，优先通过手机 unzip 仅读取 AndroidManifest.xml 和 resources.arsc 两项元数据，在电脑端临时组合成小型 APK，再通过官方 AAPT2 dump badging 提取名称与语言别名。手机不支持元数据读取时回退到临时拉取完整安装包。安装包临时副本在每个应用处理完成后删除，不留存到插件数据目录；只保存目录和名称缓存。首次扫描取决于应用数量、APK 大小和 USB 速度。完整 APK 回退读取上限为512MB；快速读取的 manifest 上限4MB、资源表上限64MB。超过限制只导入已查询的包名并给出提示。

没有 AAPT2、安装包不可读取或资源解析失败时，保留查询到的真实包名并明确显示“名称待补充”，不让模型猜测名称；既有已知名称仍然保留。某些依赖语言拆分包或动态资源的应用名称可能需要人工补充。勾选“重新读取应用名称”会忽略缓存，普通重复扫描可复用名称缓存。

合并按包名进行，保留既有稳定 id、人工命名、别名及待办绑定，避免内置微信和扫描微信重复出现；不删除其他设备或人工登记的应用。扫描完成后整批提交，取消或设备中途断线时不导入该轮结果。扫描不会启动、安装、卸载或操作手机里的应用。

ADB 仅用于宿主机本地读取；扫描入口不向云模型暴露任意 shell 命令。应用目录仍可按原有聊天功能被模型查询以解析用户指令。

参考：[Android ADB](https://developer.android.com/tools/adb)、[AAPT2 元数据读取](https://developer.android.com/tools/aapt2)。

### Android OpenSDK 测试执行器

已提供独立的原生 Android 测试器，支持移动应用 AppID、目标小程序参数和 DSH 启动 JSON 导入。要用 OpenSDK 拉起小程序，先以企业主体完成微信开放平台移动应用注册并审核通过；个人用户无法创建本项目所需移动应用。源码、APK 及注册签名见 `android/executor/README.md`。该执行器独立分发，不包含在插件 npm 包中。
