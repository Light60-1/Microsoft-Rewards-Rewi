/* eslint-disable linebreak-style */
/**
 * Smart Auto-Update Script v2
 * 
 * Supports two update methods:
 * 1. Git method (--git): Uses Git commands, requires Git installed
 * 2. GitHub API method (--no-git): Downloads ZIP, no Git needed, no conflicts (RECOMMENDED)
 * 
 * Intelligently updates while preserving user settings:
 * - ALWAYS updates code files (*.ts, *.js, etc.)
 * - Respects config.jsonc update preferences
 * - ALWAYS preserves accounts files (unless explicitly configured)
 *
 * Usage:
 *   node setup/update/update.mjs               # Auto-detect method from config
 *   node setup/update/update.mjs --git         # Force Git method
 *   node setup/update/update.mjs --no-git      # Force GitHub API method
 *   node setup/update/update.mjs --docker      # Update Docker containers
 */

import { execSync, spawn } from 'node:child_process'
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { get as httpsGet } from 'node:https'
import { dirname, join } from 'node:path'

function stripJsonComments(input) {
  let result = ""
  let inString = false
  let stringChar = ""
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const next = input[i + 1]

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false
        result += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        i++
      }
      continue
    }

    if (inString) {
      result += char
      if (char === "\\") {
        i++
        if (i < input.length) result += input[i]
        continue
      }
      if (char === stringChar) inString = false
      continue
    }

    if (char === "\"" || char === "'") {
      inString = true
      stringChar = char
      result += char
      continue
    }

    if (char === "/" && next === "/") {
      inLineComment = true
      i++
      continue
    }

    if (char === "/" && next === "*") {
      inBlockComment = true
      i++
      continue
    }

    result += char
  }

  return result
}

function readJsonConfig(preferredPaths) {
  for (const candidate of preferredPaths) {
    if (!existsSync(candidate)) continue
    try {
      const raw = readFileSync(candidate, "utf8").replace(/^\uFEFF/, "")
      return JSON.parse(stripJsonComments(raw))
    } catch {
      // Try next candidate on parse errors
    }
  }
  return null
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
    child.on('close', (code) => resolve(code ?? 0))
    child.on('error', () => resolve(1))
  })
}

