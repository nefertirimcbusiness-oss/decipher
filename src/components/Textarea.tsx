"use client";

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="input-group">
      {label && (
        <label htmlFor={textareaId} className="input-label">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`textarea-field ${error ? "input-error" : ""} ${className}`}
        {...props}
      />
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}