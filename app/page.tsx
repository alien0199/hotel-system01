'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SlipUploadClient() {
  const searchParams = useSearchParams();
  const roomNumber = searchParams.get('room');

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success' | '', text: string }>({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  // ฟังก์ชันจัดการเมื่อลูกค้าเลือกรูปภาพ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile); // เก็บไฟล์ลง State
      setPreviewUrl(URL.createObjectURL(selectedFile)); // สร้าง URL สำหรับพรีวิว
      setStatusMsg({ type: '', text: '' }); // ล้างข้อความแจ้งเตือนสีแดงทิ้ง
    }
  };

  // ฟังก์ชันส่งสลิปไปตรวจสอบ
  const handleUpload = async () => {
    // 1. ดักจับ Error ถ้ายังไม่เลือกไฟล์
    if (!file) {
      setStatusMsg({ type: 'error', text: '❌ กรุณาอัปโหลดรูปสลิป' });
      return;
    }
    
    // 2. ดักจับ Error ถ้าไม่มีเบอร์ห้องใน URL
    if (!roomNumber) {
      setStatusMsg({ type: 'error', text: '❌ ไม่พบข้อมูลห้อง กรุณาสแกน QR ใหม่อีกครั้ง' });
      return;
    }

    setIsLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      // 3. แพ็คข้อมูลรูปภาพและเบอร์ห้อง
      const formData = new FormData();
      formData.append('file', file);       // ส่งชื่อฟิลด์ 'file'
      formData.append('files', file);      // สำรองชื่อ 'files' เผื่อ API ต้องการ
      formData.append('roomNumber', roomNumber);

      // 4. ยิง API ไปตรวจสลิป
      const response = await fetch('/api/verify-slip', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      // 5. แจ้งผลการตรวจสอบ
      if (response.ok && data.success) {
        setStatusMsg({ type: 'success', text: `✅ ตรวจสอบสำเร็จ! ระบบเปิดไฟห้อง ${roomNumber} แล้ว` });
      } else {
        setStatusMsg({ type: 'error', text: `❌ ${data.message || 'สลิปไม่ถูกต้อง หรือตรวจสอบไม่ผ่าน'}` });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      setStatusMsg({ type: 'error', text: '❌ ระบบขัดข้อง ไม่สามารถส่งสลิปได้' });
    } finally {
      setIsLoading(false);
    }
  };

  // ถ้าลูกค้าเข้าเว็บมาโดยไม่มีเบอร์ห้อง (ไม่ได้สแกน QR)
  if (!roomNumber) {
    return (
      <div className="text-center mt-20 p-6 bg-white rounded-2xl shadow-lg border-t-4 border-red-500">
        <h2 className="text-xl font-bold text-red-600 mb-2">ข้อมูลไม่ถูกต้อง</h2>
        <p className="text-gray-600">กรุณาสแกน QR Code จากหน้าเคาน์เตอร์ใหม่อีกครั้ง</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-blue-900 mb-2">🏨 สิงห์บุรีแกรนด์บางระจัน</h1>
        <p className="text-gray-600 font-medium text-lg">
          ส่งสลิปเพื่อเปิดใช้งานห้อง <span className="text-blue-600 font-black">{roomNumber}</span>
        </p>
      </div>

      <label className="block w-full cursor-pointer mb-6 relative">
        <div className={`border-2 border-dashed rounded-2xl p-2 transition-colors ${
          previewUrl ? 'border-blue-400 bg-blue-50' : 'border-blue-300 hover:border-blue-500 bg-gray-50'
        }`}>
          {previewUrl ? (
            // แสดงรูปพรีวิว
            <img src={previewUrl} alt="Slip Preview" className="max-h-[400px] w-full mx-auto rounded-xl shadow-sm object-contain" />
          ) : (
            // แสดงไอคอนให้กดอัปโหลด
            <div className="flex flex-col items-center justify-center py-16">
              <span className="text-5xl mb-4">📸</span>
              <span className="text-blue-800 font-bold text-lg">กดเพื่ออัปโหลดรูปสลิป</span>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </label>

      {/* กล่องแสดงข้อความ Error / Success */}
      {statusMsg.text && (
        <div className={`p-4 rounded-xl mb-4 text-center font-bold text-sm shadow-sm ${
          statusMsg.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
        }`}>
          {statusMsg.text}
        </div>
      )}

      {/* ปุ่มยืนยัน */}
      <button
        onClick={handleUpload}
        disabled={isLoading || !file}
        className={`w-full py-4 rounded-2xl font-bold text-xl shadow-lg transition transform active:scale-95 text-white flex justify-center items-center ${
          isLoading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            กำลังตรวจสอบ...
          </>
        ) : (
          '📤 ยืนยันการส่งสลิป'
        )}
      </button>
    </div>
  );
}

export default function CustomerPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-8 px-4 font-sans">
      <Suspense fallback={<div className="font-bold text-blue-600 text-xl animate-pulse mt-20">กำลังโหลดข้อมูล...</div>}>
        <SlipUploadClient />
      </Suspense>
    </div>
  );
}
