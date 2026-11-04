import release from '../release.json'

export const SITE = {
  version: release.version,
  siteUrl: release.siteUrl,
  repoUrl: `https://github.com/${release.repo}`,
  installCommand: `curl -fsSL ${release.siteUrl}/install.sh | bash`,
  uninstallCommand: `curl -fsSL ${release.siteUrl}/uninstall.sh | bash`,
}
