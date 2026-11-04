import Link from "next/link"
import { SITE } from "@/lib/site-config"

export const metadata = {
  title: "Privacy — Deep Work Lock",
  description: "Deep Work Lock does not collect, store or transmit any personal data.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <nav className="border-b border-gray-800 bg-gray-950/95 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-x-6 gap-y-1 flex-wrap text-sm">
          <Link href="/" className="font-bold tracking-wider whitespace-nowrap">◉ DEEP WORK LOCK</Link>
          <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">Docs</Link>
          <a href={SITE.repoUrl} className="text-gray-400 hover:text-white transition-colors">GitHub</a>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <h1 className="text-3xl sm:text-4xl font-bold">Privacy</h1>
        <p className="text-gray-300 leading-relaxed">
          Deep Work Lock does not collect, store or transmit any personal data. The browser extension talks only to
          the GNOME extension on your own computer. The only network requests are update checks made by your browser
          and by GNOME, to the Chrome Web Store, to {SITE.siteUrl}/updates.json and to extensions.gnome.org.
        </p>
        <p className="text-gray-300 leading-relaxed">
          Questions? Open an issue on{" "}
          <a href={`${SITE.repoUrl}/issues`} className="underline hover:text-white">GitHub</a>.
        </p>
      </main>
    </div>
  )
}
