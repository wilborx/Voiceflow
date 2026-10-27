"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "../ui";

export function SubmitButton({ confirm, children, ...p }: ComponentProps<typeof Button> & { confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || p.disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...p}
    >
      {pending ? "…" : children}
    </Button>
  );
}
