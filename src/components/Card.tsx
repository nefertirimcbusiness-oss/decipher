"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  surface?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className = "",
  hoverable = false,
  surface = false,
  onClick,
}: CardProps) {
  return (
    <div
      className={`card ${surface ? "card-surface" : ""} ${hoverable ? "card-clickable" : ""} ${className}`}
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
      {children}
    </div>
  );
}