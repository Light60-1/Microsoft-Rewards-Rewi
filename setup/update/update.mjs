#!/usr/bin/env node
/**
 * Microsoft Rewards Bot - Automatic Update System
 * 
 * Uses GitHub API to download latest code as ZIP archive.
 * No Git required, no merge conflicts, always clean.
 * 
 * Features:
 *  - Downloads latest code from GitHub (ZIP)
 *  - Preserves user files (accounts, config, sessions)
 *  - Selective file copying
 *  - Automatic dependency installation
 *  - TypeScript rebuild
 * 
 * Usage:
 *   node setup/update/update.mjs        # Run update
 *   npm run start                       # Bot runs this automatically if enabled
 */

import { spawn } from 'node:child_process'
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { get as httpsGet } from 'node:https'
import { dirname, join } from 'node:path'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Strip JSON comments
 */
function stripJsonComments(input) {
  let result = ''
  let inString = false
  let stringChar = ''
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const next = input[i + 1]

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false
        result += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }

    if (inString) {
      result += char
      if (char === '\\') {
        i++
        if (i < input.length) result += input[i]
        continue
      }
      if (char === stringChar) inString = false
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringChar = char
      result += char
      continue
    }

    if (char === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }

    if (char === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }

    result += char
  }

  return result
}

/**
 * Read and parse JSON config file
 */
function readJsonConfig(preferredPaths) {
  for (const candidate of preferredPaths) {
    if (!existsSync(candidate)) continue
    try {
      const raw = readFileSync(candidate, 'utf8').replace(/^\uFEFF/, '')
      return JSON.parse(stripJsonComments(raw))
    } catch {
      // Try next candidate
    }
  }
  return null
}

/**
 * Run shell command
 */
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { 
      stdio: 'inherit', 
      shell: process.platform === 'win32', 
      ...opts 
    })
    child.on('close', (code) => resolve(code ?? 0))
    child.on('error', () => resolve(1))
  })
}

/**
 * Check if command exists
 */
async function which(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  const code = await run(probe, [cmd], { stdio: 'ignore' })
  return code === 0
}

/**
 * Download file via HTTPS
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
 */
