"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Textarea, SavidBubble } from "@/components";
import { entries, auth } from "@/lib/api";

export default function NewEntryPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        setAudioBlob(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch { /* permission denied */ }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.isAuthenticated()) { router.push("/login"); return; }
    setIsSubmitting(true);
    try {
      const uploadedFiles = audioBlob
        ? [...files, new File([audioBlob], `recording-${Date.now()}.webm`, { type: "audio/webm" })]
        : files;
      const entry = await entries.create({ title, content, files: uploadedFiles.length > 0 ? uploadedFiles : undefined });
      router.push(`/entries/${entry.id}`);
    } catch (err) {
      console.error("Failed to create entry:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      <Link href="/dashboard" className="text-body-small text-stone hover:text-lilac-deep no-underline hover:underline inline-flex items-center gap-1 mb-6">← Back to memories</Link>
      <h1 className="font-heading text-h2 font-bold text-charcoal mb-1">📖 New Memory</h1>
      <p className="text-body text-graphite mb-8">What do you remember today?</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input label="Title your memory..." placeholder="A title for this moment..." value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Textarea label="What happened?" placeholder="Write freely — there's no wrong way to tell your story..." value={content} onChange={(e) => setContent(e.target.value)} rows={6} required />

        <div className="input-group">
          <label className="input-label">📎 Add evidence (photo/audio)</label>
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,audio/*" onChange={(e) => { if (e.target.files) setFiles((p) => [...p, ...Array.from(e.target.files!)]); }} className="hidden" />
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-mist rounded-lg p-6 text-center cursor-pointer hover:border-lilac hover:bg-lilac-light/30 transition-all">
            <p className="text-body text-graphite mb-2">Click to upload or drag & drop</p>
            <div className="flex items-center justify-center gap-4 text-2xl opacity-60"><span>🎤</span><span>📷</span><span>📎</span></div>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-lilac-light rounded-lg text-sm text-graphite border border-mist/50">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-stone hover:text-error">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="input-group">
          <label className="input-label">🎤 Record a Voice Memory</label>
          {isRecording ? (
            <div className="audio-recorder">
              <div className="audio-recording-indicator"><span className="dot" /> Recording...</div>
              <div className="audio-waveform recording">
                {Array.from({ length: 20 }).map((_, i) => (<div key={i} className="bar" style={{ height: `${8 + Math.random() * 32}px` }} />))}
              </div>
              <button type="button" className="btn btn-danger btn-sm mt-3" onClick={handleStopRecording}>⏹️ Stop</button>
            </div>
          ) : (
            <div className="audio-recorder">
              <div className="text-3xl mb-2">🎤</div>
              <button type="button" className="btn btn-secondary" onClick={handleStartRecording}>🎙️ Start Recording</button>
              {audioBlob && <p className="text-caption text-success mt-2">✓ Audio recorded</p>}
            </div>
          )}
        </div>

        <div className="ml-12"><SavidBubble message="This sounds important. Take your time." /></div>
        <div className="flex items-center gap-3 pt-4 border-t border-mist">
          <Button type="submit" size="lg" isLoading={isSubmitting}>✨ Save Memory</Button>
          <Link href="/dashboard"><button type="button" className="btn btn-ghost">Cancel</button></Link>
        </div>
      </form>
    </div>
  );
}