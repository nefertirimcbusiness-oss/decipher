"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavidEngine = void 0;
const openai_1 = __importDefault(require("openai"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
require("dotenv/config");
class SavidEngine {
    openai;
    systemPrompt;
    constructor(apiKey) {
        const key = apiKey || process.env.OPENAI_API_KEY;
        if (!key) {
            console.warn('Warning: No OpenAI API key provided. SavidEngine will run in mock mode.');
        }
        this.openai = new openai_1.default({ apiKey: key || 'mock-key' });
        // Load system prompt
        const promptPath = path.join(__dirname, '../prompts/system_prompt.txt');
        this.systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    }
    /**
     * Generates a response from Savid based on a user's entry and conversation history.
     */
    async generateResponse(userEntry, history = []) {
        if (this.openai.apiKey === 'mock-key') {
            return this.getMockResponse(userEntry);
        }
        const messages = [
            { role: 'system', content: this.systemPrompt },
            ...history,
            { role: 'user', content: userEntry },
        ];
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o', // or gpt-3.5-turbo
                messages: messages,
                response_format: { type: 'json_object' },
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error('Empty response from OpenAI');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Error generating Savid response:', error);
            return this.getFallbackResponse();
        }
    }
    /**
     * Specifically designed to scan multiple entries and find long-term patterns.
     */
    async analyzeLongTermPatterns(entries) {
        if (this.openai.apiKey === 'mock-key') {
            return "In mock mode, I can't see the deep patterns, but I'm sure you're making progress!";
        }
        const prompt = `Below are several journal entries from a user. Please identify recurring emotional patterns, themes, or "memory anchors" (small details that keep appearing). Be gentle and insightful, like a wise mentor.\n\nEntries:\n${entries.join('\n---\n')}`;
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are Savid, the wise owl mentor. Analyze these entries for patterns.' },
                    { role: 'user', content: prompt }
                ],
            });
            return response.choices[0].message.content || "I couldn't quite find a pattern today, but let's keep logging.";
        }
        catch (error) {
            return "I'm having a little trouble looking back right now. Let's focus on today.";
        }
    }
    getMockResponse(userEntry) {
        return {
            savid_response: `(MOCK) I hear you saying: "${userEntry.substring(0, 50)}...". That sounds like a significant piece of your story. I'm here to help you hold that memory.`,
            follow_up_questions: [
                "What was the temperature like in that moment?",
                "Do you remember any specific sounds nearby?",
                "How does your body feel as you recount this?"
            ],
            emotional_analysis: {
                detected_emotions: ["reflective", "uncertain"],
                mood_score: 6,
                pattern_observation: "The user is starting to explore sensory details."
            }
        };
    }
    getFallbackResponse() {
        return {
            savid_response: "I'm here, and I'm listening. Sometimes the words are hard to find, and that's okay. Take a deep breath.",
            follow_up_questions: ["Would you like to try describing just one small thing you can see right now?"],
            emotional_analysis: {
                detected_emotions: ["unknown"],
                mood_score: 5,
                pattern_observation: "Engine encountered an error; providing a grounding response."
            }
        };
    }
}
exports.SavidEngine = SavidEngine;
//# sourceMappingURL=index.js.map