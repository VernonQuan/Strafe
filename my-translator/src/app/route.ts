import { NextRequest, NextResponse } from "next/server";
import { TranslationServiceClient } from "@google-cloud/translate"; 
import OpenAI from "openai";

// Initialize clients with API keys
const googleTranslateClient = new TranslationServiceClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage, additionalContext } = await request.json();

    // Input validation
    if (text == null || targetLanguage == null) {
      return NextResponse.json(
        { error: "Text and target language are required." },
        { status: 400 }
      );
    }

    // --- Step 1: Literal Translation with Google ---
    console.log("Starting literal translation with Google Translate...");
    const [googleTranslation] = await googleTranslateClient.translateText({
      parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`,
      contents: [text],
      mimeType: "text/plain",
      targetLanguageCode: targetLanguage,
    });

    const literalTranslation = googleTranslation.translations?.[0]?.translatedText || text;
    console.log('Literal translation:', literalTranslation);

    // --- Step 2: Nuance & Context Enhancement with OpenAI ---
    console.log('Enhancing translation with AI...');
    const prompt = `You are an expert translator and cultural consultant. Your task is to refine a machine translation to make it sound natural and native to a ${targetLanguage} speaker.
    
    Follow these rules:
    1. Preserve the original meaning perfectly.
    2. Adapt idioms, slang, and cultural references to their equivalent in the target language.
    3. There may be some additional context provided that can help you understand the nuances of the text. If there is no additional context, use your best judgment.
    4. Ensure the tone (formal, casual, humorous, etc.) matches the original text.
    5. Correct any awkward phrasing from the literal translation.
    6. Output ONLY the refined translation, nothing else.

    Original text: "${text}"
    Literal translation: "${literalTranslation}"
    Additional context: "${additionalContext || 'No additional context provided.'}"
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{role: "user", content: prompt}],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const refinedTranslation = completion.choices[0]?.message?.content?.trim() || literalTranslation;
    console.log('Refined translation:', refinedTranslation);

    // --- Step 3: Return the enhanced result ---
    return NextResponse.json({
      originalText: text,
      translatedText: refinedTranslation,
      targetLanguage,
    });

  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Internal server error during translation." },
      { status: 500 }
    );
  }
}