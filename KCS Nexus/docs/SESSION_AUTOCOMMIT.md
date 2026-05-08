# Session Auto Commit

Use this script at the end of a work session to avoid losing good progress.
By default, it commits changes, pushes `main` to GitHub, and publishes the
KCS Nexus frontend to GitHub Pages when KCS Nexus frontend files changed.

From the ecosystem root, use the shortcut:

```powershell
.\end-session.ps1
```

or from Command Prompt:

```bat
end-session.cmd
```

```powershell
.\scripts\session-commit.ps1
```

The `-Push` flag is still accepted for older habits, but pushing is now the
default behavior:

```powershell
.\scripts\session-commit.ps1 -Push
```

You can customize the commit message:

```powershell
.\scripts\session-commit.ps1 -Message "Improve KCS homepage design" -Push
```

To skip automatic publishing for a rare local-only checkpoint:

```powershell
.\scripts\session-commit.ps1 -SkipPush -SkipDeploy
```

The script bypasses the local interactive pre-commit hook by default because
automated sessions cannot answer `/dev/tty` prompts. To force hook execution:

```powershell
.\scripts\session-commit.ps1 -Verify
```

To wrap any command and automatically save/push when it finishes:

```powershell
.\scripts\run-session.ps1 npm run build
```

To publish the frontend to the live GitHub Pages site manually:

```powershell
.\scripts\deploy-gh-pages.ps1
```

The script only commits when there are actual changes. Ignored folders like
`node_modules` and `dist` stay excluded by `.gitignore`.
