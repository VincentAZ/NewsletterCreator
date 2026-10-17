NewsletterCreator is free, open-source software (MIT). It needs no account and
no sign-in. Newsletters, images and settings stay on your computer; nothing is
sent anywhere unless you connect a service in **AI & integrations** and use it.

## Downloads

- **Windows (x64):** `NewsletterCreator-<version>-windows-x64.exe`
- **macOS (Apple Silicon):** `NewsletterCreator-<version>-mac-arm64.dmg`
- **Linux (x64):** `NewsletterCreator-<version>-linux-x86_64.AppImage`

## These builds are not code-signed

Signing certificates cost money and this is a free project, so each operating
system shows a one-time warning for software it cannot verify. The builds are
produced by the public GitHub Actions workflow in this repository from the
tagged commit; you can compare the checksums shown in the workflow log.

- **Windows:** SmartScreen shows "Windows protected your PC". Choose **More
  info**, then **Run anyway**.
- **macOS:** the first launch says the app "cannot be opened because the
  developer cannot be verified". Open **System Settings → Privacy & Security**,
  scroll to the message about NewsletterCreator and choose **Open Anyway**, or
  right-click the app in Applications and choose **Open**.
- **Linux:** mark the AppImage executable (`chmod +x`) and run it. If your
  distribution lacks FUSE, run it with `APPIMAGE_EXTRACT_AND_RUN=1`.

## Optional local AI

Text and image generation are optional. Local inference connects to an LM
Studio or ComfyUI server on your own machine, or installs a managed runtime
after you review the publishers' terms. Cloud providers (OpenRouter, fal.ai)
are explicit choices and are never used as a silent fallback.
