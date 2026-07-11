"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { entries, auth, Entry } from "@/lib/api";

interface EditItem {
  entryId: string;
  entryTitle: string;
  date: string;
  reason: string;
  isOriginal: boolean;
}

export default function EditsPage() {
  const [edits, setEdits] = useState<EditItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.isAuthenticated()) return;
    entries.list().then((data) => {
      const allEdits: EditItem[] = [];
      data.forEach((entry: Entry) => {
        if (entry.editHistory) {
          entry.editHistory.forEach((edit) => {
            allEdits.push({ ...edit, entryId: entry.id, entryTitle: entry.title });
          });
        }
      });
      setEdits(allEdits);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const titles = [...new Set(edits.map((e) => e.entryTitle))];
  const filtered = filter === "all" ? edits : edits.filter((e) => e.entryTitle === filter);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <h1 className="font-heading text-h2 font-bold text-charcoal mb-1">📝 Edit History</h1>
      <p className="text-body text-graphite mb-6">Every edit is a step in your story. Each version matters.</p>

      <div className="savid-container mb-6">
        <div className="savid-avatar">🦉</div>
        <div className="savid-bubble">
          <p className="savid-name">Savid</p>
          <p className="savid-text">&ldquo;Every edit is a step in your story. Each version matters.&rdquo;</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="savid-thinking"><span className="dot" /><span className="dot" /><span className="dot" /></div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setFilter("all")} className={`btn ${filter === "all" ? "btn-primary" : "btn-ghost"} btn-sm`}>All Edits</button>
            {titles.map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`btn ${filter === t ? "btn-primary" : "btn-ghost"} btn-sm`}>{t}</button>
            ))}
          </div>

          {filtered.length > 0 ? (
            <div className="history-timeline">
              {filtered.map((edit, i) => (
                <Link key={i} href={`/entries/${edit.entryId}`} className="no-underline hover:no-underline group block">
                  <div className={`history-item ${edit.isOriginal ? "original" : ""}`}>
                    <p className="history-timestamp">{edit.date}</p>
                    <p className="text-body-small font-medium text-charcoal">{edit.entryTitle}</p>
                    <div className="history-reason">&ldquo;{edit.reason}&rdquo;</div>
                    <p className="text-caption text-lilac-deep group-hover:underline">View version →</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📖</div>
              <p className="empty-state-text">No edits yet</p>
              <p className="empty-state-subtext">When you edit an entry with a logged reason, it will appear here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}