async function which(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  const code = await run(probe, [cmd], { stdio: 'ignore' })
  return code === 0
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

function hasUnresolvedConflicts() {
  // Check for unmerged files
  const unmerged = exec('git ls-files -u')
  if (unmerged) {
    return { hasConflicts: true, files: unmerged.split('\n').filter(Boolean) }
  }
  
  // Check if in middle of merge/rebase
  const gitDir = exec('git rev-parse --git-dir')
  if (gitDir) {
    const mergePath = join(gitDir, 'MERGE_HEAD')
    const rebasePath = join(gitDir, 'rebase-merge')
    const rebaseApplyPath = join(gitDir, 'rebase-apply')
    
    if (existsSync(mergePath) || existsSync(rebasePath) || existsSync(rebaseApplyPath)) {
      return { hasConflicts: true, files: ['merge/rebase in progress'] }
    }
  }
  
  return { hasConflicts: false, files: [] }
}

function abortAllGitOperations() {
  console.log('Aborting any ongoing Git operations...')
  
  // Try to abort merge
  exec('git merge --abort')
  
  // Try to abort rebase
  exec('git rebase --abort')
  
  // Try to abort cherry-pick
  exec('git cherry-pick --abort')
  
  console.log('Git operations aborted.')
}

async function updateGit() {
  const hasGit = await which('git')
  if (!hasGit) {
    console.log('Git not found. Skipping update.')
    return 1
  }

  console.log('\n' + '='.repeat(60))
  console.log('Smart Git Update')
  console.log('='.repeat(60))

  // Step 0: Pre-flight checks
  const conflictCheck = hasUnresolvedConflicts()
  if (conflictCheck.hasConflicts) {
    console.log('\n⚠️  ERROR: Git repository has unresolved conflicts!')
    console.log('Conflicted files:')
    conflictCheck.files.forEach(f => console.log(`  - ${f}`))
    console.log('\n🔧 Attempting automatic resolution...')
    
    abortAllGitOperations()
    
    const recheckConflicts = hasUnresolvedConflicts()
    if (recheckConflicts.hasConflicts) {
      console.log('\n❌ Could not automatically resolve conflicts.')
      console.log('Manual intervention required. Please run:')
      console.log('  git status')
      console.log('  git reset --hard origin/main  # WARNING: This will discard ALL local changes')
      console.log('\nUpdate aborted for safety.')
      return 1
    }
    
    console.log('✓ Conflicts cleared. Continuing...\n')
  }
  
  // Pre-flight: Check if repo is clean enough to proceed
  const isDirty = exec('git diff --quiet')
  const hasUntracked = exec('git ls-files --others --exclude-standard')
  if (isDirty === null && hasUntracked) {
    console.log('ℹ️  Repository has local changes, will preserve user files during update.')
  }

  // Step 1: Read config to get user preferences
  let userConfig = { autoUpdateConfig: false, autoUpdateAccounts: false }
  const configData = readJsonConfig([
    "src/config.jsonc",
    "config.jsonc",
    "src/config.json",
    "config.json"
  ])

  if (!configData) {
    console.log('Warning: Could not read config.jsonc, using defaults (preserve local files)')
  } else if (configData.update) {
    userConfig.autoUpdateConfig = configData.update.autoUpdateConfig ?? false
    userConfig.autoUpdateAccounts = configData.update.autoUpdateAccounts ?? false
  }

  console.log('\nUser preferences:')
  console.log(`  Auto-update config.jsonc: ${userConfig.autoUpdateConfig}`)
  console.log(`  Auto-update accounts.json: ${userConfig.autoUpdateAccounts}`)

  // Step 2: Get current branch
  const currentBranch = exec('git branch --show-current')
  if (!currentBranch) {
    console.log('Could not determine current branch.')
    return 1
  }
  
  // Fetch latest changes
  console.log('\n🌐 Fetching latest changes...')
  await run('git', ['fetch', '--all', '--prune'])

  // Step 3: Backup user files BEFORE any git operations
  const backupDir = join(process.cwd(), '.update-backup')
  mkdirSync(backupDir, { recursive: true })
  
  const userFiles = []
  
  if (existsSync('src/config.jsonc')) {
    console.log('\n📦 Backing up config.jsonc...')
    const configContent = readFileSync('src/config.jsonc', 'utf8')
    writeFileSync(join(backupDir, 'config.jsonc.bak'), configContent)
    if (!userConfig.autoUpdateConfig) {
      userFiles.push({ path: 'src/config.jsonc', content: configContent })
    }
  }

  if (existsSync('src/accounts.jsonc')) {
    console.log('📦 Backing up accounts.jsonc...')
    const accountsContent = readFileSync('src/accounts.jsonc', 'utf8')
    writeFileSync(join(backupDir, 'accounts.jsonc.bak'), accountsContent)
    if (!userConfig.autoUpdateAccounts) {
      userFiles.push({ path: 'src/accounts.jsonc', content: accountsContent })
    }
  }
  
  if (existsSync('src/accounts.json')) {
    console.log('📦 Backing up accounts.json...')
    const accountsJsonContent = readFileSync('src/accounts.json', 'utf8')
    writeFileSync(join(backupDir, 'accounts.json.bak'), accountsJsonContent)
    if (!userConfig.autoUpdateAccounts) {
      userFiles.push({ path: 'src/accounts.json', content: accountsJsonContent })
    }
  }

  // Show what will happen
  console.log('\n📋 Update strategy:')
  console.log(`  config.jsonc: ${userConfig.autoUpdateConfig ? '🔄 WILL UPDATE from remote' : '🔒 KEEPING YOUR LOCAL VERSION'}`)
  console.log(`  accounts: ${userConfig.autoUpdateAccounts ? '🔄 WILL UPDATE from remote' : '🔒 KEEPING YOUR LOCAL VERSION (always)'}`)
  console.log('  Other files: 🔄 will update from remote')

  // Step 4: Use merge strategy to avoid conflicts
  // Instead of stash, we'll use a better approach:
  // 1. Reset to remote (get clean state)
  // 2. Then restore user files manually
  
  console.log('\n🔄 Applying updates (using smart merge strategy)...')
  
  // Save current commit for potential rollback
  const currentCommit = exec('git rev-parse HEAD')
  
  // Check if we're behind
  const remoteBranch = `origin/${currentBranch}`
  const behindCount = exec(`git rev-list --count HEAD..${remoteBranch}`)
  
  if (!behindCount || behindCount === '0') {
    console.log('✓ Already up to date!')
    // FIXED: Return 0 but DON'T create update marker (no restart needed)
    return 0
  }
  
  console.log(`ℹ️  ${behindCount} commits behind remote`)
  
  // MARK: Update is happening - create marker file for bot to detect
  const updateMarkerPath = join(process.cwd(), '.update-happened')
  writeFileSync(updateMarkerPath, `Updated from ${currentCommit} to latest at ${new Date().toISOString()}`)
  
  // Use merge with strategy to accept remote changes for all files
  // We'll restore user files afterwards
  const mergeCode = await run('git', ['merge', '--strategy-option=theirs', remoteBranch])
  
  if (mergeCode !== 0) {
    console.log('\n⚠️  Merge failed, trying reset strategy...')
    
    // Abort merge
    exec('git merge --abort')
    
    // Try reset + restore approach instead
    const resetCode = await run('git', ['reset', '--hard', remoteBranch])
    
    if (resetCode !== 0) {
      console.log('\n❌ Update failed!')
      console.log('🔙 Rolling back to previous state...')
      await run('git', ['reset', '--hard', currentCommit])
      
      // Restore user files from backup
      for (const file of userFiles) {
        writeFileSync(file.path, file.content)
      }
      
      console.log('✓ Rolled back successfully. Your files are safe.')
      return 1
    }
  }
  
  // Step 5: Restore user files
  if (userFiles.length > 0) {
    console.log('\n🔒 Restoring your protected files...')
    for (const file of userFiles) {
      try {
        writeFileSync(file.path, file.content)
        console.log(`  ✓ Restored ${file.path}`)
      } catch (err) {
        console.log(`  ⚠️  Failed to restore ${file.path}: ${err.message}`)
      }
    }
  }
  
  // Clean the git state (remove any leftover merge markers or conflicts)
  exec('git reset HEAD .')
  exec('git checkout -- .')

  // Step 6: Install & build
  const hasNpm = await which('npm')
  if (!hasNpm) return 0

  console.log('\nInstalling dependencies...')
  await run('npm', ['ci'])
  
  console.log('\nBuilding project...')
  const buildCode = await run('npm', ['run', 'build'])

  console.log('\n' + '='.repeat(60))
  console.log('Update completed!')
  console.log('='.repeat(60) + '\n')

  return buildCode
}

/**
 * Git-free update using GitHub API
 * Downloads latest code as ZIP, extracts, and selectively copies files
 * Preserves user config and accounts
 */
async function updateGitFree() {
  console.log('\n' + '='.repeat(60))
  console.log('Git-Free Smart Update (GitHub API)')
  console.log('='.repeat(60))
  
  // Step 1: Read user preferences
  let userConfig = { autoUpdateConfig: false, autoUpdateAccounts: false }
  const configData = readJsonConfig([
    "src/config.jsonc",
    "config.jsonc",
    "src/config.json",
    "config.json"
  ])

  if (configData?.update) {
    userConfig.autoUpdateConfig = configData.update.autoUpdateConfig ?? false
    userConfig.autoUpdateAccounts = configData.update.autoUpdateAccounts ?? false
  }

  console.log('\n📋 User preferences:')
  console.log(`  Auto-update config.jsonc: ${userConfig.autoUpdateConfig}`)
  console.log(`  Auto-update accounts: ${userConfig.autoUpdateAccounts}`)
  
  // Step 2: Backup user files
  const backupDir = join(process.cwd(), '.update-backup-gitfree')
  mkdirSync(backupDir, { recursive: true })
  
  const filesToPreserve = [
    { src: 'src/config.jsonc', preserve: !userConfig.autoUpdateConfig },
    { src: 'src/accounts.jsonc', preserve: !userConfig.autoUpdateAccounts },
    { src: 'src/accounts.json', preserve: !userConfig.autoUpdateAccounts },
    { src: 'sessions', preserve: true, isDir: true },
    { src: '.update-backup', preserve: true, isDir: true }
  ]
  
  console.log('\n📦 Backing up protected files...')
  for (const file of filesToPreserve) {
    if (!file.preserve) continue
    const srcPath = join(process.cwd(), file.src)
    if (!existsSync(srcPath)) continue
    
    const destPath = join(backupDir, file.src)
    mkdirSync(dirname(destPath), { recursive: true })
    
    try {
      if (file.isDir) {
        cpSync(srcPath, destPath, { recursive: true })
        console.log(`  ✓ Backed up ${file.src}/ (directory)`)
      } else {
        writeFileSync(destPath, readFileSync(srcPath))
        console.log(`  ✓ Backed up ${file.src}`)
      }
    } catch (err) {
      console.log(`  ⚠️  Could not backup ${file.src}: ${err.message}`)
    }
  }
  
  // Step 3: Download latest code from GitHub
  const repoOwner = 'Obsidian-wtf' // Change to your repo
  const repoName = 'Microsoft-Rewards-Bot'
  const branch = 'main'
  
  const archiveUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/${branch}.zip`
  const archivePath = join(process.cwd(), '.update-download.zip')
  const extractDir = join(process.cwd(), '.update-extract')
  
  console.log(`\n🌐 Downloading latest code from GitHub...`)
  console.log(`   ${archiveUrl}`)
  
  try {
    // Download with built-in https
    await downloadFile(archiveUrl, archivePath)
    console.log('✓ Download complete')
  } catch (err) {
    console.log(`❌ Download failed: ${err.message}`)
    console.log('Please check your internet connection and try again.')
    return 1
  }
  
  // Step 4: Extract archive
  console.log('\n📂 Extracting archive...')
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })
  
  try {
    // Use built-in unzip or cross-platform solution
    await extractZip(archivePath, extractDir)
    console.log('✓ Extraction complete')
  } catch (err) {
    console.log(`❌ Extraction failed: ${err.message}`)
    return 1
  }
  
  // Step 5: Find extracted folder (GitHub adds repo name prefix)
  const extractedItems = readdirSync(extractDir)
  const extractedRepoDir = extractedItems.find(item => item.startsWith(repoName))
  if (!extractedRepoDir) {
    console.log('❌ Could not find extracted repository folder')
    return 1
  }
  
  const sourceDir = join(extractDir, extractedRepoDir)
  
  // Step 6: Copy files selectively
  console.log('\n📋 Updating files...')
  const filesToUpdate = [
    'src',
    'docs',
    'setup',
    'public',
    'tests',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'Dockerfile',
    'compose.yaml',
    'README.md',
    'LICENSE'
  ]
  
  for (const item of filesToUpdate) {
    const srcPath = join(sourceDir, item)
    const destPath = join(process.cwd(), item)
    
    if (!existsSync(srcPath)) continue
    
    // Skip if it's a protected file
    const isProtected = filesToPreserve.some(f => 
      f.preserve && (destPath.includes(f.src) || f.src === item)
    )
    if (isProtected) {
      console.log(`  ⏭️  Skipping ${item} (protected)`)
      continue
    }
    
    try {
      // Remove old first
      if (existsSync(destPath)) {
        rmSync(destPath, { recursive: true, force: true })
      }
      // Copy new
      if (statSync(srcPath).isDirectory()) {
        cpSync(srcPath, destPath, { recursive: true })
        console.log(`  ✓ Updated ${item}/ (directory)`)
      } else {
        cpSync(srcPath, destPath)
        console.log(`  ✓ Updated ${item}`)
      }
    } catch (err) {
      console.log(`  ⚠️  Failed to update ${item}: ${err.message}`)
    }
  }
  
  // Step 7: Restore protected files
  console.log('\n🔒 Restoring protected files...')
  for (const file of filesToPreserve) {
    if (!file.preserve) continue
    const backupPath = join(backupDir, file.src)
    if (!existsSync(backupPath)) continue
    
    const destPath = join(process.cwd(), file.src)
    mkdirSync(dirname(destPath), { recursive: true })
    
    try {
      if (file.isDir) {
        rmSync(destPath, { recursive: true, force: true })
        cpSync(backupPath, destPath, { recursive: true })
        console.log(`  ✓ Restored ${file.src}/ (directory)`)
      } else {
        writeFileSync(destPath, readFileSync(backupPath))
        console.log(`  ✓ Restored ${file.src}`)
      }
    } catch (err) {
      console.log(`  ⚠️  Failed to restore ${file.src}: ${err.message}`)
    }
  }
  
  // Step 8: Cleanup
  console.log('\n🧹 Cleaning up temporary files...')
  rmSync(archivePath, { force: true })
  rmSync(extractDir, { recursive: true, force: true })
  console.log('✓ Cleanup complete')
  
  // MARK: Update happened - create marker file for bot to detect restart
  const updateMarkerPath = join(process.cwd(), '.update-happened')
  writeFileSync(updateMarkerPath, `Git-free update completed at ${new Date().toISOString()}`)
  console.log('✓ Created update marker for bot restart detection')
  
  // Step 9: Install & build
  const hasNpm = await which('npm')
  if (!hasNpm) {
    console.log('\n✓ Update completed! (npm not found, skipping dependencies)')
    return 0
  }

  console.log('\n📦 Installing dependencies...')
  await run('npm', ['ci'])
  
  console.log('\n🔨 Building project...')
  const buildCode = await run('npm', ['run', 'build'])

  console.log('\n' + '='.repeat(60))
  console.log('✓ Git-Free Update Completed Successfully!')
  console.log('='.repeat(60) + '\n')

  return buildCode
}

/**
 * Download file using Node.js built-in https
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    
    httpsGet(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close()
        rmSync(dest, { force: true })
        downloadFile(response.headers.location, dest).then(resolve).catch(reject)
        return
      }
      
      if (response.statusCode !== 200) {
        file.close()
        rmSync(dest, { force: true })
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      rmSync(dest, { force: true })
      reject(err)
    })
  })
}

/**
 * Extract ZIP file (cross-platform)
 * Uses built-in or fallback methods
 */
async function extractZip(zipPath, destDir) {
  // Try using unzip command (Unix-like systems)
  const hasUnzip = await which('unzip')
  if (hasUnzip) {
    const code = await run('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'ignore' })
    if (code === 0) return
  }
  
  // Try using tar (works on modern Windows 10+)
  const hasTar = await which('tar')
  if (hasTar) {
    const code = await run('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'ignore' })
    if (code === 0) return
  }
  
  // Try using PowerShell Expand-Archive (Windows)
  if (process.platform === 'win32') {
    const code = await run('powershell', ['-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`], { stdio: 'ignore' })
    if (code === 0) return
  }
  
  throw new Error('No suitable extraction tool found (unzip, tar, or PowerShell)')
}

