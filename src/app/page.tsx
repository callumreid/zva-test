import ZvaChat from "@/components/ZvaChat";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-12 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Zoom Virtual Agent Test
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Test site for the Zoom Virtual Agent (ZVA) web chat widget.
            The chat widget will appear in the bottom-right corner when configured.
          </p>
        </div>

        {/* ZVA Chat Component */}
        <ZvaChat />

        {/* Setup Guide */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Setup Guide
          </h2>
          <ol className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                1
              </span>
              <span>
                Sign into{" "}
                <a
                  href="https://zoom.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline dark:text-blue-400"
                >
                  zoom.us
                </a>{" "}
                as an admin with a Zoom Virtual Agent license
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                2
              </span>
              <span>
                Navigate to <strong>AI Studio &gt; Virtual Agents</strong> and
                create a <strong>Chat Agent</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                3
              </span>
              <span>
                Go to the <strong>Campaigns</strong> tab and create a new
                campaign with <strong>Web Chat</strong> as the channel
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                4
              </span>
              <span>
                Click <strong>&quot;Embed Web Tag&quot;</strong> to get your API key
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                5
              </span>
              <span>
                Set{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                  NEXT_PUBLIC_ZVA_API_KEY
                </code>{" "}
                in your <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">.env.local</code> file
                (or as a Vercel environment variable)
              </span>
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-400">
          Coval ZVA Test Site &mdash; For evaluation and simulation testing
        </div>
      </main>
    </div>
  );
}
