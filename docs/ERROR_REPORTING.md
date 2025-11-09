# 🐛 Automatic Error Reporting

## Overview

The bot automatically reports errors to a community webhook to help identify and fix issues faster, without requiring manual bug reports from users.

## Key Features

✅ **Privacy-First** - Only non-sensitive error information is sent  
✅ **Opt-Out** - Can be disabled in configuration  
✅ **Obfuscated Webhook** - URL is base64-encoded  
✅ **Automatic Sanitization** - Removes emails, paths, tokens, and IPs  
✅ **Intelligent Filtering** - Excludes user configuration errors and false positives  
✅ **System Information** - Includes version, platform, architecture for debugging

## What's Sent

- Error message (sanitized)
- Stack trace (truncated, sanitized)
- Bot version
- Operating system and architecture
- Node.js version
- Timestamp

## What's NOT Sent

- ❌ Email addresses (redacted)
- ❌ File paths (redacted)
- ❌ IP addresses (redacted)
- ❌ Tokens/API keys (redacted)
- ❌ Account credentials
- ❌ Personal information

## Filtered Errors

The system intelligently filters out:
- User configuration errors (missing files, invalid credentials)
- Expected errors (no points, already completed)
- Network issues (proxy failures, port conflicts)
- Account-specific issues (banned accounts)

## Configuration

In `config.jsonc`:

```jsonc
"errorReporting": {
    "enabled": true,  // Set to false to disable
    "webhookUrl": "aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va3MvMTQzNzExMTk2MjM5NDY4OTYyOS90bHZHS1phSDktckppcjR0blpLU1pwUkhTM1liZU40dlpudUN2NTBrNU1wQURZUlBuSG5aNk15YkFsZ0Y1UUZvNktIXw=="
}
```

### Disable Error Reporting

Set `enabled` to `false`:

```jsonc
"errorReporting": {
    "enabled": false,
    "webhookUrl": "..."
}
```

## Privacy & Security

- No PII is sent
- All sensitive data is automatically redacted
- Webhook URL is obfuscated (base64)
- Fire-and-forget (never blocks execution)
- Silent failure if webhook is unreachable

## Technical Details

- **File**: `src/util/ErrorReportingWebhook.ts`
- **Integration**: Automatic via `Logger.ts`
- **Method**: HTTP POST to Discord webhook
- **Timeout**: 10 seconds
- **Filtering**: Pattern-based false positive detection

Thank you for helping improve the bot! 🙏
