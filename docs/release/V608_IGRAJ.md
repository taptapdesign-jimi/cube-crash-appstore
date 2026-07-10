# V608 IGRAJ

Codename: `IGRAJ`

## Summary

- Homepage primary CTA is localized to `IGRAJ`.
- Stack to Six iPhone wrapper uses bundled `Web.bundle` content and does not load a LAN dev server.
- Installed iPhone build was verified as `app://localhost/index.html` with no `192.168`, `5174`, `loca.lt`, or Local Network permission key in the final app bundle.
- Current bundled web content matches the working browser build that shows `IGRAJ`.

## Validation

- `npm run build`
- Xcode Debug build for `Stack to Six` on `iPhone 13 blue`
- CoreDevice install and launch succeeded
