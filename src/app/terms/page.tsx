import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service — Decipher",
  description:
    "The terms for using Decipher: subscription and billing (7-day free trial, $24.99/month, first month 50% off), acceptable use, content ownership, and the logged-edit-reason policy.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <span className="mb-3 inline-block text-4xl" aria-hidden="true">
          🦉
        </span>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-stone">Last updated: September 22, 2026</p>
      </header>

      <Section title="1. Agreement to these terms">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are a legal agreement
          between you and Decipher (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;) governing your use of the Decipher app and website
          (the &ldquo;Service&rdquo;). By creating an account or using the
          Service, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>
          The Service is for adults aged 18 and over. By using it, you represent
          that you are at least 18 years old.
        </p>
      </Section>

      <Section title="3. What the Service is">
        <p>
          Decipher is a private journaling and memory-reflection app. You log
          memories as text or audio, attach evidence files, and each entry
          becomes a scrapbook page. Savid, our AI mentor, offers questions and
          gentle guidance. Entries may only be edited with a logged reason, to
          keep the record honest.
        </p>
      </Section>

      <Section title="4. Subscription and billing">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>7-day free trial</strong> — full access, no credit card
            required to start.
          </li>
          <li>
            <strong>After the trial</strong>, the subscription is{" "}
            <strong>$24.99/month</strong>.
          </li>
          <li>
            <strong>First month 50% off</strong> — your first paid month is{" "}
            <strong>$12.49</strong>, then $24.99/month.
          </li>
          <li>
            <strong>Auto-renewal</strong> — your subscription renews monthly
            until you cancel.
          </li>
          <li>
            <strong>Cancellation</strong> — you may cancel at any time with one
            click from within the app. Cancellation takes effect immediately and
            stops future charges. Unless required by law, there are no refunds
            for partial billing periods.
          </li>
        </ul>
        <p>
          Payments are processed by Stripe. We do not collect or store your full
          payment card details.
        </p>
      </Section>

      <Section title="5. Your account">
        <p>
          You are responsible for keeping your login credentials secure and for
          all activity that occurs under your account. Contact us promptly if
          you believe your account has been compromised.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Upload anything unlawful, infringing, or harmful;</li>
          <li>Impersonate any person or misrepresent your affiliation;</li>
          <li>Harass, threaten, or abuse others;</li>
          <li>
            Attempt to gain unauthorized access to the Service or its systems;
          </li>
          <li>
            Interfere with or disrupt the Service&apos;s operation or security.
          </li>
        </ul>
      </Section>

      <Section title="7. Your content">
        <p>
          You retain ownership of the journal entries, audio, evidence files,
          and other content you create. By using the Service, you grant Decipher
          a limited license to store, display, and process your content solely
          to provide the Service — including sending relevant text to the AI
          model that generates Savid&apos;s responses.
        </p>
      </Section>

      <Section title="8. Logged-edit-reason policy">
        <p>
          To keep the record honest, entries may only be edited with a logged
          reason. The reason you provide is stored alongside the edit and is
          viewable in the edit history. Do not use edits to misrepresent what
          happened.
        </p>
      </Section>

      <Section title="9. Intellectual property">
        <p>
          Decipher owns the app, its design, branding, and the Savid character
          and responses. Nothing in these Terms transfers any intellectual
          property rights to you except the limited rights to use the Service.
        </p>
      </Section>

      <Section title="10. Health disclaimer">
        <p>
          Decipher is not a substitute for professional medical or therapeutic
          advice, diagnosis, or treatment. Please read our{" "}
          <a href="/disclaimer" className="text-lilac-deep hover:underline">
            Health &amp; Safety Disclaimer
          </a>{" "}
          before relying on the Service.
        </p>
      </Section>

      <Section title="11. Disclaimers and warranties">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo; without warranties of any kind, express or implied,
          including warranties of merchantability, fitness for a particular
          purpose, and non-infringement. We do not warrant that the Service will
          be uninterrupted, error-free, or free of harmful components.
        </p>
      </Section>

      <Section title="12. Limitation of liability">
        <p>
          To the maximum extent permitted by law, Decipher will not be liable
          for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of data, profits, or goodwill, arising out of or
          related to your use of the Service. Our total liability for any claim
          will not exceed the amount you paid us in the twelve months before the
          claim.
        </p>
      </Section>

      <Section title="13. Indemnification">
        <p>
          You agree to indemnify and hold Decipher harmless from any claims,
          damages, or expenses arising from your misuse of the Service or your
          breach of these Terms.
        </p>
      </Section>

      <Section title="14. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or
          terminate your access if you breach these Terms, with or without
          notice.
        </p>
      </Section>

      <Section title="15. Governing law and jurisdiction">
        <p>
          These Terms are governed by the laws of the State of California,
          United States, without regard to conflict-of-law principles. Disputes
          will be resolved in the state or federal courts located in California.
        </p>
      </Section>

      <Section title="16. Dispute resolution">
        <p>
          Before filing any formal claim, you agree to contact us and try to
          resolve the dispute informally for at least 30 days.
        </p>
      </Section>

      <Section title="17. Severability and entire agreement">
        <p>
          If any provision of these Terms is found unenforceable, the remaining
          provisions stay in effect. These Terms, together with our Privacy
          Policy, are the entire agreement between you and Decipher regarding
          the Service.
        </p>
      </Section>

      <Section title="18. Changes to these terms">
        <p>
          We may update these Terms from time to time. We will post updates here
          with a new &ldquo;last updated&rdquo; date, and for material changes
          we will notify you by email or in the app. Continued use after a
          change means you accept the updated Terms.
        </p>
      </Section>

      <Section title="19. Contact">
        <p>
          Questions about these Terms? Contact us at{" "}
          <a
            href="mailto:decipher-7ac0ec8d@ctomail.io"
            className="text-lilac-deep hover:underline"
          >
            decipher-7ac0ec8d@ctomail.io
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-xl font-bold text-charcoal mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-base leading-relaxed text-graphite">
        {children}
      </div>
    </section>
  );
}
