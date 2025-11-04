import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { log } from './Logger'
import type { Config } from '../interface/Config'

export class SchedulerManager {
  private config: Config
  private projectRoot: string
  private nodePath: string

  constructor(config: Config) {
    this.config = config
    this.projectRoot = process.cwd()
    this.nodePath = process.execPath
  }

  async setup(): Promise<void> {
    const scheduling = this.config.scheduling
    if (!scheduling?.enabled) {
      log('main', 'SCHEDULER', 'Automatic scheduling is disabled in config', 'log')
      return
    }

    const type = scheduling.type || 'auto'
    const platform = os.platform()

    log('main', 'SCHEDULER', `Setting up automatic scheduling (type: ${type}, platform: ${platform})`)

    try {
      if (type === 'auto') {
        if (platform === 'win32') {
          await this.setupWindowsTaskScheduler()
        } else if (platform === 'linux' || platform === 'darwin') {
          await this.setupCron()
        } else {
          log('main', 'SCHEDULER', `Unsupported platform: ${platform}`, 'warn')
        }
      } else if (type === 'cron') {
        await this.setupCron()
      } else if (type === 'task-scheduler') {
        await this.setupWindowsTaskScheduler()
      }
    } catch (error) {
      log('main', 'SCHEDULER', `Failed to setup scheduler: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  private async setupCron(): Promise<void> {
    const cronConfig = this.config.scheduling?.cron || {}
    const schedule = cronConfig.schedule || '0 9 * * *'
    const workingDir = cronConfig.workingDirectory || this.projectRoot
    const nodePath = cronConfig.nodePath || this.nodePath
    const logFile = cronConfig.logFile || path.join(workingDir, 'logs', 'rewards-cron.log')
    const user = cronConfig.user || ''

    log('main', 'SCHEDULER', `Configuring cron with schedule: ${schedule}`)

    // Ensure log directory exists
    const logDir = path.dirname(logFile)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    // Build cron command
    const cronCommand = `${schedule} cd ${workingDir} && ${nodePath} ${path.join(workingDir, 'dist', 'index.js')} >> ${logFile} 2>&1`

    try {
      // Check if cron is installed
      try {
        execSync('which cron', { stdio: 'ignore' })
      } catch {
        log('main', 'SCHEDULER', 'cron is not installed. Please install it first: sudo apt-get install cron', 'error')
        return
      }

      // Get current crontab
      let currentCrontab = ''
      try {
        const getCrontabCmd = user ? `crontab -u ${user} -l` : 'crontab -l'
        currentCrontab = execSync(getCrontabCmd, { encoding: 'utf-8' })
      } catch (error) {
        // No existing crontab
        currentCrontab = ''
      }

      // Check if our job already exists
      const jobMarker = '# Microsoft-Rewards-Bot'
      if (currentCrontab.includes(jobMarker)) {
        log('main', 'SCHEDULER', 'Cron job already exists, updating...', 'log')
        // Remove old job
        const lines = currentCrontab.split('\n').filter(line => 
          !line.includes(jobMarker) && !line.includes('Microsoft-Rewards-Script')
        )
        currentCrontab = lines.join('\n')
      }

      // Add new job
      const newCrontab = currentCrontab.trim() + '\n' + jobMarker + '\n' + cronCommand + '\n'

      // Write new crontab
      const tempFile = path.join(os.tmpdir(), `crontab-${Date.now()}.txt`)
      fs.writeFileSync(tempFile, newCrontab)

      const setCrontabCmd = user ? `crontab -u ${user} ${tempFile}` : `crontab ${tempFile}`
      execSync(setCrontabCmd)

      // Cleanup temp file
      fs.unlinkSync(tempFile)

      log('main', 'SCHEDULER', '✅ Cron job configured successfully', 'log', 'green')
      log('main', 'SCHEDULER', `Schedule: ${schedule}`, 'log')
      log('main', 'SCHEDULER', `Log file: ${logFile}`, 'log')
      log('main', 'SCHEDULER', 'View jobs: crontab -l', 'log')
    } catch (error) {
      log('main', 'SCHEDULER', `Failed to configure cron: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  private async setupWindowsTaskScheduler(): Promise<void> {
    const taskConfig = this.config.scheduling?.taskScheduler || {}
    const taskName = taskConfig.taskName || 'Microsoft-Rewards-Bot'
    const schedule = taskConfig.schedule || '09:00'
    const frequency = taskConfig.frequency || 'daily'
    const workingDir = taskConfig.workingDirectory || this.projectRoot
    const runAsUser = taskConfig.runAsUser !== false
    const highestPrivileges = taskConfig.highestPrivileges === true

    log('main', 'SCHEDULER', `Configuring Windows Task Scheduler: ${taskName}`)

    try {
      // Check if task already exists
      const checkCmd = `schtasks /Query /TN "${taskName}" 2>nul`
      let taskExists = false
      try {
        execSync(checkCmd, { stdio: 'ignore' })
        taskExists = true
        log('main', 'SCHEDULER', 'Task already exists, it will be updated', 'log')
      } catch {
        // Task doesn't exist
      }

      // Delete existing task if it exists
      if (taskExists) {
        execSync(`schtasks /Delete /TN "${taskName}" /F`, { stdio: 'ignore' })
      }

      // Build task command
      const scriptPath = path.join(workingDir, 'dist', 'index.js')
      const action = `"${this.nodePath}" "${scriptPath}"`

      // Create XML for task
      const xmlContent = this.generateTaskSchedulerXml(
        taskName,
        action,
        workingDir,
        schedule,
        frequency,
        runAsUser,
        highestPrivileges
      )

      // Save XML to temp file
      const tempXmlPath = path.join(os.tmpdir(), `task-${Date.now()}.xml`)
      fs.writeFileSync(tempXmlPath, xmlContent, 'utf-8')

      // Create task from XML
      const createCmd = `schtasks /Create /TN "${taskName}" /XML "${tempXmlPath}" /F`
      execSync(createCmd, { stdio: 'ignore' })

      // Cleanup temp file
      fs.unlinkSync(tempXmlPath)

      log('main', 'SCHEDULER', '✅ Windows Task Scheduler configured successfully', 'log', 'green')
      log('main', 'SCHEDULER', `Task name: ${taskName}`, 'log')
      log('main', 'SCHEDULER', `Schedule: ${frequency} at ${schedule}`, 'log')
      log('main', 'SCHEDULER', `View task: Task Scheduler > Task Scheduler Library > ${taskName}`, 'log')
    } catch (error) {
      log('main', 'SCHEDULER', `Failed to configure Task Scheduler: ${error instanceof Error ? error.message : String(error)}`, 'error')
      log('main', 'SCHEDULER', 'Make sure you run this with administrator privileges', 'warn')
    }
  }

  private generateTaskSchedulerXml(
    taskName: string,
    action: string,
    workingDir: string,
    schedule: string,
    frequency: string,
    runAsUser: boolean,
    highestPrivileges: boolean
  ): string {
    const currentUser = os.userInfo().username
    const [hours, minutes] = schedule.split(':')
    const startBoundary = `2025-01-01T${hours}:${minutes}:00`

    let triggerXml = ''
    if (frequency === 'daily') {
      triggerXml = `
      <CalendarTrigger>
        <StartBoundary>${startBoundary}</StartBoundary>
        <Enabled>true</Enabled>
        <ScheduleByDay>
          <DaysInterval>1</DaysInterval>
        </ScheduleByDay>
      </CalendarTrigger>`
    } else if (frequency === 'weekly') {
      triggerXml = `
      <CalendarTrigger>
        <StartBoundary>${startBoundary}</StartBoundary>
        <Enabled>true</Enabled>
        <ScheduleByWeek>
          <WeeksInterval>1</WeeksInterval>
          <DaysOfWeek>
            <Monday />
            <Tuesday />
            <Wednesday />
            <Thursday />
            <Friday />
            <Saturday />
            <Sunday />
          </DaysOfWeek>
        </ScheduleByWeek>
      </CalendarTrigger>`
    }

    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Microsoft Rewards Bot - Automated task execution</Description>
    <Author>${currentUser}</Author>
  </RegistrationInfo>
  <Triggers>
    ${triggerXml}
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${runAsUser ? currentUser : 'SYSTEM'}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>${highestPrivileges ? 'HighestAvailable' : 'LeastPrivilege'}</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${this.nodePath}</Command>
      <Arguments>"${path.join(workingDir, 'dist', 'index.js')}"</Arguments>
      <WorkingDirectory>${workingDir}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`
  }

  async remove(): Promise<void> {
    const platform = os.platform()
    log('main', 'SCHEDULER', 'Removing scheduled tasks...')

    try {
      if (platform === 'win32') {
        await this.removeWindowsTask()
      } else if (platform === 'linux' || platform === 'darwin') {
        await this.removeCron()
      }
    } catch (error) {
      log('main', 'SCHEDULER', `Failed to remove scheduler: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  private async removeCron(): Promise<void> {
    try {
      let currentCrontab = ''
      try {
        currentCrontab = execSync('crontab -l', { encoding: 'utf-8' })
      } catch {
        log('main', 'SCHEDULER', 'No crontab found', 'log')
        return
      }

      const jobMarker = '# Microsoft-Rewards-Bot'
      if (!currentCrontab.includes(jobMarker)) {
        log('main', 'SCHEDULER', 'No Microsoft Rewards Bot cron job found', 'log')
        return
      }

      // Remove job
      const lines = currentCrontab.split('\n').filter(line => 
        !line.includes(jobMarker) && !line.includes('Microsoft-Rewards-Script')
      )
      const newCrontab = lines.join('\n')

      const tempFile = path.join(os.tmpdir(), `crontab-${Date.now()}.txt`)
      fs.writeFileSync(tempFile, newCrontab)
      execSync(`crontab ${tempFile}`)
      fs.unlinkSync(tempFile)

      log('main', 'SCHEDULER', '✅ Cron job removed successfully', 'log', 'green')
    } catch (error) {
      log('main', 'SCHEDULER', `Failed to remove cron: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  private async removeWindowsTask(): Promise<void> {
    const taskConfig = this.config.scheduling?.taskScheduler || {}
    const taskName = taskConfig.taskName || 'Microsoft-Rewards-Bot'

    try {
      execSync(`schtasks /Delete /TN "${taskName}" /F`, { stdio: 'ignore' })
      log('main', 'SCHEDULER', '✅ Windows Task removed successfully', 'log', 'green')
    } catch (error) {
      log('main', 'SCHEDULER', `Task "${taskName}" not found or already removed`, 'log')
    }
  }

  async status(): Promise<void> {
    const platform = os.platform()
    log('main', 'SCHEDULER', 'Checking scheduler status...')

    try {
      if (platform === 'win32') {
        await this.statusWindowsTask()
      } else if (platform === 'linux' || platform === 'darwin') {
        await this.statusCron()
      }
    } catch (error) {
      log('main', 'SCHEDULER', `Failed to check status: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  private async statusCron(): Promise<void> {
    try {
      const currentCrontab = execSync('crontab -l', { encoding: 'utf-8' })
      const jobMarker = '# Microsoft-Rewards-Bot'
      
      if (currentCrontab.includes(jobMarker)) {
        const lines = currentCrontab.split('\n')
        const jobIndex = lines.findIndex(line => line.includes(jobMarker))
        if (jobIndex >= 0 && jobIndex + 1 < lines.length) {
          log('main', 'SCHEDULER', '✅ Cron job is active', 'log', 'green')
          log('main', 'SCHEDULER', `Job: ${lines[jobIndex + 1]}`, 'log')
        }
      } else {
        log('main', 'SCHEDULER', '❌ No cron job found', 'warn')
      }
    } catch {
      log('main', 'SCHEDULER', '❌ No crontab configured', 'warn')
    }
  }

  private async statusWindowsTask(): Promise<void> {
    const taskConfig = this.config.scheduling?.taskScheduler || {}
    const taskName = taskConfig.taskName || 'Microsoft-Rewards-Bot'

    try {
      const result = execSync(`schtasks /Query /TN "${taskName}" /FO LIST /V`, { encoding: 'utf-8' })
      if (result.includes(taskName)) {
        log('main', 'SCHEDULER', '✅ Windows Task is active', 'log', 'green')
        log('main', 'SCHEDULER', `Task name: ${taskName}`, 'log')
      }
    } catch {
      log('main', 'SCHEDULER', `❌ Task "${taskName}" not found`, 'warn')
    }
  }
}
