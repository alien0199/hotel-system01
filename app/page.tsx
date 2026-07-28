'use client';

import { useState } from 'react';

export default function Home() {
  // ตั้งค่าห้องเริ่มต้น (เปลี่ยนจาก 101 เป็นเลขอื่นได้)
  const [roomNumber, setRoomNumber] = useState('101'); 
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // สร้างรายการห้องพัก (คุณสามารถลบ หรือ เพิ่มเลขห้องในวงเล็บนี้ได้เองตลอดเวลาครับ)
  const rooms = ['101', '102', '103', '104', '105', '106', '107', '108'];

  const handleUpload = async () => {
    if (!file) {
      alert('กรุณาเลือกไฟล์รูปสลิปก่อนครับ');
      return;
    }
    
    setIsLoading(true);
    setStatus('⏳ กำลังส่งสลิปตรวจสอบ... กรุณารอสักครู่');

    const formData = new FormData();
    formData.append('slipImage', file);
    formData.append('roomNumber', roomNumber);

    try {
      const res = await fetch('/api/verify-slip', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus(`✅ ตรวจสอบสำเร็จ! ระบบกำลังเปิดไฟให้ห้อง ${roomNumber} ครับ`);
      } else {
        setStatus(`❌ ตรวจสอบไม่ผ่าน: ${data.message || 'สลิปไม่ถูกต้อง หรือถูกใช้งานไปแล้ว'}`);
      }
    } catch (error) {
      setStatus('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">เปิดการใช้งานห้องพัก</h1>
        
        {/* ส่วนที่ 1: ให้ลูกค้าเลือกห้อง */}
        <div className="mb-5 text-left">
          <label className="block text-gray-700 font-bold mb-2 text-lg">1. เลือกหมายเลขห้อง:</label>
          <select 
            value={roomNumber} 
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 cursor-pointer"
          >
            {rooms.map((room) => (
              <option key={room} value={room}>ห้อง {room}</option>
            ))}
          </select>
        </div>
        
        {/* ส่วนที่ 2: ให้อัปโหลดรูป */}
        <div className="mb-6 text-left">
          <label className="block text-gray-700 font-bold mb-2 text-lg">2. อัปโหลดสลิปโอนเงิน:</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
          />
        </div>
        
        <button 
          onClick={handleUpload} 
          disabled={isLoading}
          className={`w-full font-bold py-4 px-4 rounded-lg text-lg transition duration-200 shadow-md ${
            isLoading ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันการโอนเงิน'}
        </button>
        
        {status && (
          <div className={`mt-5 p-4 rounded-lg border text-base font-bold ${
            status.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : 
            status.includes('⏳') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 
            'bg-red-50 border-red-200 text-red-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