async function updateDocker() {
  const hasDocker = await which('docker')
  if (!hasDocker) return 1
  // Prefer compose v2 (docker compose)
  await run('docker', ['compose', 'pull'])
  return run('docker', ['compose', 'up', '-d'])
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const forceGit = args.has('--git')
  const forceGitFree = args.has('--no-git') || args.has('--zip')
  const doDocker = args.has('--docker')

  let code = 0
  
  // If no method specified, read from config
  let useGitFree = forceGitFree
  let useGit = forceGit
  
  if (!forceGit && !forceGitFree && !doDocker) {
    // Read config to determine preferred method
    const configData = readJsonConfig([
      "src/config.jsonc",
      "config.jsonc",
      "src/config.json",
      "config.json"
    ])
    
    if (configData?.update) {
      const updateEnabled = configData.update.enabled !== false
      const method = configData.update.method || 'github-api'
      
      if (!updateEnabled) {
        console.log('⚠️  Updates are disabled in config.jsonc (update.enabled = false)')
        console.log('To enable updates, set "update.enabled" to true in your config.jsonc')
        return 0
      }
      
      if (method === 'github-api' || method === 'api' || method === 'zip') {
        console.log('📋 Config prefers GitHub API method (update.method = "github-api")')
        useGitFree = true
      } else if (method === 'git') {
        console.log('📋 Config prefers Git method (update.method = "git")')
        useGit = true
      } else {
        console.log(`⚠️  Unknown update method "${method}" in config, defaulting to GitHub API`)
        useGitFree = true
      }
    } else {
      // No config found or no update section, default to GitHub API
      console.log('📋 No update preferences in config, using GitHub API method (recommended)')
      useGitFree = true
    }
  }
  
  // Execute chosen method
  if (useGitFree) {
    console.log('🚀 Starting update with GitHub API method (no Git conflicts)...\n')
    code = await updateGitFree()
  } else if (useGit) {
    // Check if git is available, fallback to git-free if not
    const hasGit = await which('git')
    if (!hasGit) {
      console.log('⚠️  Git not found, falling back to GitHub API method\n')
      code = await updateGitFree()
    } else {
      console.log('🚀 Starting update with Git method...\n')
      code = await updateGit()
    }
  } else {
    // No method chosen, show usage
    console.log('Microsoft Rewards Bot - Update Script')
    console.log('=' .repeat(60))
    console.log('')
    console.log('Usage:')
    console.log('  node setup/update/update.mjs              # Auto-detect from config.jsonc')
    console.log('  node setup/update/update.mjs --git        # Force Git method')
    console.log('  node setup/update/update.mjs --no-git     # Force GitHub API method')
    console.log('  node setup/update/update.mjs --docker     # Update Docker containers')
    console.log('')
    console.log('Update methods:')
    console.log('  • GitHub API (--no-git): Downloads ZIP from GitHub')
    console.log('    ✓ No Git required')
    console.log('    ✓ No merge conflicts')
    console.log('    ✓ Works even if Git repo is broken')
    console.log('    ✓ Recommended for most users')
    console.log('')
    console.log('  • Git (--git): Uses Git pull/merge')
    console.log('    ✓ Preserves Git history')
    console.log('    ✓ Faster for small changes')
    console.log('    ✗ Requires Git installed')
    console.log('    ✗ May have merge conflicts')
    console.log('')
    console.log('Configuration:')
    console.log('  Edit src/config.jsonc to set your preferred method:')
    console.log('  "update": {')
    console.log('    "enabled": true,')
    console.log('    "method": "github-api"  // or "git"')
    console.log('  }')
    console.log('')
    return 0
  }
  
  if (doDocker && code === 0) {
    code = await updateDocker()
  }
  
  // Return exit code to parent process
  process.exit(code)
}

main().catch((err) => {
  console.error('Update script error:', err)
  process.exit(1)
})
