"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ScrapbookCard, SavidBubble } from "@/components";
import { entries, auth, Entry } from "@/lib/api";

export default function DashboardPage() {
  const [entryList, setEntryList] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!auth.isAuthenticated()) return;
    setUsername(localStorage.getItem("decipher_userId")?.slice(0, 4) || "");
    entries.list().then((data) => {
      setEntryList(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
      <div className="mb-6">
        <p className="text-body text-graphite">Good morning ✨</p>
      </div>

      <div className="mb-8">
        <SavidBubble
          message={`You've written ${entryList.length} memories. That's wonderful. How about we revisit one from a rainy day?`}
          timestamp="Just now"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="savid-thinking">
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
        </div>
      ) : (
        <>
          <div className="memory-card-grid">
            {entryList.map((entry) => (
              <Link key={entry.id} href={`/entries/${entry.id}`} className="no-underline hover:no-underline">
                <ScrapbookCard
                  title={entry.title}
                  date={entry.date?.slice(0, 10) || "Recent"}
                  content={entry.content?.slice(0, 120) || ""}
                  evidenceCount={entry.evidence?.length || 0}
                  hasSavidResponse={(entry.savidConversation?.length || 0) > 0}
                  emotion={entry.emotion || ""}
                />
              </Link>
            ))}
            <Link href="/entries/new" className="no-underline hover:no-underline">
              <div className="memory-thumbnail-add">
                <span className="text-3xl">+</span>
                <span>New Memory</span>
              </div>
            </Link>
          </div>

          {entryList.length === 0 && (
            <div className="empty-state my-8">
              <div className="empty-state-icon">📖</div>
              <p className="empty-state-text">Your scrapbook is empty... (for now)</p>
              <p className="empty-state-subtext">🦉 Every story starts with a single page. Whenever you're ready, I'm here.</p>
              <Link href="/entries/new"><button className="btn btn-primary">✨ Write Your First Memory</button></Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}