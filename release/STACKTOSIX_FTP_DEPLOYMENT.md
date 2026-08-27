# Stack to Six static-page FTP deployment

Upload the privacy package as directory contents, preserving its existing `images/` directory:

| Local package | Public directory | Required final URL |
| --- | --- | --- |
| `release/stacktosix-privacy-policy/index.html` | `/stacktosix-privacy-policy/index.html` | `https://taptapdesign.com/stacktosix-privacy-policy/` |
| `release/stacktosix-privacy-policy/support.html` | `/stacktosix-privacy-policy/support.html` | `https://taptapdesign.com/stacktosix-privacy-policy/support.html` |

For the already-published privacy directory, upload both `index.html` and `support.html` beside its
existing `images/` folder. The two pages use relative links to each other. The logo is unchanged.

After upload, verify all four URLs:

- `https://taptapdesign.com/stacktosix-privacy-policy/`
- `https://taptapdesign.com/stacktosix-privacy-policy/images/stack-to-six-logo.png`
- `https://taptapdesign.com/stacktosix-privacy-policy/support.html`

The public pages contain no JavaScript, analytics, tracking, form submission, or cookie-setting code.
Do not upload `.DS_Store` files. A host-level HTTP-to-HTTPS redirect remains recommended.
