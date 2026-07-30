'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [roomNumber, setRoomNumber] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // อ่านชื่อห้องที่ซ่อนอยู่ในคิวอาร์โค้ด
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    
    if (roomParam) {
      setRoomNumber(roomParam);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) {
      alert('กรุณาเลือกไฟล์รูปสลิปก่อนครับ');
      return;
    }
    setIsLoading(true);
    setStatus('⏳ กำลังส่งสลิปตรวจสอบและสั่งเปิดไฟ... กรุณารอสักครู่');

    const formData = new FormData();
    formData.append('slipImage', file);
    formData.append('roomNumber', roomNumber!); 

    try {
      const res = await fetch('/api/verify-slip', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus(`✅ ตรวจสอบสำเร็จ! ระบบกำลังเปิดไฟให้ห้อง ${roomNumber} ครับ\nขอให้พักผ่อนอย่างมีความสุขครับ`);
      } else {
        setStatus(`❌ ตรวจสอบไม่ผ่าน: ${data.message}`);
      }
    } catch (error) {
      setStatus('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 ถ้ายูสเซอร์ไม่ได้สแกน QR Code (เข้าเว็บตรงๆ) ให้แสดงหน้าต่างปฏิเสธ
  if (!roomNumber) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center border-t-8 border-red-500">
          <h1 className="text-6xl mb-4">⛔</h1>
          <h2 className="text-2xl font-bold text-red-600 mb-2">ไม่อนุญาตให้เข้าถึง</h2>
          <p className="text-gray-600 font-medium">กรุณาสแกน QR Code สำหรับส่งสลิป<br/>ที่ติดอยู่ด้านหน้าห้องพักของคุณเท่านั้นครับ</p>
        </div>
      </div>
    );
  }

  // 🟢 ถ้าสแกน QR Code มาถูกต้อง ให้แสดงหน้าส่งสลิปที่ล็อกห้องไว้แล้ว
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-8 border-yellow-500">
        <h1 className="text-3xl font-extrabold text-blue-900 mb-2">สิงห์บุรีแกรนด์บางระจัน</h1>
        <p className="text-gray-500 mb-6 font-medium">ระบบเปิดใช้งานห้องพักอัตโนมัติ</p>
        
        {/* ล็อกชื่อห้องชัดเจน เปลี่ยนไม่ได้ */}
        <div className="mb-6 bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-inner">
          <p className="text-blue-900 font-bold mb-1 text-lg">ห้องพักของคุณคือ</p>
          <div className="text-4xl font-black text-blue-700">ห้อง {roomNumber}</div>
        </div>
        
        <div className="mb-8 text-left">
          <label className="block text-gray-700 font-bold mb-3 text-lg">อัปโหลดสลิปโอนเงิน:</label>
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
          <div className={`mt-6 p-4 rounded-xl border text-lg font-bold shadow-sm whitespace-pre-line ${
            status.includes('✅') ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
