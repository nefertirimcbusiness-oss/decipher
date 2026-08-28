import 'dotenv/config';
export interface SavidResponse {
    savid_response: string;
    follow_up_questions: string[];
    emotional_analysis: {
        detected_emotions: string[];
        mood_score: number;
        pattern_observation: string;
    };
}
export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export declare class SavidEngine {
    private openai;
    private systemPrompt;
    constructor(apiKey?: string);
    /**
     * Generates a response from Savid based on a user's entry and conversation history.
     */
    generateResponse(userEntry: string, history?: ConversationMessage[]): Promise<SavidResponse>;
    /**
     * Specifically designed to scan multiple entries and find long-term patterns.
     */
    analyzeLongTermPatterns(entries: string[]): Promise<string>;
    private getMockResponse;
    private getFallbackResponse;
}
//# sourceMappingURL=index.d.ts.map