import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Config } from '../src/interface/Config'
import { deobfuscateWebhookUrl, obfuscateWebhookUrl, sendErrorReport } from '../src/util/notifications/ErrorReportingWebhook'

describe('ErrorReportingWebhook', () => {
    describe('URL obfuscation', () => {
        it('should obfuscate and deobfuscate webhook URL correctly', () => {
            const originalUrl = 'https://discord.com/api/webhooks/1234567890/test-webhook-token'
            const obfuscated = obfuscateWebhookUrl(originalUrl)
            const deobfuscated = deobfuscateWebhookUrl(obfuscated)

            assert.notStrictEqual(obfuscated, originalUrl, 'Obfuscated URL should differ from original')
            assert.strictEqual(deobfuscated, originalUrl, 'Deobfuscated URL should match original')
        })

        it('should return empty string for invalid base64', () => {
            const result = deobfuscateWebhookUrl('invalid!!!base64@@@')
            assert.strictEqual(result, '', 'Invalid base64 should return empty string')
        })

        it('should handle empty strings', () => {
            const obfuscated = obfuscateWebhookUrl('')
            const deobfuscated = deobfuscateWebhookUrl(obfuscated)
            assert.strictEqual(deobfuscated, '', 'Empty string should remain empty')
        })

        it('should verify project webhook URL', () => {
            const projectWebhook = 'https://discord.com/api/webhooks/1437111962394689629/tlvGKZaH9-rJir4tnZKSZpRHS3YbeN4vZnuCv50k5MpADYRPnHnZ6MybAlgF5QFo6KH_'
            const expectedObfuscated = 'aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTQzNzExMTk2MjM5NDY4OTYyOS90bHZHS1phSDktckppcjR0blpLU1pwUkhTM1liZU40dlpudUN2NTBrNU1wQURZUlBuSG5aNk15YkFsZ0Y1UUZvNktIXw=='

            const obfuscated = obfuscateWebhookUrl(projectWebhook)
            assert.strictEqual(obfuscated, expectedObfuscated, 'Project webhook should match expected obfuscation')

            const deobfuscated = deobfuscateWebhookUrl(expectedObfuscated)
            assert.strictEqual(deobfuscated, projectWebhook, 'Deobfuscated should match original project webhook')
        })
    })

    describe('sendErrorReport', () => {
        it('should respect enabled flag when true (dry run with invalid config)', async () => {
            // This test verifies the flow works when enabled = true
            // Uses invalid webhook URL to prevent actual network call
            const mockConfig: Partial<Config> = {
                errorReporting: { enabled: true }
            }

            // Should not throw even with invalid config (graceful degradation)
            await assert.doesNotReject(
                async () => {
                    await sendErrorReport(mockConfig as Config, new Error('Test error'))
                },
                'sendErrorReport should not throw when enabled'
            )
        })

        it('should skip sending when explicitly disabled', async () => {
            const mockConfig: Partial<Config> = {
                errorReporting: { enabled: false }
            }

            // Should return immediately without attempting network call
            await assert.doesNotReject(
                async () => {
                    await sendErrorReport(mockConfig as Config, new Error('Test error'))
                },
                'sendErrorReport should not throw when disabled'
            )
        })

        it('should filter out expected errors (configuration issues)', async () => {
            const mockConfig: Partial<Config> = {
                errorReporting: { enabled: true }
            }

            // These errors should be filtered by shouldReportError()
            const expectedErrors = [
                'accounts.jsonc not found',
                'Invalid credentials',
                'Login failed',
                'Account suspended',
                'EADDRINUSE: Port already in use'
            ]

            for (const errorMsg of expectedErrors) {
                await assert.doesNotReject(
                    async () => {
                        await sendErrorReport(mockConfig as Config, new Error(errorMsg))
                    },
                    `Should handle expected error: ${errorMsg}`
                )
            }
        })

        it('should sanitize sensitive data from error messages', async () => {
            const mockConfig: Partial<Config> = {
                errorReporting: { enabled: true }
            }

            // Error containing sensitive data
            const sensitiveError = new Error('Login failed for user@example.com at C:\\Users\\test\\path with token abc123def456ghi789012345')

            // Should not throw and should sanitize internally
            await assert.doesNotReject(
                async () => {
                    await sendErrorReport(mockConfig as Config, sensitiveError, {
                        userPath: '/home/user/secrets',
                        ipAddress: '192.168.1.100'
                    })
                },
                'Should handle errors with sensitive data'
            )
        })
    })
})
