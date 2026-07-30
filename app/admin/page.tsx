'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // รายการห้องทั้งหมดที่คุณตั้งไว้
  const rooms = ['101', '102', '103', '104', '105', '106', '107', '108'];

  // ฟังก์ชันสำหรับกดเปิด/ปิดไฟแมนนวลจากหน้าแอดมิน
  const handleControl = async (roomNumber: string, action: 'turn-on' | 'turn-off') => {
    setIsLoading(true);
    setStatusMsg(`⏳ กำลังส่งคำสั่งไปยังห้อง ${roomNumber}...`);

    try {
      const res = await fetch('/api/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber, action }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMsg(`✅ สำเร็จ: ห้อง ${roomNumber} ถูก ${action === 'turn-on' ? 'เปิด' : 'ปิด'} แล้ว`);
      } else {
        setStatusMsg(`❌ ไม่สำเร็จ: ${data.message || 'เกิดข้อผิดพลาด'}`);
      }
    } catch (error) {
      setStatusMsg('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">🎛️ ระบบจัดการหลังบ้าน (Admin Dashboard)</h1>
        <p className="text-gray-500 text-center mb-6">ควบคุมและตรวจสอบสถานะเบรกเกอร์ห้องพัก</p>

        {statusMsg && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium text-center">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {rooms.map((room) => (
            <div key={room} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 shadow-sm">
              <span className="text-lg font-bold text-gray-700">ห้อง {room}</span>
              <div className="space-x-2">
                <button
                  onClick={() => handleControl(room, 'turn-on')}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition"
                >
                  เปิดไฟ 🟢
                </button>
                <button
                  onClick={() => handleControl(room, 'turn-off')}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition"
                >
                  ปิดไฟ 🔴
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
