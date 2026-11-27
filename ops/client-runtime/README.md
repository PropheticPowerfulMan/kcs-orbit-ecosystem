# Mandatory application updates

One scoped, versioned client runtime is copied to each app by sync.mjs. Never edit copies manually. The runtime checks a same-origin no-store version manifest whose app ID and scope must both match. It never unregisters another app or deletes private storage.

A newly detected version opens a centered, non-dismissible dialog. There is no Later action. Active writes block reload. Durable offline payment queues are retained across reload and require explicit review before updating. A bounded save-work interval lets the user finish a current form, while navigation is blocked and the update remains required. Unsaved inputs are never copied to storage; the user must save/protect them before explicitly updating. Escape and backdrop clicks cannot defer an update. Network failure alone never invents a new version or blocks an offline application.

Builds must emit the new runtime and app-version.json in the owning scope. Service workers must not cache version manifests and support an explicit safe update action without automatically reloading an active form. Existing running clients acquire this runtime when they next load the new application code.
