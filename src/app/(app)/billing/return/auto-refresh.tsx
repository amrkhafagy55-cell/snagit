"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the payment status every 3 s for up to ~1 minute while the webhook is on its way. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 20) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
