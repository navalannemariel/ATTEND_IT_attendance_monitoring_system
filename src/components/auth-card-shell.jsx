import Image from "next/image";

/** Flowing wave lines used as a decorative side accent. */
function Waves({ className, color }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 400 400"
      fill="none"
    >
      {[0, 18, 36, 54].map((o) => (
        <path
          key={o}
          d={`M-20 ${260 + o} C 80 ${180 + o}, 200 ${320 + o}, 420 ${200 + o}`}
          stroke={color}
          strokeWidth="2.5"
          opacity={0.5 - o / 160}
        />
      ))}
    </svg>
  );
}

/**
 * Centered floating-card layout shared by the login and forgot-password
 * screens: decorative waves, a big visible logo, and a white card.
 */
export function AuthCardShell({ children }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 to-slate-200 px-4 py-10">
      {/* Decorative flowing waves */}
      <Waves
        className="pointer-events-none absolute -left-24 bottom-0 h-[520px] w-[520px] text-primary"
        color="currentColor"
      />
      <Waves
        className="pointer-events-none absolute -right-24 top-0 h-[520px] w-[520px] rotate-180 text-rose-400/70"
        color="currentColor"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/3 size-[420px] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-10 size-[360px] rounded-full bg-rose-300/20 blur-3xl"
      />

      {/* Big logo watermark — large enough to stay visible around the card */}
      <Image
        src="/hhca-logo.jpg"
        alt=""
        aria-hidden
        width={760}
        height={760}
        priority
        className="pointer-events-none absolute left-1/2 top-1/2 w-[min(760px,96vw)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
      />

      {/* Top-left brand */}
      <div className="absolute left-5 top-5 flex items-center gap-2.5">
        <Image
          src="/hhca-logo.jpg"
          alt="Holy Heart Christian Academy logo"
          width={36}
          height={36}
          className="rounded-full ring-1 ring-black/5"
          priority
        />
        <span className="hidden text-sm font-semibold text-foreground/80 sm:block">
          Holy Heart Christian Academy
        </span>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] sm:px-10">
          {/* Visible logo on the card */}
          <div className="mb-6 flex justify-center">
            <Image
              src="/hhca-logo.jpg"
              alt="Holy Heart Christian Academy logo"
              width={88}
              height={88}
              priority
              className="rounded-full ring-4 ring-primary/10 shadow-md"
            />
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Holy Heart Christian Academy, Manila.
          All rights reserved.
          {" · "}
          <a
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Privacy Notice
          </a>
        </p>
      </div>
    </main>
  );
}
