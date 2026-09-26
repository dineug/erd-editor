import org.jetbrains.changelog.Changelog
import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.extensions.intellijPlatform
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

fun properties(key: String) = providers.gradleProperty(key)
fun environment(key: String) = providers.environmentVariable(key)

plugins {
    id("java") // Java support
    alias(libs.plugins.kotlin) // Kotlin support
    alias(libs.plugins.intelliJPlatform) // IntelliJ Platform Gradle Plugin
    alias(libs.plugins.changelog) // Gradle Changelog Plugin
    alias(libs.plugins.qodana) // Gradle Qodana Plugin
    alias(libs.plugins.kover) // Gradle Kover Plugin
}

group = properties("pluginGroup").get()
version = properties("pluginVersion").get()

// Compile against the oldest supported JDK so the plugin also loads on IDEs running JBR 21.
kotlin {
    jvmToolchain(properties("javaVersion").get().toInt())

    compilerOptions {
        // 2025.2 bundles Kotlin stdlib 2.1.20 - stay within that API surface so the plugin
        // keeps working on every IDE from `pluginSinceBuild` upwards.
        apiVersion = KotlinVersion.KOTLIN_2_1
    }
}

// Configure project's dependencies
repositories {
    mavenCentral()

    // IntelliJ Platform Gradle Plugin Repositories Extension -> https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-repositories-extension.html
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    // Plain JVM unit tests only - the JCEF-dependent parts of the plugin cannot run headless,
    // so no IntelliJ test framework is pulled in.
    testImplementation(libs.junit)

    // IntelliJ Platform Gradle Plugin Dependencies Extension -> https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-dependencies-extension.html
    intellijPlatform {
        intellijIdea(properties("platformVersion"))

        pluginVerifier()
        zipSigner()
    }
}

// Configure IntelliJ Platform Gradle Plugin -> https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-extension.html
intellijPlatform {
    projectName = properties("pluginName").get()

    // The one settings page is found by its name; indexing its checkbox is not worth an IDE run per build.
    buildSearchableOptions = false

    pluginConfiguration {
        version = properties("pluginVersion")

        // Extract the <!-- Plugin description --> section from README.md and provide for the plugin's manifest
        description = providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
            val start = "<!-- Plugin description -->"
            val end = "<!-- Plugin description end -->"

            with(it.lines()) {
                if (!containsAll(listOf(start, end))) {
                    throw GradleException("Plugin description section not found in README.md:\n$start ... $end")
                }
                subList(indexOf(start) + 1, indexOf(end))
                    .joinToString("\n")
                    .replace("![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-intellij.png?raw=true)", "")
                    .let(::markdownToHTML)
            }
        }

        val changelog = project.changelog // local variable for configuration cache compatibility
        // Get the latest available change notes from the changelog file
        changeNotes = properties("pluginVersion").map { pluginVersion ->
            with(changelog) {
                renderItem(
                    (getOrNull(pluginVersion) ?: getUnreleased())
                        .withHeader(false)
                        .withEmptySections(false),
                    Changelog.OutputType.HTML,
                )
            }
        }

        ideaVersion {
            sinceBuild = properties("pluginSinceBuild")
            // Stay compatible with future IDE releases instead of pinning an upper bound.
            untilBuild = provider { null }
        }
    }

    signing {
        certificateChain = environment("CERTIFICATE_CHAIN")
        privateKey = environment("PRIVATE_KEY")
        password = environment("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = environment("PUBLISH_TOKEN")
        // The pluginVersion is based on the SemVer (https://semver.org) and supports pre-release labels, like 2.1.7-alpha.3
        // Specify pre-release label to publish the plugin in a custom Release Channel automatically. Read more:
        // https://plugins.jetbrains.com/docs/intellij/deployment.html#specifying-a-release-channel
        channels = properties("pluginVersion").map { listOf(it.split('-').getOrElse(1) { "default" }.split('.').first()) }
    }

    pluginVerification {
        ides {
            // Verify the two builds the compatibility range actually claims: the `pluginSinceBuild`
            // floor and the newest release. `recommended()` additionally pulls every intermediate
            // release, and each unified IntelliJ IDEA install is large enough to exhaust a CI runner.
            select {
                sinceBuild = properties("pluginSinceBuild")
                untilBuild = properties("pluginSinceBuild").map { "$it.*" }
            }
            latest()
        }
    }
}

// Configure Gradle Changelog Plugin - read more: https://github.com/JetBrains/gradle-changelog-plugin
changelog {
    groups.empty()
    repositoryUrl = properties("pluginRepositoryUrl")
    // The monorepo already carries `v*` tags for the editor itself, `v0.*` among them, whose
    // numbers a plugin version can share — a bare `v` prefix would render compare links that
    // resolve to unrelated releases rather than 404ing.
    versionPrefix = "intellij-plugin-v"
}

