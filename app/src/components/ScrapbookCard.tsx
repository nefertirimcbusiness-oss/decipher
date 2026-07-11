"use client";

import React from "react";

interface ScrapbookCardProps {
  title: string;
  date: string;
  content: string;
  evidenceCount?: number;
  hasSavidResponse?: boolean;
  emotion?: string;
  onClick?: () => void;
  className?: string;
}

export function ScrapbookCard({
  title,
  date,
  content,
  evidenceCount,
  hasSavidResponse,
  emotion,
  onClick,
  className = "",
}: ScrapbookCardProps) {
  return (
    <div
      className={`memory-thumbnail ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div>
        <p className="memory-thumbnail-date">{date}</p>
        <h3 className="memory-thumbnail-title">{title}</h3>
      </div>

      <div>
        {/* Content preview */}
        <p className="text-body-small text-graphite leading-relaxed line-clamp-3 mb-2">
          {content}
        </p>

        {/* Badges */}
        <div className="memory-thumbnail-badges">
          {emotion && (
            <span className="px-2 py-0.5 rounded-full bg-buttercream text-xs text-graphite border border-mist/50">
              {emotion}
            </span>
          )}
          {evidenceCount !== undefined && evidenceCount > 0 && (
            <span className="memory-thumbnail-badge">📎</span>
          )}
          {hasSavidResponse && (
            <span className="memory-thumbnail-badge">🦉</span>
          )}
        </div>
      </div>
    </div>
  );
}