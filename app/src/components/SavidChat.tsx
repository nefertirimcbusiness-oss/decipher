"use client";

import React from "react";

interface SavidBubbleProps {
  message: string;
  timestamp?: string;
}

export function SavidBubble({ message, timestamp }: SavidBubbleProps) {
  return (
    <div className="savid-container">
      <div className="savid-avatar">🦉</div>
      <div className="savid-bubble">
        <p className="savid-name">Savid</p>
        <p className="savid-text">{message}</p>
        {timestamp && (
          <p className="history-timestamp mt-2">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

export function SavidThinking() {
  return (
    <div className="savid-container">
      <div className="savid-avatar">🦉</div>
      <div className="savid-bubble">
        <p className="savid-name">Savid</p>
        <div className="savid-thinking">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>
    </div>
  );
}

interface UserMessageBubbleProps {
  message: string;
  timestamp?: string;
}

export function UserMessageBubble({ message, timestamp }: UserMessageBubbleProps) {
  return (
    <div className="flex items-start gap-3 max-w-[85%] ml-auto flex-row-reverse">
      <div className="w-9 h-9 rounded-full bg-lilac-light flex items-center justify-center text-lilac-deep text-sm font-bold flex-shrink-0">
        Y
      </div>
      <div>
        <div className="bg-lilac text-charcoal rounded-xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="font-body text-sm leading-relaxed">{message}</p>
        </div>
        {timestamp && <p className="text-xs text-stone mt-1 mr-1 text-right">{timestamp}</p>}
      </div>
    </div>
  );
}