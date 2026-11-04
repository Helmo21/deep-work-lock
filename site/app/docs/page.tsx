import type { ReactNode } from "react"
import Link from "next/link"
import { CopyCommand } from "@/components/copy-command"
import { SITE } from "@/lib/site-config"

export const metadata = {
  title: "Docs — Deep Work Lock",
  description: "How Deep Work Lock works, how to install and remove it, and what to do when something goes wrong.",
}

const sections = [
  { id: "how-it-works", title: "How it works" },
  { id: "install", title: "Install" },
  { id: "using-it", title: "Using it" },
  { id: "during-a-session", title: "During a session" },
  { id: "behaviour-choices", title: "Behaviour choices" },
  { id: "known-limits", title: "Known limits" },
  { id: "troubleshooting", title: "Troubleshooting" },
  { id: "uninstall", title: "Uninstall" },
  { id: "development", title: "Development" },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-2">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-gray-300 leading-relaxed">{children}</p>
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2 text-gray-300 leading-relaxed">{children}</ul>
}

function Code({ children }: { children: ReactNode }) {
  return <code className="bg-gray-900 border border-gray-800 px-1.5 py-0.5 text-sm text-white break-words">{children}</code>
}

function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-gray-800 bg-gray-950 p-4 space-y-2">
      <h3 className="font-bold text-white">{title}</h3>
      <div className="text-gray-300 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <nav className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center gap-x-6 gap-y-1 flex-wrap text-sm">
          <Link href="/" className="font-bold tracking-wider whitespace-nowrap">◉ DEEP WORK LOCK</Link>
          <Link href="/docs" className="text-white">Docs</Link>
          <a href={SITE.repoUrl} className="text-gray-400 hover:text-white transition-colors">GitHub</a>
          <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:flex lg:gap-12">
        <aside className="lg:w-56 lg:shrink-0 mb-10 lg:mb-0">
          <nav aria-label="Documentation sections" className="lg:sticky lg:top-20">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Documentation</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-y-2 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-gray-400 hover:text-white transition-colors">{s.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 max-w-3xl space-y-14">
          <header className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold">Documentation</h1>
            <p className="text-gray-400">Version {SITE.version} — Linux, GNOME on X11 and Wayland.</p>
          </header>

          <Section id="how-it-works" title="How it works">
            <P>
              Deep Work Lock locks a GNOME desktop on one target until a timer runs out. You choose a duration and a
              single target: a window, a whole application, or one Chrome or Firefox tab. Until the countdown ends, that
              is the only thing you can see and use. There is no stop button.
            </P>
          </Section>

          <Section id="install" title="Install">
            <P>Run this in a terminal, as your normal user:</P>
            <CopyCommand command={SITE.installCommand} id="docs-install" />
            <P>The command does three things:</P>
            <ol className="list-decimal pl-5 space-y-2 text-gray-300 leading-relaxed">
              <li>Loads the GNOME extension from extensions.gnome.org. GNOME asks you to confirm, one click.</li>
              <li>The extension installs its own bridge to your browsers, in your home folder, with no root.</li>
              <li>Adds the browser extension to Chrome and Firefox. It asks for your password once; then restart your browser.</li>
            </ol>
            <h3 className="text-lg font-bold text-white pt-2">Requirements</h3>
            <List>
              <li>GNOME Shell 46, 47, 48 or 49.</li>
              <li>Google Chrome and/or Firefox if you want to lock browser tabs. Only the browsers you have are configured.</li>
              <li>Firefox installed as a snap is supported; other Firefox builds and other browsers (Chromium, Brave…) are not.</li>
            </List>
            <P>Running the command again is safe: it updates an existing installation and ends in the same state.</P>
            <h3 className="text-lg font-bold text-white pt-2">Two consequences of browser policies</h3>
            <List>
              <li>
                Chrome shows <Code>Managed by your organization</Code> in its menu for as long as the policy that
                installs the extension exists. Uninstalling removes it.
              </li>
              <li>
                Browser policies live in <Code>/etc</Code> and apply to every account on the computer, so the browser
                extension appears for every user. The GNOME lock is installed only for the account that ran the command.
              </li>
            </List>
          </Section>

          <Section id="using-it" title="Using it">
            <P>
              Click <strong className="text-white">◉ Focus</strong> in the top bar and choose a duration: 25, 30, 45,
              60 or 90 minutes, or a value of your own. Then choose a target and click{" "}
              <strong className="text-white">Lock for N min</strong>. Chrome and Firefox windows expand to offer their tabs.
            </P>
          </Section>

          <Section id="during-a-session" title="During a session">
            <List>
              <li>The top bar and the dock are greyed out and inert, and the countdown shows in orange.</li>
              <li>Alt+Tab, Super, the overview, the hot corner, workspaces and launcher shortcuts are disabled.</li>
              <li>Every other window is minimised. Dialogs belonging to the target stay usable.</li>
              <li>Notifications are turned off.</li>
              <li>Super+L still works, and the time keeps running while the screen is locked.</li>
            </List>
            <P>For a Chrome or Firefox tab:</P>
            <List>
              <li>New tabs and windows are closed, and focus is forced back to the tab.</li>
              <li>Internal pages are blocked (<Code>chrome://</Code>, <Code>about:addons</Code>, <Code>about:config</Code>, <Code>about:debugging</Code>…).</li>
              <li>
                Navigation stays on the tab&apos;s host and its subdomains: a lock on <Code>docs.google.com</Code> does
                not open <Code>mail.google.com</Code> or <Code>gemini.google.com</Code>. The only exceptions are the
                Google, Microsoft and Apple sign-in pages (<Code>accounts.google.com</Code>, <Code>login.microsoftonline.com</Code>…).
              </li>
              <li>Popups opened by the tab (for sign-in) are allowed, but must stay on those same sites or they are closed.</li>
            </List>
          </Section>

          <Section id="behaviour-choices" title="Behaviour choices">
            <List>
              <li>
                <strong className="text-white">Target closed:</strong> the session continues. A closed tab is reopened
                on its last address. A closed window leaves an empty desktop; only a window of the same application{" "}
                <em>opened after the lock started</em> can become the new target, and windows that were already open stay
                hidden. If it was the browser&apos;s last window, the browser closes and the desktop stays empty until the
                end. A new browser window becomes the target only if the extension announces it.
              </li>
              <li>
                <strong className="text-white">Firefox restarting by itself</strong> (an update): its windows stay hidden
                until the extension reconnects, finds the locked tab (or reopens it on its last address) and announces
                its window. In Firefox troubleshooting mode the extension does not run, so the desktop stays empty.
              </li>
              <li>
                <strong className="text-white">Browser windows with the same title:</strong> they do not offer their tabs
                in the menu, because there is no way to tell them apart. They can still be locked as windows.
              </li>
              <li><strong className="text-white">GNOME Shell restarts:</strong> the session resumes with the time remaining.</li>
              <li><strong className="text-white">The computer restarts:</strong> the session ends and every setting is restored at startup.</li>
            </List>
          </Section>

          <Section id="known-limits" title="Known limits">
            <List>
              <li>Ctrl+Alt+F3 (text console) and rebooting get you out. This is intentional.</li>
              <li>
                Chrome DevTools <strong className="text-white">docked in the tab</strong> (F12) cannot be blocked by an
                extension. Detached into their own window, they are minimised.
              </li>
              <li>Incognito and private windows: the extension has no access to them, but the desktop lock minimises them.</li>
              <li>The Firefox sidebar (bookmarks, history, AI assistant) is not a tab, so an extension cannot close it.</li>
              <li>If the target is a terminal, <Code>gnome-extensions disable</Code> remains possible from that terminal.</li>
              <li>Other desktops and other browsers are not supported, and Firefox is supported only as a snap.</li>
            </List>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-4">
              <Problem title="The GNOME dialog never appeared">
                <p>Run the install command again.</p>
              </Problem>
              <Problem title="◉ Focus is missing after install">
                <p>Log out and back in, so GNOME loads the extension.</p>
              </Problem>
              <Problem title="Chrome does not show the extension">
                <p>
                  Restart Chrome and wait a minute, then open <Code>chrome://policy</Code> and check that the Deep Work
                  Lock policy is listed.
                </p>
              </Problem>
              <Problem title={'Firefox tabs are "unavailable"'}>
                <p>
                  Restart Firefox, then run the install command again. For a snap Firefox, the command grants the
                  permission that lets the extension reach the bridge.
                </p>
              </Problem>
              <Problem title={'Chrome says "managed by your organization"'}>
                <p>
                  That is how Chrome labels any extension installed by policy. It stays as long as the policy exists
                  and is removed by the uninstall command.
                </p>
              </Problem>
              <Problem title="Several accounts on this computer">
                <p>
                  Browser policies apply to every account on the computer, while the GNOME lock is installed only for
                  the account that ran the command.
                </p>
              </Problem>
            </div>
          </Section>

          <Section id="uninstall" title="Uninstall">
            <P>
              This removes the extensions and the browser policies, and restores your settings if a session was running.
            </P>
            <CopyCommand command={SITE.uninstallCommand} id="docs-uninstall" />
          </Section>

          <Section id="development" title="Development">
            <P>
              The source is on{" "}
              <a href={SITE.repoUrl} className="underline hover:text-white">GitHub</a>. To try a local build, run{" "}
              <Code>scripts/dev-install.sh</Code> from a checkout; it builds the repository and links the extension
              into your GNOME extensions folder. <Code>npm test</Code> runs the test suite.
            </P>
          </Section>
        </main>
      </div>
    </div>
  )
}
