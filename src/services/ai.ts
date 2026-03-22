import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface CaptionResponse {
  captions: string[];
}

export interface CaptionResponse {
  captions: string[];
}

export interface ShortCaptionResponse {
  options: string[];
}

export async function generateChineseCaptions(base64Images: string[]): Promise<CaptionResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    Analyze these images and generate 5 creative, concise, and stylish WeChat Moments (朋友圈) captions in Chinese.
    The style should be modern, emotional, and suitable for social media sharing.
    Keep them short and impactful.
    
    Return the response in JSON format with the following structure:
    {
      "captions": ["caption 1", "caption 2", "caption 3", "caption 4", "caption 5"]
    }
  `;

  const parts = base64Images.map(img => ({
    inlineData: {
      data: img.split(',')[1] || img,
      mimeType: "image/jpeg",
    },
  }));

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          ...parts,
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          captions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["captions"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as CaptionResponse;
}

export async function generateImageShortCaptions(base64Image: string): Promise<ShortCaptionResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    Analyze this image and generate 5 very short, poetic, or stylish captions (under 10 words each) that would look good as a handwritten overlay.
    The language should be Chinese.
    
    Return the response in JSON format:
    {
      "options": ["option 1", "option 2", "option 3", "option 4", "option 5"]
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["options"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as ShortCaptionResponse;
}

export interface OrderResponse {
  orderedIds: string[];
  reasoning: string;
}

export async function suggestImageOrder(images: { id: string; url: string }[]): Promise<OrderResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    Analyze these images and suggest the most aesthetically pleasing or logical order for a 9-grid social media post.
    Consider visual flow, color balance, and storytelling.
    
    Return the response in JSON format:
    {
      "orderedIds": ["id1", "id2", ...],
      "reasoning": "brief explanation of the order"
    }
  `;

  const parts = images.map(img => ({
    inlineData: {
      data: img.url.split(',')[1] || img.url,
      mimeType: "image/jpeg",
    },
  }));

  // Add IDs to the prompt parts to help AI map them
  const idParts = images.map((img, i) => ({ text: `Image ${i+1} ID: ${img.id}` }));

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          ...idParts,
          ...parts,
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          orderedIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          reasoning: { type: Type.STRING }
        },
        required: ["orderedIds", "reasoning"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as OrderResponse;
}

export interface LayoutAnalysisResponse {
  filter: string;
  font: string;
  aspectRatio: string;
  description: string;
}

export async function analyzeLayout(base64Image: string): Promise<LayoutAnalysisResponse> {
  const ai = getAI();
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    Analyze this social media layout/post image. 
    Identify the dominant visual style (filter), typography style, and image cropping/aspect ratio.
    
    Map the filter to one of these: "Original", "Grayscale", "Sepia", "Warm", "Cool", "Vibrant", "Vintage".
    Map the font to one of these: "font-handwriting", "font-chinese", "font-brush", "font-cute", "font-serif-sc".
    Map the aspect ratio to one of these: "aspect-square", "aspect-[3/4]", "aspect-[4/3]", "aspect-video".
    
    Return the response in JSON format:
    {
      "filter": "the filter class name (e.g. filter-vintage)",
      "font": "the font class name",
      "aspectRatio": "the aspect ratio class name",
      "description": "a brief description of the style"
    }
    
    Note: 
    - filter-grayscale, filter-sepia, filter-warm, filter-cool, filter-vibrant, filter-vintage, or empty string for Original.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          filter: { type: Type.STRING },
          font: { type: Type.STRING },
          aspectRatio: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["filter", "font", "aspectRatio", "description"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const result = JSON.parse(text);
  
  // Ensure we return valid classes even if AI hallucinates
  const validFilters = ["", "filter-grayscale", "filter-sepia", "filter-warm", "filter-cool", "filter-vibrant", "filter-vintage"];
  const validFonts = ["font-handwriting", "font-chinese", "font-brush", "font-cute", "font-serif-sc"];
  const validAspects = ["aspect-square", "aspect-[3/4]", "aspect-[4/3]", "aspect-video"];
  
  return {
    filter: validFilters.includes(result.filter) ? result.filter : "filter-vintage",
    font: validFonts.includes(result.font) ? result.font : "font-chinese",
    aspectRatio: validAspects.includes(result.aspectRatio) ? result.aspectRatio : "aspect-square",
    description: result.description
  };
}
