'use client';

import { useState, useEffect } from 'react';

interface RoomData {
  id: string;
  name: string;
  deviceId: string;
  price: number; // เพิ่มตัวแปรราคาห้อง
  usageCount: number;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

const defaultRooms: RoomData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `10${i + 1}`,
  name: `ห้อง 10${i + 1}`,
  deviceId: '',
  price: 350, // ราคาเริ่มต้น
  usageCount: 0,
  lastCheckIn: null,
  lastCheckOut: null,
}));

export default function AdminPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [promptpay, setPromptpay] = useState(''); // เก็บเบอร์พร้อมเพย์โรงแรม
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedRooms = localStorage.getItem('singburi_grand_rooms');
    const savedPP = localStorage.getItem('singburi_promptpay');
    
    if (savedRooms) setRooms(JSON.parse(savedRooms));
    else setRooms(defaultRooms);
    
    if (savedPP) setPromptpay(savedPP);
  }, []);

  const saveToLocal = (newRooms: RoomData[], newPP: string = promptpay) => {
    setRooms(newRooms);
    localStorage.setItem('singburi_grand_rooms', JSON.stringify(newRooms));
    localStorage.setItem('singburi_promptpay', newPP);
  };

  const handleUpdateRoom = (id: string, field: keyof RoomData, value: string | number) => {
    const updated = rooms.map(r => r.id === id ? { ...r, [field]: value } : r);
    saveToLocal(updated);
  };

  const handlePromptpayChange = (val: string) => {
    setPromptpay(val);
    saveToLocal(rooms, val);
  };

  const handleControl = async (room: RoomData, action: 'turn-on' | 'turn-off') => {
    if (!room.deviceId) {
      alert(`⚠️ กรุณาใส่รหัส "Device ID" ของ ${room.name} ก่อนครับ`);
      return;
    }
    setIsLoading(true);
    setStatusMsg(`⏳ กำลังส่งคำสั่งไปยัง ${room.name}...`);
    try {
      const res = await fetch('/api/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber: room.id, deviceId: room.deviceId, action }),
      });
      const data = await res.json();
      const now = new Date().toLocaleString('th-TH');

      if (res.ok && data.success) {
        setStatusMsg(`✅ สำเร็จ: ${room.name} ถูก ${action === 'turn-on' ? 'เปิด' : 'ปิด'} แล้ว`);
        const updated = rooms.map(r => {
          if (r.id === room.id) {
            if (action === 'turn-on') return { ...r, lastCheckIn: now, usageCount: r.usageCount + 1 };
            else return { ...r, lastCheckOut: now };
          }
          return r;
        });
        saveToLocal(updated);
      } else {
        setStatusMsg(`❌ ไม่สำเร็จ: ${data.message}`);
      }
    } catch (error) {
      setStatusMsg('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  // ฟังก์ชันดึง URL ของเว็บไซต์เราอัตโนมัติ
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'https://hotel-system01.vercel.app';
  };

  if (rooms.length === 0) return null;

  return (
    <div className="min-h-screen bg-gray-100 pb-12 font-sans">
      <div className="bg-blue-900 text-white py-8 px-4 shadow-lg mb-8 border-b-4 border-yellow-500">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 text-yellow-400 drop-shadow-md">
            โรงแรม สิงห์บุรีแกรนด์บางระจัน
          </h1>
          <p className="text-xl font-light opacity-90">ระบบบริหารจัดการแบบเบ็ดเสร็จ</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* ตั้งค่าโรงแรม (เบอร์พร้อมเพย์) */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-8 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🏦 ตั้งค่าบัญชีรับเงินของโรงแรม</h2>
          <label className="block text-gray-700 font-bold mb-2">เบอร์พร้อมเพย์ / เลขบัตรประชาชน:</label>
          <input 
            type="text" 
            value={promptpay}
            onChange={(e) => handlePromptpayChange(e.target.value)}
            className="w-full md:w-2/3 p-3 border-2 border-blue-300 rounded-lg text-xl text-center focus:outline-none focus:border-blue-500 font-bold"
            placeholder="เช่น 0812345678"
          />
          <p className="text-sm text-gray-500 mt-2">ระบบจะนำเบอร์นี้ไปสร้าง QR Code รับเงินอัตโนมัติ</p>
        </div>

        {statusMsg && (
          <div className={`mb-8 p-4 rounded-xl border-2 text-xl font-bold text-center shadow-md ${
            statusMsg.includes('✅') ? 'bg-green-100 border-green-400 text-green-800' : 
            statusMsg.includes('⏳') ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 
            'bg-red-100 border-red-400 text-red-800'
          }`}>{statusMsg}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
              
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
                <input 
                  type="text" 
                  value={room.name}
                  onChange={(e) => handleUpdateRoom(room.id, 'name', e.target.value)}
                  className="text-2xl font-bold text-gray-800 bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none w-1/3"
                />
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-600">ราคา:</span>
                  <input 
                    type="number" 
                    value={room.price}
                    onChange={(e) => handleUpdateRoom(room.id, 'price', Number(e.target.value))}
                    className="w-24 p-2 border border-gray-300 rounded font-bold text-blue-700 text-center focus:outline-none"
                  />
                  <span className="font-bold text-gray-600">บาท</span>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-gray-700 font-bold mb-2">🔧 Device ID (ตัวเปิดไฟ):</label>
                  <input 
                    type="text" 
                    value={room.deviceId}
                    onChange={(e) => handleUpdateRoom(room.id, 'deviceId', e.target.value)}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg text-lg focus:outline-none focus:border-blue-400"
                    placeholder="ใส่รหัส Tuya ที่นี่..."
                  />
                </div>

                {/* โซนสร้าง QR Code คู่ */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                  <h3 className="font-bold text-blue-900 mb-3 text-center text-lg">🖨️ QR Code สำหรับแปะหน้าห้อง (เซฟรูปไปปรินต์ได้เลย)</h3>
                  <div className="flex flex-col md:flex-row justify-around items-center gap-4">
                    
                    {/* QR รับเงิน */}
                    <div className="text-center bg-white p-3 rounded-lg shadow-sm border border-gray-200 w-full md:w-1/2">
                      <p className="font-bold text-red-600 mb-2">1. สแกนจ่ายเงิน ({room.price} ฿)</p>
                      {promptpay ? (
                        <img 
                          src={`https://promptpay.io/${promptpay}/${room.price}.png`} 
                          alt="PromptPay QR" 
                          className="w-32 h-32 mx-auto border"
                        />
                      ) : (
                        <div className="w-32 h-32 mx-auto bg-gray-100 flex items-center justify-center text-xs text-gray-400 text-center border">
                          ใส่เบอร์พร้อมเพย์<br/>ด้านบนก่อน
                        </div>
                      )}
                    </div>

                    {/* QR อัปโหลดสลิป */}
                    <div className="text-center bg-white p-3 rounded-lg shadow-sm border border-gray-200 w-full md:w-1/2">
                      <p className="font-bold text-green-600 mb-2">2. สแกนส่งสลิป (เปิดไฟ)</p>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${getBaseUrl()}/?room=${room.id}`)}`} 
                        alt="Upload Link QR" 
                        className="w-32 h-32 mx-auto border"
                      />
                    </div>

                  </div>
                </div>

                <div className="flex space-x-4">
                  <button onClick={() => handleControl(room, 'turn-on')} disabled={isLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-xl shadow-sm">
                    เปิดไฟ
                  </button>
                  <button onClick={() => handleControl(room, 'turn-off')} disabled={isLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-xl shadow-sm">
                    ปิดไฟ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
