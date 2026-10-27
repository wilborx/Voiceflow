"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="E-Mail" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Passwort" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Anmelden …" : "Anmelden"}</Button>
    </form>
  );
}
