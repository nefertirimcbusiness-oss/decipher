# Savid AI Engine

This is the core conversational AI module for Savid, the owl mentor.

## Features
- Generates warm, non-judgmental responses to user entries.
- Automatically asks 1-3 sensory-focused follow-up questions.
- Tracks emotional patterns and mood scores.
- Includes safety guardrails for crisis detection.
- Supports long-term pattern analysis across multiple entries.

## Installation

The module is located in `/home/team/shared/savid-engine/`. To use it in your project:

1. Import the `SavidEngine` class from the `dist` folder.
2. Ensure you have an `OPENAI_API_KEY` in your environment variables.

## Usage

```typescript
import { SavidEngine } from '../shared/savid-engine/dist/index.js';

const savid = new SavidEngine();

// Generate a response to a new entry
const response = await savid.generateResponse("I remember a blue bike I had as a kid.");

console.log(response.savid_response);
console.log(response.follow_up_questions);
console.log(response.emotional_analysis.detected_emotions);

// Analyze patterns over time
const analysis = await savid.analyzeLongTermPatterns([
  "Entry 1...",
  "Entry 2..."
]);
```

## Prompt Configuration
System prompts and personality guidelines are located in the `prompts/` and `personality.md` files. These can be iterated on without changing the code logic.

## Safety
If Savid detects a crisis, it will return a standard crisis referral message. The backend should check for this or rely on Savid's output directly.
