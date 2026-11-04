import { CopyCommand } from "@/components/copy-command"
import { SITE } from "@/lib/site-config"

const steps = [
  {
    title: "Pick a duration and a target",
    body: "25 to 90 minutes or your own. A window, a whole app, or one Chrome or Firefox tab.",
  },
  {
    title: "Your desktop goes quiet",
    body: "Top bar and dock greyed out, Alt+Tab and Super disabled, notifications off, other windows minimised.",
  },
  {
    title: "Tabs stay locked",
    body: "New tabs and windows closed, navigation kept on the tab's site, internal pages blocked.",
  },
]

const installSteps = [
  "Loads the GNOME extension from extensions.gnome.org — GNOME asks you to confirm, one click.",
  "The extension installs its own bridge to your browsers — in your home folder, no root.",
  "Adds the browser extension to Chrome and Firefox — asks for your password once, then restart your browser.",
]

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <nav className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-x-6 gap-y-1 flex-wrap min-w-0">
            <a href="#top" className="font-bold tracking-wider whitespace-nowrap">
              ◉ DEEP WORK LOCK
            </a>
            <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-sm text-gray-400">
              <a href="#how" className="hover:text-white transition-colors">How it works</a>
              <a href="#install" className="hover:text-white transition-colors">Install</a>
              <a href="/docs" className="hover:text-white transition-colors">Docs</a>
              <a href={SITE.repoUrl} className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
          <div className="hidden lg:block min-w-0 max-w-md">
            <CopyCommand command={SITE.installCommand} id="nav" compact />
          </div>
        </div>
      </nav>

      <main id="top">
        <section className="px-4 py-16 sm:px-6 sm:py-24 border-b border-gray-800">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              One target. One timer. No stop button.
            </h1>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10">
              Deep Work Lock keeps a single window, app or browser tab in front of you until the countdown ends.
              Everything else on your desktop is switched off.
            </p>
            <div className="max-w-2xl mx-auto text-left">
              <CopyCommand command={SITE.installCommand} id="hero" />
            </div>
            <p className="mt-6 text-sm text-gray-400">
              Linux · GNOME 46–49 · X11 and Wayland · Chrome and Firefox
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
              <span className="border border-gray-800 px-3 py-1">Windows — coming soon</span>
              <span className="border border-gray-800 px-3 py-1">macOS — coming soon</span>
            </div>
          </div>
        </section>

        <section id="how" className="px-4 py-16 sm:px-6 border-b border-gray-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-10 text-center">How it works</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title} className="border border-gray-800 bg-gray-950 p-6">
                  <div className="text-gray-500 text-sm mb-3">0{i + 1}</div>
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="px-4 py-16 sm:px-6 border-b border-gray-800">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">Install</h2>
            <CopyCommand command={SITE.installCommand} id="install" />
            <h3 className="text-lg font-bold mt-10 mb-4">What the command does</h3>
            <ol className="space-y-3 text-sm text-gray-300">
              {installSteps.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gray-500 shrink-0">{i + 1}.</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-sm text-gray-400">
              Requirements: GNOME Shell 46 to 49, Python 3, Google Chrome (deb) and/or Firefox (snap or Mozilla build).
            </p>
            <p className="mt-4 text-sm flex flex-wrap gap-x-6 gap-y-2">
              <a href={`${SITE.siteUrl}/install.sh`} className="underline underline-offset-4 hover:text-gray-300">
                Read the script before running it
              </a>
              <a
                href={`${SITE.repoUrl}/blob/main/scripts/install.sh`}
                className="text-gray-500 underline underline-offset-4 hover:text-gray-300"
              >
                Source on GitHub
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="px-4 py-8 sm:px-6 text-sm text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href="/docs#uninstall" className="hover:text-white transition-colors">Uninstall</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href={SITE.repoUrl} className="hover:text-white transition-colors">GitHub</a>
          <span className="sm:ml-auto">v{SITE.version}</span>
          <span>GPL-3.0</span>
        </div>
      </footer>
    </div>
  )
}
