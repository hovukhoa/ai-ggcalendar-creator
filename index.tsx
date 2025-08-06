import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Component App Chính ---
const App = () => {
  // --- State Management ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    description: ''
  });
  const [showResults, setShowResults] = useState(false);

  // --- Gemini API Initialization ---
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);

  // --- Xử lý Xác thực ---
  const handleAuthenticate = () => {
    if (password === '2107') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Mật khẩu không chính xác. Vui lòng thử lại.');
      setPassword('');
    }
  };

  // --- Xử lý Phân tích Văn bản ---
  const handleAnalyzeText = async () => {
    if (!inputText.trim()) {
      setAnalysisError('Vui lòng nhập văn bản để phân tích.');
      return;
    }
    setIsLoading(true);
    setAnalysisError('');
    setShowResults(false);

    const today = new Date();
    const todayString = today.toLocaleDateString('vi-VN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const systemInstruction = `Bạn là một trợ lý thông minh chuyên phân tích văn bản tiếng Việt để trích xuất thông tin sự kiện. Nhiệm vụ của bạn là điền vào một biểu mẫu JSON dựa trên văn bản được cung cấp. Hôm nay là: ${todayString}. Luôn tuân thủ các quy tắc sau: 1. 'date' phải ở định dạng YYYY-MM-DD. 2. 'startTime' và 'endTime' phải ở định dạng HH:mm (24-giờ). 3. Nếu không có thời gian kết thúc, mặc định sự kiện kéo dài 1 giờ. 4. 'title' phải là một bản tóm tắt ngắn gọn của sự kiện. 5. 'description' phải bao gồm tất cả các chi tiết còn lại như địa điểm, nội dung. Nếu không có, hãy để trống.`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'Tiêu đề ngắn gọn của sự kiện.' },
            date: { type: Type.STRING, description: 'Ngày diễn ra sự kiện theo định dạng YYYY-MM-DD.' },
            startTime: { type: Type.STRING, description: 'Thời gian bắt đầu sự kiện theo định dạng HH:mm.' },
            endTime: { type: Type.STRING, description: 'Thời gian kết thúc sự kiện theo định dạng HH:mm.' },
            description: { type: Type.STRING, description: 'Mô tả chi tiết sự kiện, bao gồm địa điểm, nội dung, v.v.' },
        },
        required: ['title', 'date', 'startTime', 'endTime', 'description'],
    };

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: inputText,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      
      const resultJson = JSON.parse(response.text);
      setAnalysisResult(resultJson);
      setShowResults(true);

    } catch (error) {
      console.error("Lỗi phân tích:", error);
      setAnalysisError('Không thể phân tích văn bản. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- Cập nhật kết quả khi người dùng chỉnh sửa ---
  const handleResultChange = (e) => {
      const { name, value } = e.target;
      setAnalysisResult(prev => ({...prev, [name]: value}));
  }

  // --- Tự động tạo liên kết Google Calendar khi kết quả thay đổi ---
  const calendarLink = useMemo(() => {
      const { title, date, startTime, endTime, description } = analysisResult;
      if (!title || !date || !startTime || !endTime) {
          return '';
      }

      // Format YYYY-MM-DDTHH:mm:ss to YYYYMMDDTHHMMSS
      const formatDateTime = (d, t) => {
          if(!d || !t) return '';
          return `${d.replace(/-/g, '')}T${t.replace(/:/g, '')}00`;
      }

      const startDate = formatDateTime(date, startTime);
      const endDate = formatDateTime(date, endTime);
      
      const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
      const params = new URLSearchParams({
          text: title,
          dates: `${startDate}/${endDate}`,
          details: description,
          ctz: 'Asia/Ho_Chi_Minh' // Múi giờ Việt Nam
      });

      return `${baseUrl}&${params.toString()}`;
  }, [analysisResult]);


  // --- Render Giao diện ---
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <h1>Xác Thực</h1>
        <div className="auth-container">
          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuthenticate()}
              autoFocus
            />
          </div>
          {authError && <p className="error-message">{authError}</p>}
          <button className="button" onClick={handleAuthenticate}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1>Trình Phân Tích & Tạo Sự Kiện Lịch</h1>
      <div className="main-app">
        <div className="form-group">
          <label htmlFor="event-text">Nội dung sự kiện</label>
          <textarea
            id="event-text"
            placeholder="Dán văn bản sự kiện của bạn ở đây... (ví dụ: Chiều mai họp lúc 15g30 tại hội trường về dự án mới)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </div>
        {analysisError && <p className="error-message">{analysisError}</p>}
        <button className="button" onClick={handleAnalyzeText} disabled={isLoading}>
          {isLoading ? <span className="loader"></span> : 'Phân Tích'}
        </button>

        {showResults && (
          <div className="results-container">
            <h2>Kết quả phân tích (có thể chỉnh sửa)</h2>
            <div className="results-form-grid">
              <div className="form-group grid-col-span-2">
                <label htmlFor="title">Tiêu đề</label>
                <input type="text" id="title" name="title" value={analysisResult.title} onChange={handleResultChange} />
              </div>
              <div className="form-group">
                <label htmlFor="date">Ngày</label>
                <input type="date" id="date" name="date" value={analysisResult.date} onChange={handleResultChange} />
              </div>
              <div className="form-group">
                <label htmlFor="startTime">Bắt đầu</label>
                <input type="time" id="startTime" name="startTime" value={analysisResult.startTime} onChange={handleResultChange} />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">Kết thúc</label>
                <input type="time" id="endTime" name="endTime" value={analysisResult.endTime} onChange={handleResultChange} />
              </div>
              <div className="form-group grid-col-span-2">
                <label htmlFor="description">Mô tả / Ghi chú</label>
                <textarea id="description" name="description" value={analysisResult.description} onChange={handleResultChange} />
              </div>
            </div>
            
            {calendarLink ? (
                <a href={calendarLink} className="button calendar-button" target="_blank" rel="noopener noreferrer">
                    Mở trong Google Calendar
                </a>
            ) : (
                <button className="button calendar-button" disabled>
                    Mở trong Google Calendar
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Mount App to DOM ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);