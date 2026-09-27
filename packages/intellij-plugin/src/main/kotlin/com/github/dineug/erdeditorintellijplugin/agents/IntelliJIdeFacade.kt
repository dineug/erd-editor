package com.github.dineug.erdeditorintellijplugin.agents

import com.github.dineug.erdeditorintellijplugin.hub.Authz
import com.github.dineug.erdeditorintellijplugin.hub.HubPaths
import com.github.dineug.erdeditorintellijplugin.hub.HubPlatform
import com.github.dineug.erdeditorintellijplugin.hub.HubThreads
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentFile
import com.github.dineug.erdeditorintellijplugin.hub.document.DocumentRules
import com.github.dineug.erdeditorintellijplugin.hub.document.IdeFacade
import com.github.dineug.erdeditorintellijplugin.hub.document.OpenRefused
import com.github.dineug.erdeditorintellijplugin.hub.document.ProjectTrust
import com.intellij.ide.trustedProjects.TrustedProjects
import com.intellij.openapi.application.ApplicationNamesInfo
import com.intellij.openapi.application.EDT
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.application.asContextElement
import com.intellij.openapi.application.readAction
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.roots.ContentIterator
import com.intellij.openapi.roots.ProjectFileIndex
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileFilter
import com.intellij.openapi.wm.IdeFocusManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.nio.file.Path
import java.util.Locale

/**
 * What the hub's handlers ask of the IDE: open a file in an ERD editor without taking focus, list the
 * ERD files of the open projects, and read which projects the user trusts. Nothing here runs on the
 * registry thread's time: file system work and read actions go to io, opening a tab to the EDT.
 */
class IntelliJIdeFacade(
    private val host: IntelliJHubHost,
    private val authz: Authz?,
    private val threads: HubThreads,
    private val platform: HubPlatform,
) : IdeFacade {
    override val editorName: String get() = ApplicationNamesInfo.getInstance().fullProductName

    /**
     * Opens path in the project already showing it, else the one whose folder holds it deepest, else
     * the last focused one, as that project's tree spells it, since the VFS keys a file by its path. The
     * open waits out a modal dialog; the handler answers by its own timeout.
     */
    override suspend fun openInEditor(path: String, known: DocumentFile?) {
        val (spelled, fallback, candidates) = withContext(threads.io) {
            val candidates = host.openProjectRoots().map { (project, roots) ->
                project to roots.map { SpelledFolder(it, realpathOrSelf(it)) }
            }
            // The file already registered on the path, perhaps opened through a symlink, is opened as it is.
            val registered = (known as? VirtualFileDocument)?.file?.takeIf { it.isValid }
            val found = HashMap<String, VirtualFile?>()
            val spelled = if (registered != null) {
                emptyMap()
            } else {
                candidates.mapNotNull { (project, folders) ->
                    val spelling = spelledUnder(folders, path, platform) ?: return@mapNotNull null
                    if (spelling !in found) found[spelling] = findFile(spelling)
                    found[spelling]?.let { project to it }
                }.toMap()
            }
            val fallback = registered
                ?: spelled.values.firstOrNull()
                ?: findFile(path)
                ?: throw OpenRefused(DocumentRules.REASON_NO_VIRTUAL_FILE)
            Triple(spelled, fallback, candidates)
        }
        withContext(Dispatchers.EDT + ModalityState.nonModal().asContextElement()) {
            val open = ProjectManager.getInstance().openProjects.filter { !it.isDisposed && !it.isDefault }
            val lastFocused = IdeFocusManager.getGlobalInstance().lastFocusedFrame?.project?.takeIf { it in open }
            val fileOf = { owner: Project -> spelled[owner] ?: fallback }
            val realFolders = candidates.filter { it.first in open }.map { (owner, folders) ->
                owner to folders.map { it.real }
            }
            val project = open.firstOrNull { FileEditorManager.getInstance(it).isFileOpen(fileOf(it)) }
                ?: chooseProject(realFolders, path, lastFocused, platform)
                ?: lastFocused
                ?: open.firstOrNull()
                ?: throw OpenRefused(DocumentRules.REASON_NO_PROJECT)
            FileEditorManager.getInstance(project).openFile(fileOf(project), false)
        }
    }

    private fun findFile(path: String): VirtualFile? =
        LocalFileSystem.getInstance().refreshAndFindFileByNioFile(Path.of(path))

    /**
     * Every ERD file of the open projects' content, node_modules left out, by local path, each once.
     * The name is checked before the path is built, since a large project has many files.
     */
    override suspend fun listErdFiles(): List<String> = withContext(threads.io) {
        readAction {
            // A write restarts the read action, so each attempt starts from nothing.
            val found = LinkedHashSet<String>()
            val collect = ContentIterator { file ->
                ProgressManager.checkCanceled()
                if (!file.isDirectory && file.isInLocalFileSystem && isListedErdName(file.name)) {
                    found += file.toNioPath().toString()
                }
                true
            }
            for (project in ProjectManager.getInstance().openProjects) {
                project.whileOpen { ProjectFileIndex.getInstance(project).iterateContent(collect, SKIP_NODE_MODULES) }
            }
            found.toList()
        }
    }

    /** Every open project now, its folders realpathed, its trust read once; on io. */
    override suspend fun trustedProjects(): List<ProjectTrust> = withContext(threads.io) {
        host.openProjectRoots().map { (project, roots) ->
            ProjectTrust(roots.map(::realpathOrSelf), isTrusted(project))
        }
    }

    /** Any failure counts untrusted, so a write is refused rather than let through. */
    private suspend fun isTrusted(project: Project): Boolean = try {
        TrustedProjects.isProjectTrusted(project)
    } catch (e: Throwable) {
        currentCoroutineContext().ensureActive()
        false
    }

    private fun realpathOrSelf(path: String): String = authz?.realpathOrSelf(path) ?: path

    private companion object {
        const val NODE_MODULES = "node_modules"

        /** Prunes every folder named node_modules, whatever lies under it. */
        val SKIP_NODE_MODULES = VirtualFileFilter { !(it.isDirectory && it.name == NODE_MODULES) }
    }
}

