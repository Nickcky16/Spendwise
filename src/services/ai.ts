import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const parseExpenseAI = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this expense description: "${text}"`,
      config: {
        systemInstruction: "You are a financial assistant. Extract expense details from text. If the current Year is not specified, assume 2024. Return standard categories: Food, Transport, Utilities, Entertainment, Health, Shopping, Other.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "The amount spent (positive number)" },
            category: { type: Type.STRING, description: "One of the standard categories" },
            description: { type: Type.STRING, description: "A clean description of what was bought" },
            date: { type: Type.STRING, description: "ISO date string" }
          },
          required: ["amount", "category", "description", "date"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
};
