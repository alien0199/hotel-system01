'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SlipUploadContent() {
  const searchParams = useSearchParams();
  const roomNumber = searchParams.get('room');

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStatus({ type: 'idle', msg: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus({ type: 'error', msg: 'กรุณาเลือกไฟล์สลิปก่อนครับ' });
      return;
    }
    if (!roomNumber) {
      setStatus({ type: 'error', msg: 'ไม่พบหมายเลขห้อง กรุณาสแกน QR Code ใหม่อีกครั้ง' });
      return;
    }

    setStatus({ type: 'loading', msg: 'กำลังตรวจสอบสลิป กรุณารอสักครู่...' });

    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('roomNumber', roomNumber);

      // ส่งรูปไปให้ API ตรวจสอบ
      const response = await fetch('/api/verify-slip', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus({ type: 'success', msg: `✅ ตรวจสอบสำเร็จ! ระบบกำลังเปิดไฟห้อง ${roomNumber} ให้ท่านครับ` });
      } else {
        setStatus({ type: 'error', msg: `❌ ${data.message || 'ตรวจสอบสลิปไม่ผ่าน'}` });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: '❌ เกิดข้อผิดพลาดในการเชื่อมต่อระบบ' });
    }
  };

  // ดักจับกรณีลูกค้าเข้าเว็บโดยไม่ได้สแกน QR Code
  if (!roomNumber) {
    return (
      <div className="text-center p-8 bg-white rounded-3xl shadow-xl mt-10 border-t-4 border-red-500">
        <h2 className="text-2xl font-black text-red-600 mb-2">❌ ข้อมูลไม่ถูกต้อง</h2>
        <p className="text-gray-600 font-medium">ไม่พบหมายเลขห้อง<br/>กรุณาสแกน QR Code จากหน้าจอเคาน์เตอร์ใหม่อีกครั้งครับ</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-3xl shadow-xl max-w-sm w-full border-t-4 border-blue-600">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-blue-900 mb-1">🏨 สิงห์บุรีแกรนด์บางระจัน</h1>
        <p className="text-gray-500 font-medium">ส่งสลิปเพื่อเปิดใช้งานห้อง <span className="text-blue-600 font-black text-xl">{roomNumber}</span></p>
      </div>

      <div className="mb-6">
        <label className="block w-full cursor-pointer bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-400 rounded-2xl p-6 text-center transition-colors">
          {previewUrl ? (
            <img src={previewUrl} alt="Slip Preview" className="max-h-64 mx-auto rounded-lg shadow-sm" />
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <span className="text-5xl mb-3">📸</span>
              <span className="text-blue-800 font-bold text-lg">กดตรงนี้เพื่อเลือกรูปสลิป</span>
              <span className="text-sm text-blue-500 mt-1">รองรับสลิปธนาคารทุกแอป</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      {status.msg && (
        <div className={`p-4 rounded-xl mb-6 text-center font-bold text-sm shadow-sm ${
          status.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
          status.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
          'bg-yellow-100 text-yellow-700 border border-yellow-200'
        }`}>
          {status.msg}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={status.type === 'loading' || !file}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-xl shadow-lg transition transform active:scale-95 flex items-center justify-center"
      >
        {status.type === 'loading' ? '⏳ กำลังตรวจสอบสลิป...' : '📤 ยืนยันการส่งสลิป'}
      </button>
    </div>
  );
}

export default function CustomerPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <Suspense fallback={<div className="font-bold text-blue-600 text-xl animate-pulse">กำลังโหลดข้อมูล...</div>}>
        <SlipUploadContent />
      </Suspense>
    </div>
  );
}
