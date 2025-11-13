/**
 * Webhook Preview Test
 * 
 * This test generates a preview of the improved webhook formats:
 * 1. Main Summary Webhook (clean, no errors)
 * 2. Separate Error Report Webhook (for accounts with issues)
 */

import { describe, it } from 'node:test'

describe('Webhook Preview - Improved Format', () => {
    it('should display main summary webhook and separate error report', () => {
        // Mock data simulating 3 accounts with different outcomes
        const accounts = [
            {
                email: 'success.account@outlook.com',
                pointsEarned: 340,
                desktopPoints: 150,
                mobilePoints: 190,
                initialPoints: 12450,
                finalPoints: 12790,
                runDuration: 245000,
                errors: [],
                banned: false
            },
            {
                email: 'partial.success@hotmail.com',
                pointsEarned: 210,
                desktopPoints: 150,
                mobilePoints: 60,
                initialPoints: 8920,
                finalPoints: 9130,
                runDuration: 198000,
                errors: ['Mobile search: Timeout after 3 retries - network instability detected'],
                banned: false
            },
            {
                email: 'banned.account@live.com',
                pointsEarned: 0,
                desktopPoints: 0,
                mobilePoints: 0,
                initialPoints: 5430,
                finalPoints: 5430,
                runDuration: 45000,
                errors: ['Account suspended - security check required by Microsoft'],
                banned: true
            }
        ]

        const totalPoints = accounts.reduce((sum, acc) => sum + acc.pointsEarned, 0)
        const totalDesktop = accounts.reduce((sum, acc) => sum + acc.desktopPoints, 0)
        const totalMobile = accounts.reduce((sum, acc) => sum + acc.mobilePoints, 0)
        const totalInitial = accounts.reduce((sum, acc) => sum + acc.initialPoints, 0)
        const totalFinal = accounts.reduce((sum, acc) => sum + acc.finalPoints, 0)
        const bannedCount = accounts.filter(acc => acc.banned).length
        const successCount = accounts.filter(acc => !acc.errors?.length && !acc.banned).length
        const failureCount = accounts.length - successCount
        const durationText = '8m 8s'

        // ==================== MAIN SUMMARY WEBHOOK ====================
        let mainDescription = `┌${'─'.repeat(48)}┐\n`
        mainDescription += `│ ${' '.repeat(10)}📊 EXECUTION SUMMARY${' '.repeat(11)}│\n`
        mainDescription += `└${'─'.repeat(48)}┘\n\n`

        // Global Overview
        mainDescription += '**🌐 GLOBAL STATISTICS**\n'
        mainDescription += `┌${'─'.repeat(48)}┐\n`
        mainDescription += `│ ⏱️ Duration: \`${durationText}\`${' '.repeat(48 - 14 - durationText.length)}│\n`
        mainDescription += `│ 💰 Total Earned: **${totalPoints}** points${' '.repeat(48 - 22 - String(totalPoints).length)}│\n`
        mainDescription += `│ 🖥️ Desktop: **${totalDesktop}** pts | 📱 Mobile: **${totalMobile}** pts${' '.repeat(48 - 28 - String(totalDesktop).length - String(totalMobile).length)}│\n`
        mainDescription += `│ ✅ Success: ${successCount}/${accounts.length} accounts${' '.repeat(48 - 18 - String(successCount).length - String(accounts.length).length)}│\n`
        mainDescription += `│ ❌ Failed: ${failureCount} accounts${' '.repeat(48 - 14 - String(failureCount).length)}│\n`
        mainDescription += `│ 🚫 Banned: ${bannedCount} accounts${' '.repeat(48 - 14 - String(bannedCount).length)}│\n`
        mainDescription += `└${'─'.repeat(48)}┘\n\n`

        // Account Details (NO ERRORS - Clean Summary)
        mainDescription += '**📄 ACCOUNT BREAKDOWN**\n\n'

        const accountsWithErrors = []

        for (const account of accounts) {
            const status = account.banned ? '🚫' : (account.errors?.length ? '❌' : '✅')
            const emailShort = account.email.length > 30 ? account.email.substring(0, 27) + '...' : account.email
            const durationSec = Math.round(account.runDuration / 1000)

            mainDescription += `${status} **${emailShort}**\n`
            mainDescription += `┌${'─'.repeat(46)}┐\n`

            // Points Earned Breakdown
            mainDescription += `│ 📊 Points Earned: **+${account.pointsEarned}** points${' '.repeat(46 - 23 - String(account.pointsEarned).length)}│\n`
            mainDescription += `│   └─ Desktop: **${account.desktopPoints}** pts${' '.repeat(46 - 20 - String(account.desktopPoints).length)}│\n`
            mainDescription += `│   └─ Mobile: **${account.mobilePoints}** pts${' '.repeat(46 - 19 - String(account.mobilePoints).length)}│\n`
            mainDescription += `├${'─'.repeat(46)}┤\n`

            // Account Total Balance (Formula: Initial + Earned = Final)
            mainDescription += `│ 💳 Account Total Balance${' '.repeat(23)}│\n`
            mainDescription += `│   \`${account.initialPoints}\` + \`${account.pointsEarned}\` = **\`${account.finalPoints}\` pts**${' '.repeat(46 - 17 - String(account.initialPoints).length - String(account.pointsEarned).length - String(account.finalPoints).length)}│\n`
            mainDescription += `│   (Initial + Earned = Final)${' '.repeat(18)}│\n`
            mainDescription += `├${'─'.repeat(46)}┤\n`

            // Duration
            mainDescription += `│ ⏱️ Duration: ${durationSec}s${' '.repeat(46 - 13 - String(durationSec).length)}│\n`

            mainDescription += `└${'─'.repeat(46)}┘\n\n`

            // Collect accounts with errors for separate report
            if (account.errors?.length || account.banned) {
                accountsWithErrors.push(account)
            }
        }

        // Footer Summary
        mainDescription += `┌${'─'.repeat(48)}┐\n`
        mainDescription += `│ 🌐 TOTAL ACROSS ALL ACCOUNTS${' '.repeat(22)}│\n`
        mainDescription += `├${'─'.repeat(48)}┤\n`
        mainDescription += `│ Initial Balance: \`${totalInitial}\` points${' '.repeat(48 - 25 - String(totalInitial).length)}│\n`
        mainDescription += `│ Final Balance: \`${totalFinal}\` points${' '.repeat(48 - 23 - String(totalFinal).length)}│\n`
        mainDescription += `│ Total Earned: **+${totalPoints}** points${' '.repeat(48 - 23 - String(totalPoints).length)}│\n`
        mainDescription += `└${'─'.repeat(48)}┘\n`

        // ==================== ERROR REPORT WEBHOOK ====================
        let errorDescription = `┌${'─'.repeat(48)}┐\n`
        errorDescription += `│ ${' '.repeat(10)}⚠️ ERROR REPORT${' '.repeat(16)}│\n`
        errorDescription += `└${'─'.repeat(48)}┘\n\n`

        errorDescription += `**${accountsWithErrors.length} account(s) encountered issues:**\n\n`

        for (const account of accountsWithErrors) {
            const status = account.banned ? '🚫 BANNED' : '❌ ERROR'
            const emailShort = account.email.length > 35 ? account.email.substring(0, 32) + '...' : account.email

            errorDescription += `${status} | **${emailShort}**\n`
            errorDescription += `┌${'─'.repeat(46)}┐\n`

            // Show what was attempted
            errorDescription += `│ 📊 Progress${' '.repeat(35)}│\n`
            errorDescription += `│   Desktop: ${account.desktopPoints} pts earned${' '.repeat(46 - 21 - String(account.desktopPoints).length)}│\n`
            errorDescription += `│   Mobile: ${account.mobilePoints} pts earned${' '.repeat(46 - 20 - String(account.mobilePoints).length)}│\n`
            errorDescription += `│   Total: ${account.pointsEarned} pts${' '.repeat(46 - 13 - String(account.pointsEarned).length)}│\n`
            errorDescription += `├${'─'.repeat(46)}┤\n`

            // Error details with word wrapping
            if (account.banned) {
                errorDescription += `│ 🚫 Status: Account Banned/Suspended${' '.repeat(9)}│\n`
                if (account.errors?.length && account.errors[0]) {
                    errorDescription += `│ 💬 Reason:${' '.repeat(36)}│\n`
                    const errorText = account.errors[0]
                    const words = errorText.split(' ')
                    let line = ''
                    for (const word of words) {
                        if ((line + word).length > 42) {
                            errorDescription += `│   ${line.trim()}${' '.repeat(46 - 3 - line.trim().length)}│\n`
                            line = word + ' '
                        } else {
                            line += word + ' '
                        }
                    }
                    if (line.trim()) {
                        errorDescription += `│   ${line.trim()}${' '.repeat(46 - 3 - line.trim().length)}│\n`
                    }
                }
            } else if (account.errors?.length && account.errors[0]) {
                errorDescription += `│ ❌ Error Details:${' '.repeat(29)}│\n`
                const errorText = account.errors[0]
                const words = errorText.split(' ')
                let line = ''
                for (const word of words) {
                    if ((line + word).length > 42) {
                        errorDescription += `│   ${line.trim()}${' '.repeat(46 - 3 - line.trim().length)}│\n`
                        line = word + ' '
                    } else {
                        line += word + ' '
                    }
                }
                if (line.trim()) {
                    errorDescription += `│   ${line.trim()}${' '.repeat(46 - 3 - line.trim().length)}│\n`
                }
            }

            errorDescription += `└${'─'.repeat(46)}┘\n\n`
        }

        errorDescription += '**📋 Recommended Actions:**\n'
        errorDescription += '• Check account status manually\n'
        errorDescription += '• Review error messages above\n'
        errorDescription += '• Verify credentials if login failed\n'
        errorDescription += '• Consider proxy rotation if rate-limited\n'

        // ==================== DISPLAY PREVIEW ====================
        console.log('\n' + '='.repeat(70))
        console.log('📊 WEBHOOK PREVIEW - IMPROVED FORMAT')
        console.log('='.repeat(70))

        console.log('\n✅ WEBHOOK #1 - MAIN SUMMARY (Clean, No Errors)')
        console.log('─'.repeat(70))
        console.log('🎯 Title: 🎉 Daily Rewards Collection Complete')
        console.log('🎨 Color: Green (all success) / Orange (partial failures) / Red (bans detected)')
        console.log('\n📝 Description:')
        console.log(mainDescription)

        console.log('='.repeat(70))
        console.log('\n⚠️ WEBHOOK #2 - ERROR REPORT (Separate, Only if Errors Exist)')
        console.log('─'.repeat(70))
        console.log('🎯 Title: ⚠️ Execution Errors & Warnings')
        console.log('🎨 Color: Red (always)')
        console.log('\n📝 Description:')
        console.log(errorDescription)

        console.log('='.repeat(70))
        console.log('\n✅ KEY IMPROVEMENTS IMPLEMENTED:')
        console.log('   ✓ Errors moved to separate webhook (main summary stays clean)')
        console.log('   ✓ Account total shown as formula: `Initial + Earned = Final`')
        console.log('   ✓ Complete per-account breakdown: Desktop + Mobile points')
        console.log('   ✓ Global totals: Initial balance, Final balance, Total earned')
        console.log('   ✓ Individual account totals clearly displayed')
        console.log('   ✓ Error details with automatic word wrapping')
        console.log('   ✓ Professional box structure throughout')
        console.log('   ✓ Recommended actions in error report')
        console.log('   ✓ Status indicators: ✅ Success, ❌ Error, 🚫 Banned\n')
    })
})
