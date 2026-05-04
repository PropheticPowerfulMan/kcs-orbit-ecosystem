# Session Auto Commit

Use this script at the end of a work session to avoid losing good progress.
By default, it commits changes, pushes `main` to GitHub, and publishes the
frontend to GitHub Pages when frontend files changed.

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

To publish the frontend to the live GitHub Pages site manually:

```powershell
.\scripts\deploy-gh-pages.ps1
```

The script only commits when there are actual changes. Ignored folders like
`node_modules` and `dist` stay excluded by `.gitignore`.
