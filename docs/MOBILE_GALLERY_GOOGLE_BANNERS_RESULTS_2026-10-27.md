# Gallery, Google sign-in and promoted banners ? experimental changes

Status: implemented on an isolated mobile branch; no merge, APK build, installation or production change. This branch includes the previously reviewed, unreleased login-overload integration (base commit `8f40420719c8a052650e20f0b52a036f282c6f1b`).

## Gallery

All seven library entry points now use `chooseLibraryMedia`: customer avatar, product review, community updates, chat attachments (including shared chat/Town Hall), provider product/service media, provider branding and verification images. The old entry points demanded broad library permission before opening a system picker. The installed Expo ImagePicker native library does not require that permission for selecting specific files. A prior denial can therefore block the old app unnecessarily. This is a confirmed code defect, but the exact affected handset has not yet been identified.

The shared helper opens the system picker directly. On Android, a missing picker activity or a failed native Photo Picker result triggers one legacy system file-chooser attempt, without the optional crop activity. User cancellation and unrelated image processing errors never reopen a picker. A synchronous lock prevents multiple concurrent native pickers across screens. Final failures show an actionable message and return cancellation, avoiding unhandled promises or accidental uploads. Camera permission remains required. Existing MIME, size, count, subscription entitlement, signed upload and server-validation policies remain enforced by the callers.

This does not guarantee success on every device. Missing/disabled system file providers, Android process death, insufficient storage, unsupported file formats and vendor-specific lifecycle defects still require physical testing. We do not automatically restore an interrupted selection into a different account or upload destination.

## Google sign-in

Confirmed recovery defects: every token-exchange failure previously logged out of Privy, even on transient network/backend failure; a second unowned OAuth-state effect could also show an error and alter busy state independently of the attempt-owned catch. These defects can worsen a retry experience. Without the original error/status/request ID, they do not establish the cause of the user's two reported failures.

Temporary exchange failure now retains the completed Google session, allowing the next explicit tap to finish the handoff without reopening Google. HTTP401/403 still clear rejected credentials and gate the next sign-in while session cleanup occurs. Browser cancellation releases the shared lock without an alarming failure alert. The one attempt-owned error path replaces the duplicate state-effect alert. The screen distinguishes opening Google from completing sign-in.

The exchange is still one POST per user action, with a 12-second deadline that includes reading the response body and honours cancellation/unmount. It never automatically replays identity creation/verification. Password hashing, backend authorization and registration behavior are unchanged.

## Promoted row

Circular thumbnails become rounded rectangular image banners, preserving real listing images, title/price, the Ad label and existing product/service context. Banner width is88?112 logical pixels, height approximately56% of width (112?63 on a400-wide screen); its image area is below one third of the ordinary180?140 listing image. Position dots show progress across the row. Six-second paging, manual swiping, Pause/Play, reduced-motion preference, touch pause, offscreen/background pause and impression rules remain intact. Normal listings and detail recommendations retain their layout.

## Validation

- Full TypeScript check passed.
- Gallery policy, Google exchange and actual auth handler/screen tests passed: permission denial, Android fallback, cancellation, competing taps/flows, single-shot requests, stalled response bodies, transient retry without logout, rejected credentials, browser cancellation and stale sessions.
- Existing overload, session-startup, auth/workspace, discovery/cache, carousel, provider catalogue/chat and workspace transport checks passed.
- ESLint: zero errors; all21 warnings across changed existing screens exactly match the baseline. New helpers have no lint diagnostics.
- No physical Android device is connected through ADB. Native picker/OAuth behavior remains unqualified on the affected handset. No production release is approved by these automated results.

## Device acceptance before release

Test the affected phone and a second Android vendor/version. Exercise denied photo permission, gallery and system Files, single/multiple images, crop/cancel, large/unsupported files, camera verification, background/return and weak connectivity. Check each changed upload destination. Verify Google sign-in, cancellation, explicit retry after overload/offline, an expired Google session and prevention of stale account persistence. Confirm compact ads and gentle paging on a real screen with reduced motion on/off.
