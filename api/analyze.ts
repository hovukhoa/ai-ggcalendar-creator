// This file should be placed in the /api directory of your project.
// For example: /api/analyze.ts

import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error('Missing API_KEY in environment variables.');
    return new Response(JSON.stringify({ message: 'Server configuration error: Missing API Key.' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const { inputText } = await req.json();

    if (!inputText) {
      return new Response(JSON.stringify({ message: 'Input text is required.' }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
    }

    const ai = new GoogleGenAI({ apiKey });

    const today = new Date().toLocaleDateString('vi-VN');
    const systemInstruction = `Bạn là một trợ lý thông minh chuyên trích xuất thông tin sự kiện từ văn bản tiếng Việt. Hôm nay là ${today}. Dựa vào văn bản được cung cấp, hãy trích xuất các thông tin. Mặc định một sự kiện kéo dài 1 giờ nếu không có thời gian kết thúc. Luôn trả về kết quả dưới dạng JSON theo schema đã cho.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        tieu_de: { type: Type.STRING, description: "Tiêu đề ngắn gọn, súc tích cho sự kiện." },
        ngay_bat_dau: { type: Type.STRING, description: "Ngày bắt đầu sự kiện (YYYY-MM-DD). Hiểu các từ như 'ngày mai'." },
        gio_bat_dau: { type: Type.STRING, description: "Giờ bắt đầu sự kiện (HH:mm)." },
        dia_diem: { type: Type.STRING, description: "Địa điểm diễn ra sự kiện." },
        ghi_chu: { type: Type.STRING, description: "Các chi tiết hoặc ghi chú liên quan khác." },
      },
      required: ["tieu_de", "ngay_bat_dau", "gio_bat_dau"],
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: inputText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const resultText = response.text.trim();
    
    return new Response(resultText, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error during analysis API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ message: 'Failed to analyze text.', error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}