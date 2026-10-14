import Link from "next/link";

export const metadata = {
  title: "Privacy Notice — Holy Heart Christian Academy",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            ← Back to Login
          </Link>
        </div>

        <div className="rounded-2xl bg-white px-8 py-10 shadow-sm border border-slate-200">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            Privacy Notice
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Holy Heart Christian Academy, Manila &mdash; Attendance Management System
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-foreground/80">
            <section>
              <h2 className="font-semibold text-foreground mb-2">1. Data We Collect</h2>
              <p>
                We collect personal information including name, email address, and — for
                students and staff — biometric face recognition data used exclusively for
                 attendance tracking within school premises.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground mb-2">2. Legal Basis</h2>
              <p>
                Biometric data is processed under Republic Act No. 10173 (Data Privacy Act
                of 2012). Informed, documented consent is obtained from the individual or
                their authorized guardian before any biometric data is collected.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground mb-2">3. How We Use Your Data</h2>
              <p>
                Attendance records and biometric data are used solely to record and report
                school attendance. Data is not sold, shared with third parties, or used for
                any other purpose.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground mb-2">4. Data Retention</h2>
              <p>
                Records are retained for the duration required by applicable regulations.
                Biometric templates are deleted upon a subject&rsquo;s withdrawal from the school
                or upon written request to the school administration.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground mb-2">5. Your Rights</h2>
              <p>
                Under RA 10173 you have the right to access, correct, and request deletion
                of your personal data. Contact the school&rsquo;s Data Protection Officer at the
                school administration office.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground mb-2">6. Security</h2>
              <p>
                All data is stored securely with access restricted to authorized school
                personnel. Biometric embeddings are stored as numerical vectors and cannot
                be reverse-engineered into a photograph.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Holy Heart Christian Academy, Manila. All rights reserved.
          </div>
        </div>
      </div>
    </main>
  );
}
