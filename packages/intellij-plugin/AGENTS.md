<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# erd-editor-intellij-plugin

## Purpose

ERD(Entity-Relationship Diagram) 에디터를 IntelliJ 계열 IDE에 통합하는 JetBrains 플러그인입니다. `.erd` / `.erd.json` 파일을 열면 기본 텍스트 에디터 대신 JCEF(Chromium Embedded Framework) 기반 웹뷰가 열리고, 그 안에서 [erd-editor](https://github.com/dineug/erd-editor) 웹앱이 실행됩니다.

Kotlin 코드는 **얇은 호스트 레이어**입니다. 다이어그램 편집 로직은 전부 웹앱(`erd-editor` 서브모듈)에 있고, 플러그인은 다음만 담당합니다.

- `.erd` 파일 확장자 인식 및 커스텀 `FileEditor` 등록
- JCEF 브라우저 생성과 번들된 정적 자산(`/assets`) 서빙
- 웹뷰 ↔ IDE 간 JSON 메시지 브리지 (파일 읽기/쓰기, 내보내기, 테마, 실시간 복제)
- 테마 설정 영속화

## Key Files

| File | Description |
|------|-------------|
| `build.gradle.kts` | IntelliJ Platform Gradle Plugin 2.x 설정. `pluginConfiguration`에서 README의 `<!-- Plugin description -->` 구간과 CHANGELOG를 플러그인 매니페스트로 주입 |
| `gradle.properties` | `pluginVersion`, `platformVersion`(2026.1.4), `pluginSinceBuild`(252), `javaVersion`(21) 등 빌드 파라미터의 단일 진실 공급원 |
| `gradle/libs.versions.toml` | Gradle version catalog (Kotlin 2.3.21, intellij.platform 2.18.1, changelog/qodana/kover) |
| `settings.gradle.kts` | 루트 프로젝트 이름 정의. 단일 모듈 구성(서브프로젝트 없음) |
| `README.md` | 플러그인 마켓플레이스 설명 원본. `<!-- Plugin description -->` 마커를 지우면 **빌드가 실패**함 |
| `CHANGELOG.md` | Keep a Changelog 형식. `publishPlugin`이 `patchChangelog`에 의존하므로 릴리스 노트의 출처 |
| `qodana.yml` | Qodana JVM 정적 분석 설정 (JDK 21, `qodana.recommended` 프로파일) |
| `.gitmodules` | `erd-editor` 서브모듈 핀 (https://github.com/dineug/erd-editor.git) |
| `gradlew` / `gradlew.bat` | Gradle wrapper (8.5) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/main/kotlin/` | 플러그인 Kotlin 소스. 패키지 루트는 `com.github.dineug.erdeditorintellijplugin` |
| `src/main/resources/` | `META-INF/plugin.xml`, 아이콘, 메시지 번들, 그리고 **빌드로 생성되는** `assets/` 웹뷰 번들 |
| `erd-editor/` | git 서브모듈. erd-editor 모노레포 전체. 웹뷰 번들의 소스 (`packages/intellij-webview`) |
| `.github/workflows/` | `build.yml`(테스트·Qodana·Plugin Verifier·릴리스 초안), `release.yml`(마켓플레이스 배포) |
| `.run/` | IntelliJ 실행 구성: "Run Plugin"(`runIde`), "Run Verifications"(`verifyPlugin`) |
| `gradle/wrapper/` | Gradle wrapper 바이너리 및 프로퍼티 |

### Kotlin 소스 구조

| File | Description |
|------|-------------|
| `editor/ErdEditorProvider.kt` | `AsyncFileEditorProvider`. `.erd` 파일을 가로채 `FileEditorPolicy.HIDE_DEFAULT_EDITOR`로 기본 에디터를 숨김. `docToEditorsMap`으로 같은 파일의 여러 에디터 인스턴스를 추적 |
| `editor/ErdEditor.kt` | `FileEditor` 구현체이자 브리지 명령 핸들러. 파일 로드, 100ms 디바운스 저장, 파일 내보내기 다이얼로그, 테마 변경 수신을 처리 |
| `editor/WebviewPanel.kt` | JCEF 메시지 라우터 연결. `https://erd-editor-jetbrains-plugin/index.html` 커스텀 스킴 등록, `dispatch`/`dispatchBroadcast`로 웹뷰에 `window.postMessage` 실행 |
| `editor/Webview.kt` | `JBCefBrowser` 래핑. 로딩 패널 ↔ 콘텐츠 패널을 `MultiPanel`로 전환, 로드 타임아웃 처리 |
| `editor/WebviewBridge.kt` | 브리지 프로토콜 정의. Jackson `@JsonSubTypes`로 `HostBridgeCommand`(웹뷰→호스트) 역직렬화, `WebviewBridgeCommand`(호스트→웹뷰) 직렬화. `MutableSharedFlow` 기반 |
| `editor/SchemeHandlerFactory.kt` | 클래스패스 `/assets/**`를 HTTPS 리소스로 서빙하는 CEF 리소스 핸들러. MIME 타입을 확장자로 판별 |
| `editor/JCEFUnsupportedViewPanel.kt` | JCEF를 못 쓰는 런타임(비 JetBrains Runtime)에서 보여줄 안내 패널 |
| `files/ErdEditorFiles.kt` | `.erd`, `.erd.json` 확장자 판별 (단일 진실 공급원) |
| `files/ErdEditorIconProvider.kt` | 프로젝트 트리에서 `.erd` 파일 아이콘 교체 |
| `files/ErdEditorIcons.kt` | `icons/erd-editor-file-icon.svg` 로더 |
| `settings/ErdEditorAppSettings.kt` | 애플리케이션 레벨 `PersistentStateComponent`. `erd-editor.xml`에 테마(appearance/grayColor/accentColor) 저장, `Topic` 메시지 버스로 변경 브로드캐스트 |

## For AI Agents

### Working In This Directory

**서브모듈을 먼저 확인하세요.** `erd-editor/`는 git 서브모듈입니다. 비어 있으면 아무것도 빌드되지 않습니다.

```bash
git submodule update --init --recursive
```

**웹뷰 자산은 커밋되지 않습니다.** `.gitignore`에 `src/main/resources/assets`가 있습니다. 클린 체크아웃에서는 서브모듈에서 웹뷰를 빌드해야 플러그인이 빈 화면 대신 에디터를 띄웁니다.

```bash
cd erd-editor && pnpm install
cd packages/intellij-webview && pnpm nx:build:webview   # → ../../../src/main/resources/assets
```

서브모듈은 pnpm workspace + nx 모노레포입니다. `nx:build:webview`(= `nx build:webview`)는 `dependsOn: ["^build"]` 덕분에 워크스페이스 의존 패키지를 먼저 빌드합니다. `pnpm build:webview`는 webpack만 직접 돌리므로 의존 패키지가 이미 빌드된 상태에서만 쓰세요.

빌드 출력 경로는 `erd-editor/packages/intellij-webview/webpack.config.js`에 하드코딩되어 있습니다(`env.target === 'webview'`일 때만 이 저장소의 `src/main/resources/assets`로 나감). 이 상대 경로 규약이 두 저장소를 잇는 **유일한 결합점**이므로 디렉터리 레이아웃을 바꾸지 마세요.

**빌드·실행**

```bash
./gradlew buildPlugin                      # 배포용 zip → build/distributions/
./gradlew runIde                           # 샌드박스 IDE 실행 (.run/Run Plugin 과 동일)
./gradlew verifyPlugin                     # Plugin Verifier 호환성 검증 (.run/Run Verifications 와 동일)
./gradlew verifyPluginStructure            # plugin.xml·아카이브 구조 검증
./gradlew verifyPluginProjectConfiguration # 빌드 설정 정합성 점검
```

2.x에서 태스크 이름이 바뀌었습니다. 1.x의 `runPluginVerifier` → `verifyPlugin`, 1.x의 `verifyPlugin` → `verifyPluginStructure`, `listProductsReleases` → `printProductsReleases`(파일 대신 stdout).

JDK 21로 컴파일합니다. 머신에 JDK 21이 없어도 `settings.gradle.kts`의 foojay resolver가 자동으로 받아옵니다(Gradle 데몬 자체는 더 높은 JDK에서 돌아도 무방).

`verifyPluginProjectConfiguration`은 "since-build 252 < target platform 261" 경고를 냅니다. 구버전 IDE를 함께 지원하려는 **의도된 상태**이며, Plugin Verifier가 실제 252 IDE에서 `Compatible`을 확인해 줍니다.

**의존성은 플랫폼에서 옵니다.** `dependencies` 블록에는 `intellijPlatform { intellijIdea(...) }`만 있습니다. `kotlinx.coroutines`, Jackson(`jacksonObjectMapper`, `@JsonSubTypes`), JCEF/`org.cef.*`는 모두 IntelliJ Platform이 번들한 것을 씁니다. 여기에 직접 추가하면 클래스 로더 충돌이 나기 쉬우므로, 새 라이브러리가 필요하면 플랫폼이 이미 제공하는지 먼저 확인하세요. `kotlin.stdlib.default.dependency = false`도 같은 이유이며, 같은 이유로 `apiVersion = KOTLIN_2_1`을 걸어 하한 IDE(2025.2, 번들 stdlib 2.1.20)의 API 표면을 넘지 않게 합니다.

**Community Edition은 더 이상 없습니다.** 별도 `ideaIC` 배포는 2025.2가 마지막이고 2025.3부터 통합 IntelliJ IDEA 하나로 나옵니다. `platformType = IC` / `intellijIdeaCommunity(...)`를 쓰면 아티팩트 해석이 실패하므로 `intellijIdea(...)`를 씁니다.

**버전은 `gradle.properties`에서만 올립니다.** `pluginVersion`을 바꾸고 `CHANGELOG.md`에 해당 버전 섹션을 채우면 `pluginConfiguration`이 나머지를 처리합니다. `plugin.xml`에 버전을 직접 쓰지 마세요.

**브리지 프로토콜은 양쪽을 함께 바꿔야 합니다.** `WebviewBridge.kt`의 `type` 문자열(`hostSaveValueCommand`, `webviewUpdateThemeCommand` 등)은 `erd-editor/packages/vscode-bridge`의 정의와 정확히 일치해야 합니다. 한쪽만 바꾸면 메시지가 조용히 무시됩니다.

**스레딩 규칙을 지키세요.** IntelliJ 파일 쓰기는 `readAndWriteAction { writeAction { ... } }` 안에서만 가능하고, 파일 선택 다이얼로그는 EDT에서 열어야 합니다(`ApplicationManager.getApplication().invokeLater`). 기존 코드가 이 패턴을 따르고 있으니 그대로 모방하세요.

### Testing Requirements

**자동화된 테스트가 없습니다.** `src/test`가 존재하지 않으며 Kover는 설정만 되어 있고 측정할 테스트가 없습니다. 따라서 검증은 다음 순서로 수동 진행합니다.

1. `./gradlew buildPlugin` — 컴파일 및 매니페스트 패치 통과
2. `./gradlew runIde --args="/경로/sample.erd.json"` — 샌드박스가 그 파일을 바로 열어줍니다. **다이어그램이 실제로 렌더되는지 눈으로 확인하세요.** 아래 JCEF 항목 참고
3. `./gradlew verifyPlugin` — `pluginSinceBuild` 하한과 최신 릴리스 양쪽에서 `Compatible` 확인
4. 필요 시 `./gradlew qodanaScan` 또는 CI의 Qodana 잡

**빌드 통과는 동작을 보장하지 않습니다.** 웹뷰는 커스텀 스킴으로 자산을 받아오므로, 컴파일과 Plugin Verifier를 모두 통과하고도 화면이 비거나 `DNS_PROBE_FINISHED_NXDOMAIN`이 뜰 수 있습니다. JCEF를 건드렸다면 반드시 2번을 수행하세요.

런타임 로그는 `.intellijPlatform/sandbox/erd-editor-intellij-plugin/IU-<버전>/log/idea.log`에 남습니다(2.x에서 `build/idea-sandbox`로부터 이동). `runIde`가 `idea.log.debug.categories`를 설정하지만 **기본 appender는 DEBUG를 파일에 쓰지 않습니다** — `thisLogger().debug(...)`가 안 보인다고 코드가 안 돌았다고 판단하지 마세요. 웹뷰 `console.*`는 `WebviewPanel`의 `CefDisplayHandlerAdapter`가 INFO 이상으로 올려줍니다.

테스트를 새로 추가한다면 `src/test/kotlin/`에 두고 `BasePlatformTestCase` 계열을 쓰되, JCEF에 의존하는 부분은 헤드리스에서 동작하지 않으므로 `ErdEditorFiles` 같은 순수 로직부터 다루는 편이 현실적입니다.

### Common Patterns

- **Disposable 체인** — `ErdEditor` → `WebviewPanel` → `Webview` → `JBCefBrowser` 순으로 `Disposer.register`가 걸려 있습니다. 새 리소스는 반드시 이 체인에 등록해 에디터 탭이 닫힐 때 함께 해제되게 하세요.
- **`isDisposed` 가드** — 코루틴이 해제된 패널에 접근하지 않도록 `WebviewPanel`/`ErdEditor` 모두 플래그를 확인합니다. 비동기 콜백을 추가할 때 같은 가드를 넣으세요.
- **에디터당 코루틴 스코프** — `CoroutineScope(SupervisorJob() + CoroutineName(...))`를 에디터마다 만듭니다. IO는 `Dispatchers.IO`로 넘깁니다.
- **디바운스 저장** — `MutableStateFlow` + `debounce(100.milliseconds)` + `collectLatest`로 잦은 편집을 흡수합니다.
- **다중 에디터 복제** — 같은 파일이 여러 탭에 열렸을 때 `dispatchBroadcast`가 `docToEditorsMap`을 돌며 자신을 제외한 나머지 웹뷰에 변경을 전파합니다.
- **읽기 전용 반영** — `file.isWritable`을 `webviewUpdateReadonlyCommand`로 웹뷰에 전달합니다.
- **sealed class + Jackson** — 브리지 명령은 sealed class 계층에 `type` 프로퍼티를 두고 `JsonTypeInfo.As.EXISTING_PROPERTY`로 판별합니다. 새 명령을 추가하면 `@JsonSubTypes`에도 등록해야 합니다.

### Gotchas

- **JCEF는 2026.2부터 코어에서 분리된 별도 번들 플러그인입니다.** `plugin.xml`이 의존성을 선언하지 않으면 2026.2+ IDE에서 `WebviewPanel`의 companion object 초기화(`JBCefApp.isSupported()`)가 `NoClassDefFoundError: com/intellij/ui/jcef/JBCefApp`로 죽고 에디터 탭이 아예 열리지 않습니다.
  - 필수(`<depends>`)로 걸면 **2025.2/2025.3에서 로드가 깨집니다** — 그 버전에는 `com.intellij.modules.jcef`가 해석 가능한 플러그인으로 존재하지 않습니다. `intellij.platform.ui.jcef`를 v2 `<dependencies><module>`로 거는 것도 같은 이유로 실패합니다(이름은 `module-descriptors.dat`에 있지만 의존 가능한 콘텐츠 모듈로 노출되지 않음).
  - 그래서 `<depends optional="true" config-file="jcef.xml">com.intellij.modules.jcef</depends>`를 씁니다. 구버전에서는 무시되고(코어에 JCEF가 있으므로 정상), 2026.2+에서는 해석되어 클래스로더 부모로 붙습니다.
  - **Plugin Verifier는 이 결함을 잡지 못합니다.** IU-262를 검사하고도 `Compatible`을 냅니다 — 클래스 존재 여부는 보지만 모듈 단위 클래스로더 격리는 모델링하지 않습니다. `runIde` 샌드박스도 빌드 대상 버전(261)으로 뜨므로 재현되지 않습니다. 실제 설치로만 확인됩니다.
- **JCEF 초기화 순서는 깨지기 쉽습니다.** `WebviewPanel`은 (1) `JBCefApp.getInstance()`로 플랫폼이 CEF를 부트스트랩하게 하고 → (2) 스킴 핸들러를 앱당 1회 등록하고 → (3) 그제서야 `Webview`를 만들어 `loadURL`합니다. 이 순서를 바꾸면 조용히 깨집니다.
  - 등록이 `loadURL` **이후**로 밀리면: out-of-process JCEF(2025.x 이후 기본값)에서 팩토리가 반영되지 않아 Chromium이 `erd-editor-jetbrains-plugin`을 실제 DNS로 해석하고 `DNS_PROBE_FINISHED_NXDOMAIN`이 뜹니다. in-process에서는 경합에서 이겨 통과하므로 재현이 안 될 수 있습니다.
  - `JBCefApp` 초기화 **이전**에 raw `CefApp.getInstance()`를 만지면: CEF가 플랫폼 설정 없이 생성되어 `JBCefBrowser` 생성이 `IllegalStateException: JCEF is not supported in this env`로 죽고, 에디터 탭 자체가 열리지 않습니다.
  - `CefApp.clearSchemeHandlerFactories()`는 전역입니다. IDE와 다른 플러그인의 핸들러까지 지우므로 쓰지 마세요.
- `plugin.xml`에는 `applicationConfigurable`이 등록되어 있지 않습니다. 테마 설정 UI는 없고, 값은 오직 웹뷰가 보내는 `hostSaveThemeCommand`로만 갱신됩니다. `ErdEditorBundle.properties`의 `settings.erd-editor.name` 키는 현재 사용처가 없습니다.
- `ErdEditor`의 `HostBridgeCommand.ImportFile` 분기는 비어 있습니다(웹뷰가 자체 처리). 파일 쓰기 실패 경로에는 `// TODO: notifyAboutWriteError` 주석만 있고 사용자 알림이 없습니다.
- `.run/*.run.xml`의 로그 경로에는 플랫폼 버전(`IU-2026.1.4`)이 박혀 있습니다. `platformVersion`을 올리면 함께 고쳐야 합니다.

## Dependencies

### Internal

- `erd-editor/packages/intellij-webview` — 웹뷰 번들 소스. `src/main/resources/assets`의 생성 주체
- `erd-editor/packages/vscode-bridge` — 브리지 명령 타입 정의. Kotlin 쪽 `WebviewBridge.kt`와 짝을 이룸
- `erd-editor/packages/erd-editor` — 실제 다이어그램 에디터 구현
- 서브모듈 내부 구조는 `erd-editor/AGENTS.md` 및 각 패키지의 `AGENTS.md` 참고

### External

- IntelliJ Platform 2026.1.4 (통합 IntelliJ IDEA) — `FileEditor`, JCEF(`JBCefBrowser`), VFS, 메시지 버스, `PersistentStateComponent`
- Kotlin 2.3.21 + kotlinx.coroutines — 플랫폼 번들 사용 (`apiVersion` 2.1로 제한)
- Jackson (`jackson-module-kotlin`) — 브리지 JSON 직렬화, 플랫폼 번들 사용
- JCEF / `org.cef.*` — 웹뷰 및 커스텀 스킴 핸들러. 최신 IDE는 out-of-process 모드가 기본
- IntelliJ Platform Gradle Plugin 2.18.1 (Gradle 9.0+ 필수), gradle-changelog-plugin 2.5.0, Qodana 2026.2.0, Kover 0.9.9

<!-- MANUAL: 아래에 수동 메모를 추가하면 재생성 시에도 보존됩니다 -->
