"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = "", id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="input-group">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input-field ${error ? "input-error" : ""} ${className}`}
        {...props}
      />
      {error && <p className="error-message">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-muted mt-0.5">{helperText}</p>
      )}
    </div>
  );
}