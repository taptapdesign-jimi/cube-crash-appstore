# Stack to Six App Store Signing Unblock

Observed: 2026-08-27
Team: `Igor Ivankovic` (`L3H6B843AL`)
Bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`

## Exact blocker

The verified Stack to Six Release archive `1.0 (3)` was created successfully, but App Store export
failed before IPA creation with:

```text
Team "Igor Ivankovic" does not have permission to create "iOS App Store" provisioning profiles.
No profiles for 'com.taptapdesign.stacktosix.Stack-to-Six' were found.
```

This is Apple Developer account/provisioning state, not a source, gameplay, bundle, privacy-manifest,
or archive-identity failure. Xcode could create only a development-signed archive using the existing
Apple Development certificate and iOS Team Provisioning Profile.

## Where to fix it

1. Sign in at `https://developer.apple.com/account/` with the Apple ID that owns Tap Tap Design.
2. Open **Membership details** and confirm that the paid Apple Developer Program membership is
   active. A free Personal Team cannot create App Store distribution profiles.
3. If this is an organization team, open **App Store Connect → Users and Access** and ensure Igor's
   role/permissions allow Certificates, Identifiers & Profiles and App Store distribution. The
   Account Holder or an Admin can grant the required access.
4. In Xcode open **Xcode → Settings → Accounts**, select the Apple ID and team `Igor Ivankovic`, then
   **Manage Certificates…**. Create or download an **Apple Distribution** certificate.
5. If automatic signing still cannot create the profile, use
   **developer.apple.com → Certificates, Identifiers & Profiles → Profiles → + → App Store Connect**,
   select the exact App ID `com.taptapdesign.stacktosix.Stack-to-Six`, select the Apple Distribution
   certificate, generate the profile, download it, and open it to install it in Xcode.

Do not create or select a profile for Kockice Crash or the repository's unrelated Capacitor shell.

## When access is fixed

Use Xcode Organizer with the saved archive:

```text
/Users/user/Library/Developer/Xcode/Archives/2026-08-27/Stack to Six 1.0 (3).xcarchive
```

Then choose **Distribute App → App Store Connect → Upload**. Before final upload, verify Xcode shows:

- app: Stack to Six;
- version: 1.0;
- build: 3;
- team: Igor Ivankovic / `L3H6B843AL`;
- bundle ID: `com.taptapdesign.stacktosix.Stack-to-Six`;
- Apple Distribution signing and an App Store Connect provisioning profile;
- no `get-task-allow` entitlement in the exported App Store app.

The repository also contains the deterministic export configuration:
`release/StackToSix-AppStore-ExportOptions.plist`. After provisioning is fixed, the automated export
can be retried against the saved archive. Do not upload until export validation succeeds.
