"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Input, Textarea, Modal, SavidBubble, UserMessageBubble } from "@/components";
import { entries, savid, auth, Entry } from "@/lib/api";

export default function EntryDetailPage() {
  const params = useParams();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editReason, setEditReason] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<{ role: string; message: string }[]>([]);
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated() || !params.id) return;
    entries.get(params.id as string).then((data) => {
      setEntry(data);
      setEditContent(data.content);
      setChat(data.savidConversation || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [params.id]);

  const handleEditSubmit = async () => {
    if (!entry || !editReason.trim()) return;
    try {
      const updated = await entries.update(entry.id, { content: editContent, reason: editReason });
      setEntry(updated);
      setShowEditModal(false);
      setEditReason("");
    } catch (err) {
      console.error("Edit failed:", err);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !entry || sendingChat) return;
    const msg = chatInput;
    setChatInput("");
    setChat((prev) => [...prev, { role: "user", message: msg }]);
    setSendingChat(true);
    try {
      const res = await savid.chat(entry.id, msg);
      setChat((prev) => [...prev, { role: "savid", message: res.reply }]);
    } catch { /* ignore */ }
    setSendingChat(false);
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="savid-thinking"><span className="dot" /><span className="dot" /><span className="dot" /></div>
    </div>
  );

  if (!entry) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-body text-graphite">Entry not found</p>
      <Link href="/dashboard" className="btn btn-ghost mt-4">← Back</Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <Link href="/dashboard" className="text-body-small text-stone hover:text-lilac-deep no-underline hover:underline inline-flex items-center gap-1 mb-6">
        ← Back to memories <span className="text-caption text-stone ml-2">{entry.date?.slice(0, 10)}</span>
      </Link>

      <div className="scrapbook-page">
        <h1 className="scrapbook-heading">✨ {entry.title} ✨</h1>
        <div className="h-3 w-3/5 bg-lilac/30 rounded-sm mx-auto -mt-1 mb-4 rotate-[-1deg]" />

        {entry.content?.split("\n\n").map((paragraph, i) => (
          <p key={i} className="text-body text-charcoal leading-loose mb-4 last:mb-0">{paragraph}</p>
        ))}

        {entry.evidence && entry.evidence.length > 0 && (
          <div className="scrapbook-evidence">
            {entry.evidence.map((file, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="text-xl">{file.type === "image" ? "📷" : "🎵"}</span>
                <div className="flex-1">
                  <p className="text-body-small font-medium text-charcoal">{file.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <span className="scrapbook-decoration">🌸</span>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-mist/50">
          <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>✏️ Edit</Button>
          {entry.editHistory && entry.editHistory.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEditHistory(!showEditHistory)}>
              🕐 Edited {entry.editHistory.length} times
            </button>
          )}
        </div>

        {showEditHistory && entry.editHistory && (
          <div className="mt-4">
            <div className="history-timeline">
              {entry.editHistory.map((edit, i) => (
                <div key={i} className={`history-item ${edit.isOriginal ? "original" : ""}`}>
                  <p className="history-timestamp">{edit.date}</p>
                  <div className="history-reason">&ldquo;{edit.reason}&rdquo;</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Savid chat */}
      <div className="mt-8">
        <h3 className="font-body text-h4 font-semibold text-charcoal mb-4 flex items-center gap-2">🦉 Conversation with Savid</h3>
        <div className="card">
          <div className="max-h-[400px] overflow-y-auto space-y-4 mb-4">
            {chat.map((msg, i) =>
              msg.role === "savid" ? <SavidBubble key={i} message={msg.message} /> : <UserMessageBubble key={i} message={msg.message} />
            )}
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-mist/50">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder="Reply to Savid..." className="input-field flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleChatSend(); }}
            />
            <button className="btn btn-primary btn-icon" onClick={handleChatSend} disabled={sendingChat}>💬</button>
          </div>
        </div>
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="✏️ Edit Memory">
        <div className="flex flex-col gap-4">
          <Textarea label="Edit your entry" rows={6} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          <Input label="Reason for edit" placeholder="Why are you making this change?" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
          <div className="flex gap-3 mt-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={!editReason.trim()}>Save Edit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}