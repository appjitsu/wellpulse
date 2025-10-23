export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="flex flex-col items-center gap-8 p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            WellPulse Admin Portal
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl">
            Internal platform administration for managing tenants, billing, and system health.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-sm text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span>Running on port 3002</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-left">
            <span className="font-semibold">Purpose:</span>
            <span>Tenant management & billing</span>
            <span className="font-semibold">Users:</span>
            <span>WellPulse staff only</span>
            <span className="font-semibold">Architecture:</span>
            <span>Next.js 15, React 19, Tailwind CSS 4</span>
          </div>
        </div>

        <div className="mt-8 p-6 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700 max-w-2xl">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Next Steps:</strong> Implement authentication for admin users, tenant
            provisioning UI, billing management, usage analytics, and system health monitoring.
          </p>
        </div>
      </main>
    </div>
  );
}
