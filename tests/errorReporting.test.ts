import assert from 'node:assert'
import { describe, it } from 'node:test'
import { deobfuscateWebhookUrl, obfuscateWebhookUrl } from '../src/util/ErrorReportingWebhook'

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
})
