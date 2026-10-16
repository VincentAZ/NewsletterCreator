// Signing is opt-in. The ordinary build continues to produce unsigned previews.
module.exports = {
  extends: "./electron-builder.yml",
  forceCodeSigning: true,
  directories: { output: "release/signed" },
  mac: {
    hardenedRuntime: true,
    notarize: true,
    artifactName:
      "NewsletterCreator-${version}-mac-${arch}-signed-candidate.${ext}",
  },
  win: {
    artifactName:
      "NewsletterCreator-${version}-windows-${arch}-signed-candidate.${ext}",
  },
};
