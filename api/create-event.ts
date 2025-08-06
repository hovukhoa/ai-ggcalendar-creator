// This file should be placed in the /api directory of your project.
// For example: /api/create-event.ts

import { google } from 'googleapis';

export default async function handler(req: Request): Promise<Response> {
  // 1. Check for POST method
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 2. Get credentials from Vercel Environment Variables
  const serviceAccountCreds = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!serviceAccountCreds || !calendarId) {
    console.error('Missing Google credentials or Calendar ID in environment variables.');
    return new Response(JSON.stringify({ message: 'Lỗi cấu hình server: Thiếu thông tin xác thực Google hoặc ID Lịch.' }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }

  try {
    // 3. Authenticate with Google
    const creds = JSON.parse(serviceAccountCreds);
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    // 4. Get event details from the request body
    const body = await req.json();
    const { title, start, end, description, location } = body;

    if (!title || !start || !end) {
        return new Response(JSON.stringify({ message: 'Thiếu thông tin sự kiện bắt buộc: tiêu đề, thời gian bắt đầu, thời gian kết thúc.' }), { status: 400, headers: {'Content-Type': 'application/json'} });
    }
    
    // 5. Create the event resource for the API
    const event = {
      summary: title,
      location: location,
      description: description,
      start: {
        dateTime: new Date(start).toISOString(),
        timeZone: 'Asia/Ho_Chi_Minh', // Or get from user if needed
      },
      end: {
        dateTime: new Date(end).toISOString(),
        timeZone: 'Asia/Ho_Chi_Minh',
      },
    };

    // 6. Insert the event into the calendar
    const insertedEvent = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event,
    });

    // 7. Return success response
    return new Response(JSON.stringify({ message: 'Event created successfully!', event: insertedEvent.data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ message: 'Không thể tạo sự kiện trên Calendar.', error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}