async function extractZip(zipPath, destDir) {
  // Try unzip (Unix-like)
  if (await which('unzip')) {
    const code = await run('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'ignore' })
    if (code === 0) return
  }
  
  // Try tar (modern Windows/Unix)
  if (await which('tar')) {
    const code = await run('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'ignore' })
    if (code === 0) return
  }
  
  // Try PowerShell Expand-Archive (Windows)
  if (process.platform === 'win32') {
    const code = await run('powershell', [
      '-Command', 
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
    ], { stdio: 'ignore' })
    if (code === 0) return
  }
  
  throw new Error('No extraction tool found (unzip, tar, or PowerShell required)')
}

// =============================================================================
// MAIN UPDATE LOGIC
// =============================================================================

/**
 * Perform update using GitHub API (ZIP download)
 */
async function performUpdate() {
  console.log('\n' + '='.repeat(70))
  console.log('🚀 Microsoft Rewards Bot - Automatic Update')
  console.log('='.repeat(70))
  
  // Step 1: Read user preferences
  console.log('\n📋 Reading configuration...')
  const configData = readJsonConfig([
    'src/config.jsonc',
    'config.jsonc',
    'src/config.json',
    'config.json'
  ])

  const userConfig = {
    autoUpdateConfig: configData?.update?.autoUpdateConfig ?? false,
    autoUpdateAccounts: configData?.update?.autoUpdateAccounts ?? false
  }

  console.log(`   • Auto-update config.jsonc: ${userConfig.autoUpdateConfig ? 'YES' : 'NO (protected)'}`)
  console.log(`   • Auto-update accounts: ${userConfig.autoUpdateAccounts ? 'YES' : 'NO (protected)'}`)
  
  // Step 2: Backup protected files
  console.log('\n🔒 Backing up protected files...')
  const backupDir = join(process.cwd(), '.update-backup')
  mkdirSync(backupDir, { recursive: true })
  
  const filesToProtect = [
    { path: 'src/config.jsonc', protect: !userConfig.autoUpdateConfig },
    { path: 'src/accounts.jsonc', protect: !userConfig.autoUpdateAccounts },
    { path: 'src/accounts.json', protect: !userConfig.autoUpdateAccounts },
    { path: 'sessions', protect: true, isDir: true },
    { path: '.playwright-chromium-installed', protect: true }
  ]
  
  const backedUp = []
  for (const file of filesToProtect) {
    if (!file.protect) continue
    const srcPath = join(process.cwd(), file.path)
    if (!existsSync(srcPath)) continue
    
    const destPath = join(backupDir, file.path)
    mkdirSync(dirname(destPath), { recursive: true })
    
    try {
      if (file.isDir) {
        cpSync(srcPath, destPath, { recursive: true })
      } else {
        writeFileSync(destPath, readFileSync(srcPath))
      }
      backedUp.push(file)
      console.log(`   ✓ ${file.path}${file.isDir ? '/' : ''}`)
    } catch (err) {
      console.log(`   ⚠️  Could not backup ${file.path}: ${err.message}`)
    }
  }
  
  // Step 3: Download latest code from GitHub
  console.log('\n🌐 Downloading latest code from GitHub...')
  const repoOwner = 'Obsidian-wtf'
  const repoName = 'Microsoft-Rewards-Bot'
  const branch = 'main'
  const archiveUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/${branch}.zip`
  
  const archivePath = join(process.cwd(), '.update-download.zip')
  const extractDir = join(process.cwd(), '.update-extract')
  
  console.log(`   ${archiveUrl}`)
  
  try {
    await downloadFile(archiveUrl, archivePath)
    console.log('   ✓ Download complete')
  } catch (err) {
    console.log(`\n❌ Download failed: ${err.message}`)
    console.log('Please check your internet connection and try again.')
    return 1
  }
  
  // Step 4: Extract archive
  console.log('\n📂 Extracting archive...')
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })
  
  try {
    await extractZip(archivePath, extractDir)
    console.log('   ✓ Extraction complete')
  } catch (err) {
    console.log(`\n❌ Extraction failed: ${err.message}`)
    console.log('Please ensure you have unzip, tar, or PowerShell available.')
    return 1
  }
  
  // Step 5: Find extracted folder
  const extractedItems = readdirSync(extractDir)
  const extractedRepoDir = extractedItems.find(item => item.startsWith(repoName))
  if (!extractedRepoDir) {
    console.log('\n❌ Could not find extracted repository folder')
    return 1
  }
  
  const sourceDir = join(extractDir, extractedRepoDir)
  
  // Step 6: Copy files selectively
  console.log('\n📦 Updating files...')
  const itemsToUpdate = [
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
    'entrypoint.sh',
    'run.sh',
    'README.md',
    'LICENSE'
  ]
  
  let updatedCount = 0
  for (const item of itemsToUpdate) {
    const srcPath = join(sourceDir, item)
    const destPath = join(process.cwd(), item)
    
    if (!existsSync(srcPath)) continue
    
    // Skip protected items
    const isProtected = backedUp.some(f => f.path === item || destPath.includes(f.path))
    if (isProtected) {
      console.log(`   ⏭️  ${item} (protected)`)
      continue
    }
    
    try {
      if (existsSync(destPath)) {
        rmSync(destPath, { recursive: true, force: true })
      }
      
      if (statSync(srcPath).isDirectory()) {
        cpSync(srcPath, destPath, { recursive: true })
        console.log(`   ✓ ${item}/`)
      } else {
        cpSync(srcPath, destPath)
        console.log(`   ✓ ${item}`)
      }
      updatedCount++
    } catch (err) {
      console.log(`   ⚠️  Failed to update ${item}: ${err.message}`)
    }
  }
  
  // Step 7: Restore protected files
  if (backedUp.length > 0) {
    console.log('\n🔐 Restoring protected files...')
    for (const file of backedUp) {
      const backupPath = join(backupDir, file.path)
      if (!existsSync(backupPath)) continue
      
      const destPath = join(process.cwd(), file.path)
      mkdirSync(dirname(destPath), { recursive: true })
      
      try {
        if (file.isDir) {
          rmSync(destPath, { recursive: true, force: true })
          cpSync(backupPath, destPath, { recursive: true })
        } else {
          writeFileSync(destPath, readFileSync(backupPath))
        }
        console.log(`   ✓ ${file.path}${file.isDir ? '/' : ''}`)
      } catch (err) {
        console.log(`   ⚠️  Failed to restore ${file.path}: ${err.message}`)
      }
    }
  }
  
  // Step 8: Cleanup temporary files
  console.log('\n🧹 Cleaning up...')
  rmSync(archivePath, { force: true })
  rmSync(extractDir, { recursive: true, force: true })
  rmSync(backupDir, { recursive: true, force: true })
  console.log('   ✓ Temporary files removed')
  
  // Step 9: Check if anything was actually updated
  if (updatedCount === 0) {
    console.log('\n✅ Already up to date!')
    console.log('='.repeat(70) + '\n')
    // No update marker - bot won't restart
    return 0
  }
  
  // Step 10: Create update marker for bot restart detection
  const updateMarkerPath = join(process.cwd(), '.update-happened')
  writeFileSync(updateMarkerPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    filesUpdated: updatedCount,
    method: 'github-api'
  }, null, 2))
  console.log('   ✓ Update marker created')
  
  // Step 11: Install dependencies & rebuild
  const hasNpm = await which('npm')
  if (!hasNpm) {
    console.log('\n⚠️  npm not found, skipping dependencies and build')
    console.log('Please run manually: npm install && npm run build')
    console.log('\n✅ Update complete!')
    console.log('='.repeat(70) + '\n')
    return 0
  }

  console.log('\n📦 Installing dependencies...')
  const installCode = await run('npm', ['ci'])
  if (installCode !== 0) {
    console.log('   ⚠️  npm ci failed, trying npm install...')
    await run('npm', ['install'])
  }
  
  console.log('\n🔨 Building TypeScript project...')
  const buildCode = await run('npm', ['run', 'build'])

  console.log('\n' + '='.repeat(70))
  if (buildCode === 0) {
    console.log('✅ Update completed successfully!')
    console.log('   Bot will restart automatically with new version')
  } else {
    console.log('⚠️  Update completed with build warnings')
    console.log('   Please check for errors above')
  }
  console.log('='.repeat(70) + '\n')

  return buildCode
}

// =============================================================================
// ENTRY POINT
// =============================================================================

async function main() {
  // Check if updates are enabled in config
  const configData = readJsonConfig([
    'src/config.jsonc',
    'config.jsonc',
    'src/config.json',
    'config.json'
  ])
  
  if (configData?.update?.enabled === false) {
    console.log('\n⚠️  Updates are disabled in config.jsonc')
    console.log('To enable: set "update.enabled" to true in src/config.jsonc\n')
    return 0
  }

  const code = await performUpdate()
  process.exit(code)
}

main().catch((err) => {
  console.error('\n❌ Update failed with error:', err)
  console.error('\nPlease report this issue if it persists.')
  process.exit(1)
})
