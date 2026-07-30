'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [roomNumber, setRoomNumber] = useState('101');
  const [isLocked, setIsLocked] = useState(false); // ตัวแปรสำหรับล็อกไม่ให้ลูกค้าเปลี่ยนห้องเอง
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 📌 1. คุณสามารถตั้งราคาของแต่ละห้องได้ตรงนี้เลยครับ (ตัวเลขคือราคา)
  const roomPrices: Record<string, number> = {
    '101': 350,
    '102': 350,
    '103': 350,
    '104': 350,
    '105': 400,
    '106': 400,
    '107': 500,
    '108': 500,
  };

  const rooms = Object.keys(roomPrices);

  // 📌 2. ฟังก์ชันจับลิงก์ QR Code เพื่อล็อกห้องอัตโนมัติ
  useEffect(() => {
    // ระบบจะอ่านค่าลิงก์ เช่น ถ้าลูกค้าสแกนมาเป็น ?room=101
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    
    // ถ้ามีเลขห้องส่งมา และเป็นเลขห้องที่มีในระบบ
    if (roomParam && rooms.includes(roomParam)) {
      setRoomNumber(roomParam); // ตั้งค่าห้องตาม QR Code
      setIsLocked(true); // ล็อกหน้าจอ ป้องกันลูกค้ากดเปลี่ยนห้องผิด
    }
  }, []);

  const handleUpload = async () => {
    if (!file) {
      alert('กรุณาเลือกไฟล์รูปสลิปก่อนครับ');
      return;
    }
    
    setIsLoading(true);
    setStatusMsg('⏳ กำลังส่งสลิปตรวจสอบและสั่งเปิดไฟ... กรุณารอสักครู่');

    const formData = new FormData();
    formData.append('slipImage', file);
    formData.append('roomNumber', roomNumber); // ส่งเลขห้องที่ถูกล็อกไว้ไปให้ API

    try {
      const res = await fetch('/api/verify-slip', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatusMsg(`✅ ตรวจสอบสำเร็จ! ระบบกำลังเปิดไฟให้ห้อง ${roomNumber} ครับ`);
      } else {
        setStatusMsg(`❌ ตรวจสอบไม่ผ่าน: ${data.message || 'สลิปไม่ถูกต้อง หรือถูกใช้งานไปแล้ว'}`);
      }
    } catch (error) {
      setStatusMsg('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  // ฟังก์ชันช่วยจัดการสีของข้อความสถานะ
  const setStatusMsg = (msg: string) => setStatus(msg);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-8 border-yellow-500">
        <h1 className="text-3xl font-extrabold text-blue-900 mb-2">สิงห์บุรีแกรนด์บางระจัน</h1>
        <p className="text-gray-500 mb-6 font-medium">ระบบเปิดใช้งานห้องพักอัตโนมัติ</p>
        
        {/* ส่วนที่ 1: แสดงหมายเลขห้องและราคา */}
        <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <label className="block text-blue-900 font-bold mb-2 text-lg">ห้องพักของคุณ:</label>
          
          {isLocked ? (
            // ถ้าลูกค้าสแกน QR มาจากหน้าห้อง จะขึ้นโชว์เลขห้องตายตัวเลย เปลี่ยนไม่ได้
            <div className="text-2xl font-black text-blue-700">
              ห้อง {roomNumber} <span className="text-gray-600 text-lg font-bold ml-2">(ราคา {roomPrices[roomNumber]} บาท)</span>
            </div>
          ) : (
            // ถ้าไม่ได้สแกน QR (เข้าเว็บตรงๆ) จะยังเป็นแบบให้เลือก
            <select 
              value={roomNumber} 
              onChange={(e) => setRoomNumber(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-xl font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {rooms.map((room) => (
                <option key={room} value={room}>ห้อง {room} - {roomPrices[room]} บาท</option>
              ))}
            </select>
          )}
        </div>
        
        {/* ส่วนที่ 2: ให้อัปโหลดรูป */}
        <div className="mb-8 text-left">
          <label className="block text-gray-700 font-bold mb-3 text-lg">อัปโหลดสลิปโอนเงิน (QR ที่ 2):</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-800 hover:file:bg-blue-200 cursor-pointer transition"
          />
        </div>
        
        <button 
          onClick={handleUpload} 
          disabled={isLoading}
          className={`w-full font-bold py-4 px-4 rounded-xl text-xl transition duration-200 shadow-md ${
            isLoading ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg'
          }`}
        >
          {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันการโอนเงิน'}
        </button>
        
        {status && (
          <div className={`mt-6 p-4 rounded-xl border text-lg font-bold shadow-sm ${
            status.includes('✅') ? 'bg-green-50 border-green-300 text-green-700' : 
            status.includes('⏳') ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 
            'bg-red-50 border-red-300 text-red-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
