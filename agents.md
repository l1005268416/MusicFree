# 智能体协议（编译与安装经验）

本文件记录在本仓库（React Native 0.76.5 + Expo 52，音乐 App）上构建/安装 Android 包的环境、坑点与操作速记。

## 环境事实

- 操作系统：Windows + PowerShell，无 `grep`/`sed`/`head`/`which`；中文路径下 python heredoc / 带引号的 `python -c` 会失败 → 改用 `write` 工具写临时 `.py` 再执行。
- 工具链（不在 PATH）：
  - JDK 17：`E:\tools\jdk-17`（系统 JAVA_HOME 是 JDK 8，必须覆盖）
  - Android SDK：`E:\tools\android-sdk`
  - Gradle home：`E:\tools\gradle-home`（含 `init.d/aliyun.gradle` 阿里云镜像脚本）
  - adb：`E:\tools\android-sdk\platform-tools\adb.exe`（或 `C:\Program Files (x86)\Wiseweb调试工具\bin\adb-win\adb.exe`）
- 手机：`eecee54d`（zorn，Android 17 / API 37）→ 用 `arm64-v8a`。
- 项目专属：`android/gradle.properties` 默认构建 4 架构（armeabi-v7a/arm64-v8a/x86/x86_64），可用 `-PreactNativeArchitectures=arm64-v8a` 只构建一个。

## 构建必须先设环境变量

```powershell
$env:JAVA_HOME='E:\tools\jdk-17'
$env:ANDROID_HOME='E:\tools\android-sdk'
$env:ANDROID_SDK_ROOT='E:\tools\android-sdk'
$env:GRADLE_USER_HOME='E:\tools\gradle-home'
```

## 依赖下载失败（TLS）与阿里云镜像

`dl.google.com`、`plugins.gradle.org`、`repo.maven.apache.org` 全部 TLS 握手失败（schannel CRYPT_E_REVOCATION_OFFLINE），只有 `maven.aliyun.com` 可用。

- `E:\tools\gradle-home\init.d\aliyun.gradle` 只会追加镜像，但各子项目 build.gradle 里内联的 `google()`/`mavenCentral()`/`plugins.gradle.org` 会先于镜像被尝试并中止构建 → 必须直接改源码：
  - 全仓 patch node_modules 下 `android/build.gradle`（约 20+ 个）：`google()` → `maven { url "https://maven.aliyun.com/repository/google" }`；`mavenCentral()` → aliyun `public`；`plugins.gradle.org` → aliyun `gradle-plugin`。
- patch 后 gradle 仍可能显示 "No cached version available for offline mode"，需要确认 aliyun 仓库能实际拉取目标依赖。
- 不要删除或改动 `init.d/aliyun.gradle` 以外默认行为；node_modules 内的 patch 只为解 TLS。

## debug vs release（关键陷阱）

- **debug 构建不内嵌 JS bundle**（RN 默认 debug 变体跳过打包，依赖运行时 Metro）→ APK 里没有 `index.android.bundle`，App 一直卡在启动画面，logcat 显示 `Unable to load script ...... index.android.bundle`。
- **release 构建内嵌 JS bundle**。要在手机上「真正安装并使用」，优先 release。
- 构建命令：`./gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon`（在 `android/` 目录下）。
- release 缺签名 → 没有 release keystore 时 release 构建会在 `:app:validateSigningRelease` 失败。

## release 签名（本地开发用）

- 生成本地 keystore（被 `.gitignore` 忽略）：
  ```powershell
  & "E:\tools\jdk-17\bin\keytool.exe" -genkeypair -storetype JKS -keystore "android\app\release.keystore" -alias release -keyalg RSA -keysize 2048 -validity 3650 -storepass "<pwd>" -keypass "<pwd>" -dname "CN=Songjian Music, OU=fengye, O=fengye, L=Shenzhen, ST=Guangdong, C=CN" -noprompt
  ```
- `android/keystore.properties`（gitignore）：根项目目录的 `keystoreProperties` 读取此文件，但 **`storeFile` 相对路径是相对于 `android/app` 项目目录**（即 `android/app/release.keystore`），不是 `android/`。
  ```
  RELEASE_STORE_FILE=release.keystore
  RELEASE_STORE_PASSWORD=<pwd>
  RELEASE_KEY_ALIAS=release
  RELEASE_KEY_PASSWORD=<pwd>
  ```
- 本地开发 keystore 不是生产密钥；正式发布必须换一套真正的。

## Stale 缓存与配置过期（关键陷阱）

- `createExpoConfig`（expo-constants）的 task 只声明了 outputs 不声明 inputs → 即使 app.json 改了也不会重新生成，`assets/app.config` 会保持旧值（旧的 `MusicFree`）。
- 仓库根目录遗留的未跟踪 `assets/app.config`（旧内容）还会覆盖生成的配置进入 APK。删除它：
  ```powershell
  Remove-Item "assets\app.config"   # 只删除了该路径的这个 stray 文件
  ```
- 还要删除过期缓存：`node_modules\expo-constants\android\build`（或者至少是 `node_modules\expo-constants\android\build\intermediates\library_assets`）+ `android/app/build/intermediates/assets` / `android/app/build/generated/assets`，再重建。
- 检查 APK 内容（验证正确）：
  ```powershell
  $tmp='C:\Users\Administrator\AppData\Local\Temp\opencode\check'
  tar -xf "<apk>" "assets/app.config" -C $tmp  # 或 PowerShell 用 tar
  python -c "import pathlib; b=pathlib.Path('<app.config>').read_bytes(); print(b.decode('utf-8'))"
  ```
  控制台打印中文会显示乱码（GBK 显示 UTF-8），但这只是显示问题，用 python 按 UTF-8 读确认字节才权威。

## 安装到手机

```powershell
$adb = "E:\tools\android-sdk\platform-tools\adb.exe"
& $adb install -r "<apk>"
```

- 首次安装可能报 `INSTALL_FAILED_USER_RESTRICTED` → 需要用户在手机上授权；重试一次即可。
- debug → release 签名不一致会报 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` → 先 `adb uninstall <package>` 再装。
- 验证：`adb shell pm list packages | Select-String "com.fengye"`；启动：`adb shell am start -n <package>/.MainActivity`；截图：`adb shell screencap -p /sdcard/screen.png` 再 pull。
- 旧 app（`fun.upup.musicfree`）必须保持存在，不允许被覆盖。
- App 启动时先弹「存储权限」授权对话框，是正常的首次启动行为，需要用户在手机上选择（授权或关闭）。

## 已知限制（不在本次修复范围）

- 4 个上游预编译 native 库（expo-modules-core / reanimated / hermestooling / mmkv）不符合 16KB 对齐（上游产物未改）；仅 warning，运行正常。
- 图标/启动图保持旧的 cat + "MusicFree"（未重新做）。
- 未提交 git：所有改动（重命名 + UI 优化 + 本次配置）保持未提交，不应擅自提交。

## 速查

| 问题 | 排查 |
|---|---|
| 启动页卡住 | 查 logcat 有无 `Unable to load script` → 确认是 release 包或 Metro 在跑 |
| build 卡在依赖下载 | 环境变量 + 阿里云镜像未 patch → node_modules 里的 `google()`/`mavenCentral()` 改成 aliyun |
| APK 里 `app.config` 还是旧名 | 检查根 `assets/app.config` stray 文件 / `node_modules/expo-constants/android/build` 缓存 → 删除重建 |
| 安装失败 `UPDATE_INCOMPATIBLE` | 签名不同 → uninstall 先 |
| 颜色/图标显示异常 | 看是原生资源（旧 cat 保持不动）还是配置过期 |
