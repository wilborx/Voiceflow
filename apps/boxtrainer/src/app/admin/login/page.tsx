import type { Metadata } from "next";
import { isDemo } from "@/lib/config";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin-Login", robots: { index: false } };

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl">Admin</h1>
        <p className="mt-1 text-sm text-muted">Melde dich an, um Anfragen zu verwalten.</p>
        {isDemo && (
          <p className="mt-4 rounded-lg border border-amber-900 bg-amber-950/50 p-3 text-sm text-amber-200">
            Demo-Modus: <strong>admin@demo.de</strong> / <strong>demo</strong>
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