// Configure Gradle Kover Plugin - read more: https://github.com/Kotlin/kotlinx-kover#configuration
// The agent hub's core is measured per class, as the TypeScript packages are per file; the JCEF
// classes cannot run headless, and the Windows-only JNA code runs on Windows alone.
kover {
    reports {
        filters {
            includes {
                packages("com.github.dineug.erdeditorintellijplugin.hub")
            }
            excludes {
                classes("*.hub.transport.NamedPipe*", "*.hub.win.*")
            }
        }
        total {
            xml {
                onCheck = true
            }
        }
        verify {
            rule("hub core, per class") {
                groupBy = kotlinx.kover.gradle.plugin.dsl.GroupingEntityType.CLASS
                minBound(80, kotlinx.kover.gradle.plugin.dsl.CoverageUnit.LINE)
                minBound(80, kotlinx.kover.gradle.plugin.dsl.CoverageUnit.BRANCH)
            }
        }
    }
}

// The shared conformance corpora of packages/agent-hub and packages/agent-hub-host: the hub tests
// read the vectors the TypeScript hub is held to, so a change to either side shows up in both.
val hubCorpora = listOf(
    "../agent-hub/src/__fixtures__/conformance.json",
    "../agent-hub-host/src/__fixtures__/conformance.json",
)

tasks {
    // Build the webview bundle into src/main/resources/assets. `@dineug/erd-editor-intellij-webview`
    // writes there directly (its `build.outDir`), so this only saves the `cd` to the workspace
    // root. Not wired into `buildPlugin`: the bundle changes far less often than the Kotlin side,
    // and pnpm has no business running on every Gradle build.
    register<Exec>("buildWebview") {
        group = "build"
        description = "Builds the ERD Editor webview bundle from @dineug/erd-editor-intellij-webview."

        val workspace = layout.projectDirectory.dir("../..")
        workingDir = workspace.asFile

        doFirst {
            if (!workspace.file("pnpm-workspace.yaml").asFile.exists()) {
                throw GradleException(
                    "Expected the pnpm workspace root at ${workspace.asFile}, but pnpm-workspace.yaml is not there.",
                )
            }
        }

        commandLine(
            "pnpm",
            "exec",
            "vp",
            "run",
            "--filter",
            "@dineug/erd-editor-intellij-webview",
            "--fail-if-no-match",
            "build",
        )
    }

    // The webview bundle is gitignored and built by pnpm, so an absent one is the normal
    // state of a fresh clone — and Gradle would happily package the empty directory.
    // That failure is invisible until someone opens a diagram and gets a blank panel, so make
    // it a build failure instead.
    val verifyWebviewAssets = register("verifyWebviewAssets") {
        group = "verification"
        description = "Fails when the webview bundle is missing from src/main/resources/assets."

        val index = layout.projectDirectory.file("src/main/resources/assets/index.html").asFile
        doLast {
            if (!index.exists()) {
                throw GradleException(
                    "The webview bundle is missing from src/main/resources/assets, so the plugin " +
                        "would ship a blank editor. Run: ./gradlew buildWebview",
                )
            }
        }
    }

    buildPlugin {
        dependsOn(verifyWebviewAssets)
    }

    wrapper {
        gradleVersion = properties("gradleVersion").get()
    }

    test {
        inputs.files(hubCorpora).withPropertyName("hubCorpora").withPathSensitivity(PathSensitivity.RELATIVE)
        systemProperty("erd.hub.wireCorpus", file(hubCorpora[0]).absolutePath)
        systemProperty("erd.hub.hostCorpus", file(hubCorpora[1]).absolutePath)
        systemProperty("erd.hub.mainSources", file("src/main/kotlin").absolutePath)
        // HubImportsTest reads the hub's sources: an unused import changes no class file.
        inputs.dir("src/main/kotlin/com/github/dineug/erdeditorintellijplugin/hub")
            .withPropertyName("hubSources").withPathSensitivity(PathSensitivity.RELATIVE)
        // ErdEditorThemeTest holds the settings page's value lists to the ones the page picks from.
        val bridgeTheme = file("../webview-bridge/src/theme.ts")
        inputs.file(bridgeTheme).withPropertyName("bridgeTheme").withPathSensitivity(PathSensitivity.RELATIVE)
        systemProperty("erd.bridgeTheme", bridgeTheme.absolutePath)
    }

    // The POSIX-only suites skip on Windows by design, so their classes fall under the per-class
    // bound there; the gate is measured on macOS and Linux only.
    named("koverVerify") {
        onlyIf { !System.getProperty("os.name").startsWith("Windows") }
    }

    runIde {
        dependsOn(verifyWebviewAssets)
        systemProperty("idea.log.debug.categories", "com.github.dineug.erdeditorintellijplugin")
    }

    verifyPlugin {
        // Bound the Plugin Verifier heap explicitly; unbounded it gets killed under memory
        // pressure while unpacking the bundled Android plugin of a unified IntelliJ IDEA install.
        maxHeapSize = "4g"
    }

    publishPlugin {
        dependsOn(patchChangelog)
    }
}
