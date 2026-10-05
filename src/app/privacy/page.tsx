import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy — Decipher",
  description:
    "How Decipher collects, uses, stores, and protects your journal entries, audio and evidence files, and account information — and how to delete your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <span className="mb-3 inline-block text-4xl" aria-hidden="true">
          🦉
        </span>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-stone">Last updated: September 22, 2026</p>
      </header>

      <p className="text-base leading-relaxed text-graphite">
        Decipher (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a
        private journaling and memory-reflection app. Your memories are deeply
        personal, and protecting them matters to us. This policy explains what
        information we collect, why we collect it, how we keep it, and the
        choices and rights you have.
      </p>

      <Section title="1. Who we are (data controller)">
        <p>
          Decipher is the data controller for the personal information described
          in this policy. You can reach us about anything in this policy at{" "}
          <a
            href="mailto:decipher-7ac0ec8d@ctomail.io"
            className="text-lilac-deep hover:underline"
          >
            decipher-7ac0ec8d@ctomail.io
          </a>
          .
        </p>
      </Section>

      <Section title="2. Decipher is for adults (18+)">
        <p>
          Decipher is intended for adults aged 18 and over. It is not intended
          for minors, and we do not knowingly collect personal information from
          anyone under 18 (and never from children under 13, consistent with the
          U.S. Children&apos;s Online Privacy Protection Act). If you believe
          someone under 18 has provided us data, contact us and we will delete
          it.
        </p>
      </Section>

      <Section title="3. Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account information</strong> — your email address and display
            name. Your password is stored only as a one-way hash (bcrypt); we
            never store it in plaintext.
          </li>
          <li>
            <strong>Journal entries</strong> — the text you write when you log a
            memory.
          </li>
          <li>
            <strong>Audio and evidence files</strong> — audio recordings and
            other files you upload as evidence for an entry.
          </li>
          <li>
            <strong>Savid conversations</strong> — the messages you exchange with
            Savid, our AI mentor.
          </li>
          <li>
            <strong>Edit history</strong> — when you edit an entry, we store the
            reason you log, to keep the record honest.
          </li>
          <li>
            <strong>Subscription and billing information</strong> — we do{" "}
            <em>not</em> collect or store your full payment card details.
            Payments are processed by Stripe, which provides us with your
            subscription status and dates (such as plan, trial end, and next
            billing date).
          </li>
        </ul>
      </Section>

      <Section title="4. How we use your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>To provide the service</strong> — store your entries, serve
            them back to you, and power Savid.
          </li>
          <li>
            <strong>AI processing</strong> — when you write an entry or chat with
            Savid, relevant text and recent conversation context are sent to
            Google&apos;s Gemini generative AI model to generate Savid&apos;s
            responses.
          </li>
          <li>
            <strong>Billing and subscription management</strong> — handled by
            Stripe.
          </li>
          <li>
            <strong>Security, support, and improving the service</strong>.
          </li>
        </ul>
      </Section>

      <Section title="5. Legal bases for processing (GDPR)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Performance of a contract</strong> — to provide your account
            and the service you subscribe to.
          </li>
          <li>
            <strong>Legitimate interests</strong> — security, support, and
            operating and improving the service.
          </li>
          <li>
            <strong>Consent</strong> — where we rely on consent, you may withdraw
            it at any time.
          </li>
        </ul>
      </Section>

      <Section title="6. Data minimization and retention">
        <p>
          We collect only what is needed to provide the service. Your account
          information, entries, audio and evidence files, Savid conversations,
          and edit history are kept while your account is active. If you delete
          your account, we delete those records within 30 days. Certain
          subscription and billing records may be retained for as long as
          necessary to meet legal or accounting obligations.
        </p>
      </Section>

      <Section title="7. How we share information">
        <p>
          We do <strong>not</strong> sell your personal information. We share it
          only with processors we need to operate the service:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Stripe</strong> (United States) — payment processing and
            subscription management.
          </li>
          <li>
            <strong>Google</strong> — the Gemini AI model that powers Savid,
            which may process the text you share with Savid.
          </li>
        </ul>
        <p>
          Where a transfer outside your region occurs, we rely on appropriate
          safeguards such as standard contractual clauses.
        </p>
      </Section>

      <Section title="8. Cookies and tracking">
        <p>
          Decipher does not use advertising, marketing, or third-party analytics
          cookies. We use strictly necessary browser storage to keep you signed
          in. During checkout, our payment processor Stripe may set strictly
          necessary cookies to complete and secure your payment.
        </p>
      </Section>

      <Section title="9. Security">
        <ul className="list-disc space-y-2 pl-5">
          <li>Data is encrypted in transit (HTTPS/TLS).</li>
          <li>Passwords are stored as bcrypt hashes, never in plaintext.</li>
          <li>
            Access to your entries and evidence files is restricted to your
            authenticated account.
          </li>
        </ul>
      </Section>

      <Section title="10. Your rights">
        <p>
          <strong>EEA / UK (GDPR):</strong> you have the right to access,
          rectify, erase (&ldquo;right to be forgotten&rdquo;), restrict, and
          port your data, to object to processing, and to lodge a complaint with
          a supervisory authority.
        </p>
        <p>
          <strong>California (CCPA/CPRA):</strong> California residents have the
          right to know what personal information we collect, the right to
          delete it, the right to correct it, and the right to opt out of the
          &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information. We
          do not sell personal information and do not share it for cross-context
          behavioral advertising. We will not discriminate against you for
          exercising these rights.
        </p>
        <p>
          To exercise any right, email us at{" "}
          <a
            href="mailto:decipher-7ac0ec8d@ctomail.io"
            className="text-lilac-deep hover:underline"
          >
            decipher-7ac0ec8d@ctomail.io
          </a>
          . We will respond within the timeframe required by law (typically 30
          days).
        </p>
      </Section>

      <Section title="11. How to delete your account and all your data">
        <p>
          Email us at{" "}
          <a
            href="mailto:decipher-7ac0ec8d@ctomail.io"
            className="text-lilac-deep hover:underline"
          >
            decipher-7ac0ec8d@ctomail.io
          </a>{" "}
          from the email address on your account, asking to delete your account.
          We will delete your account, journal entries, audio and evidence
          files, Savid conversations, and edit history.
        </p>
      </Section>

      <Section title="12. International transfers">
        <p>
          Decipher operates from servers in the United States, and your
          information may be processed in the U.S. by us, by Stripe (U.S.), and
          by Google (for the AI model). Where transfers are subject to
          data-protection law, they rely on appropriate safeguards.
        </p>
      </Section>

      <Section title="13. Changes to this policy">
        <p>
          We may update this policy from time to time. When we do, we will post
          the updated version here with a new &ldquo;last updated&rdquo; date.
          Continued use after a change means you accept the updated policy.
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
