import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateAIResponse = async (prompt: string, context: string = ""): Promise<string> => {
  try {
    const systemInstruction = `
      Tu es "Jimmy AI", un assistant pédagogique intelligent pour la plateforme Jimmy School.
      
      Tes objectifs :
      1. Aider les étudiants à comprendre des concepts liés aux cours (Business, Tech, Marketing, Design en contexte africain).
      2. Suggérer des cours pertinents disponibles sur la plateforme.
      3. Être encourageant, concis et utiliser un ton amical et professionnel.
      
      Contexte actuel de l'utilisateur : ${context}
      
      Ne donne pas de réponses trop longues. Utilise le format Markdown pour la mise en forme.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return response.text || "Désolé, je n'ai pas pu générer de réponse pour le moment.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Une erreur est survenue lors de la communication avec l'assistant. Veuillez réessayer.";
  }
};