import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Health & Safety Disclaimer — Decipher",
  description:
    "Decipher is not a substitute for professional medical or therapeutic advice. If you are in crisis, seek immediate help from emergency services or a licensed professional.",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <span className="mb-3 inline-block text-4xl" aria-hidden="true">
          🦉
        </span>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">
          Health &amp; Safety Disclaimer
        </h1>
        <p className="text-sm text-stone">Last updated: September 22, 2026</p>
      </header>

      <div className="rounded-2xl border border-lilac bg-white p-6 mb-8">
        <p className="text-base font-semibold text-charcoal">
          Decipher is a private documentation and reflection tool. It is{" "}
          <strong>not</strong> a substitute for professional medical,
          psychological, or therapeutic advice, diagnosis, or treatment.
        </p>
      </div>

      <Section title="If you are in crisis">
        <p>
          If you are in crisis, or having thoughts of harming yourself or
          others, please get help right now:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Call your local emergency number (for example, 911 in the U.S.).
          </li>
          <li>Go to your nearest emergency room.</li>
          <li>Contact a licensed mental-health professional.</li>
          <li>
            In the U.S., you can also call or text the{" "}
            <strong>988 Suicide &amp; Crisis Lifeline</strong>.
          </li>
        </ul>
      </Section>

      <Section title="What Decipher is — and is not">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Decipher does <strong>not</strong> provide therapy, medical care, or
            diagnosis.
          </li>
          <li>
            Decipher does <strong>not</strong> monitor for emergencies. No one
            is watching your entries in real time.
          </li>
          <li>
            Savid is an AI assistant, <strong>not</strong> a clinician, and
            cannot provide medical or crisis care.
          </li>
        </ul>
      </Section>

      <Section title="Your responsibility">
        <p>
          You are responsible for your own actions and for seeking appropriate
          professional care. Do not disregard professional medical or
          therapeutic advice, or delay seeking it, because of anything you read
          or experience in Decipher. If you are in or alongside therapy,
          Decipher is meant to be a companion to that care — not a replacement
          for it.
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
