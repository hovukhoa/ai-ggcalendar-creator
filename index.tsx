import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// Interface for structured event data
interface EventDetails {
  title: string;
  start: string; // ISO format for datetime-local input
  end: string;   // ISO format for datetime-local input
  description: string;
  location: string;
}

// Type for create event status
type CreateStatus = 'idle' | 'loading' | 'success' | 'error';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string>('');
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [createStatus, setCreateStatus] = useState<CreateStatus>('idle');

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY as string }), []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '2107') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Mật khẩu không chính xác.');
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setAnalysisError('Vui lòng nhập văn bản để phân tích.');
      return;
    }
    setIsLoading(true);
    setAnalysisError('');
    setEventDetails(null);
    setCreateStatus('idle'); // Reset create button state

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

    try {
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
      const parsed = JSON.parse(resultText);

      const startDate = new Date(`${parsed.ngay_bat_dau}T${parsed.gio_bat_dau}`);
      if (isNaN(startDate.getTime())) {
          throw new Error("Ngày hoặc giờ không hợp lệ được trả về từ AI.");
      }
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour

      const formatForInput = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const tzOffset = -date.getTimezoneOffset();
        const diff = tzOffset >= 0 ? '+' : '-';
        const newDate = new Date(date.getTime() + tzOffset * 60 * 1000);
        return newDate.toISOString().slice(0, 16);
      };

      setEventDetails({
        title: parsed.tieu_de || '',
        start: formatForInput(startDate),
        end: formatForInput(endDate),
        location: parsed.dia_diem || '',
        description: parsed.ghi_chu || '',
      });

    } catch (error) {
      console.error("Error during analysis:", error);
      setAnalysisError('Không thể phân tích văn bản. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventDetails) return;
    setCreateStatus('loading');

    try {
      const response = await fetch('/api/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventDetails),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      
      setCreateStatus('success');

    } catch (error) {
      console.error("Error creating event:", error);
      setCreateStatus('error');
    } finally {
        // Reset button after 3 seconds
        setTimeout(() => setCreateStatus('idle'), 3000);
    }
  };

  const getCreateButtonContent = () => {
    switch(createStatus) {
        case 'loading': return <div className="loading-spinner"></div>;
        case 'success': return 'Đã tạo thành công!';
        case 'error': return 'Tạo lỗi, thử lại?';
        case 'idle':
        default: return 'Gửi lên Calendar';
    }
  };


  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <h1 className="title">Xác thực</h1>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              type="password"
              id="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="authError"
            />
          </div>
          <button type="submit" className="btn">Đăng nhập</button>
          <p id="authError" className="error-message" aria-live="polite">{authError}</p>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1 className="title">Trợ lý Tạo Sự kiện</h1>
      <div className="form-group">
        <label htmlFor="event-text">Nhập văn bản sự kiện</label>
        <textarea
          id="event-text"
          className="textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ví dụ: Chiều mai họp lúc 15g30 tại hội trường về dự án mới..."
          rows={5}
        />
      </div>
      <button onClick={handleAnalyze} className="btn" disabled={isLoading}>
        {isLoading ? <div className="loading-spinner"></div> : 'Phân tích'}
      </button>
      <p className="error-message" aria-live="polite">{analysisError}</p>

      {eventDetails && (
        <div className="results-container">
          <div className="form-group">
            <label htmlFor="title">Tiêu đề sự kiện</label>
            <input id="title" type="text" className="input" value={eventDetails.title} onChange={e => setEventDetails({...eventDetails, title: e.target.value})} />
          </div>
          <div className="results-grid">
            <div className="form-group">
                <label htmlFor="start">Thời gian bắt đầu</label>
                <input id="start" type="datetime-local" className="input" value={eventDetails.start} onChange={e => setEventDetails({...eventDetails, start: e.target.value})} />
            </div>
            <div className="form-group">
                <label htmlFor="end">Thời gian kết thúc</label>
                <input id="end" type="datetime-local" className="input" value={eventDetails.end} onChange={e => setEventDetails({...eventDetails, end: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="location">Địa điểm</label>
            <input id="location" type="text" className="input" value={eventDetails.location} onChange={e => setEventDetails({...eventDetails, location: e.target.value})} />
          </div>
          <div className="form-group">
            <label htmlFor="description">Ghi chú</label>
            <textarea id="description" className="textarea" value={eventDetails.description} onChange={e => setEventDetails({...eventDetails, description: e.target.value})} rows={3}></textarea>
          </div>
          <button onClick={handleCreateEvent} className={`btn btn-secondary ${createStatus === 'success' ? 'btn-success' : createStatus === 'error' ? 'btn-error' : ''}`} disabled={createStatus === 'loading'}>
            {getCreateButtonContent()}
          </button>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);