/** A project folder as the IDE spells it, and its real path. */
internal data class SpelledFolder(val spelled: String, val real: String)

/**
 * realPath as the folders spell it: the names below the deepest real folder holding it, the first on
 * a tie, joined onto that folder's spelling, so they keep the disk's letter case; null when no folder
 * holds it.
 */
internal fun spelledUnder(folders: List<SpelledFolder>, realPath: String, platform: HubPlatform): String? {
    val index = HubPaths.longestPrefixIndex(folders.map { it.real }, realPath, platform)
    if (index == -1) return null

    val folder = folders[index]
    val names = HubPaths.toSegments(realPath, platform).drop(HubPaths.toSegments(folder.real, platform).size)
    if (names.isEmpty()) return folder.spelled
    val separator = if (platform.isWindows) "\\" else "/"
    return folder.spelled.trimEnd('\\', '/') + separator + names.joinToString(separator)
}

/**
 * The project to open realPath in: the one with the deepest real folder holding it, the last focused
 * one among those that tie, else the first of them; null when no folder holds it.
 */
internal fun <P> chooseProject(
    candidates: List<Pair<P, List<String>>>,
    realPath: String,
    lastFocused: P?,
    platform: HubPlatform,
): P? {
    var deepest = -1
    val best = ArrayList<P>()
    for ((project, folders) in candidates) {
        val depth = folders
            .filter { HubPaths.isInside(it, realPath, platform) }
            .maxOfOrNull { HubPaths.toSegments(it, platform).size } ?: continue
        if (depth > deepest) {
            deepest = depth
            best.clear()
        }
        if (depth == deepest) best += project
    }
    return if (lastFocused != null && lastFocused in best) lastFocused else best.firstOrNull()
}

/** The extensions the hub serves, whatever their letter case, as it refuses every other name. */
internal fun isListedErdName(name: String): Boolean {
    val lowercase = name.lowercase(Locale.ROOT)
    return DocumentRules.ERD_FILE_EXTENSIONS.any { lowercase.endsWith(".$it") }
}
