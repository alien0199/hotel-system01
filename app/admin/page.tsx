'use client';

import { useState, useEffect } from 'react';

// โครงสร้างข้อมูลของแต่ละห้อง
interface RoomData {
  id: string;
  name: string;
  deviceId: string;
  usageCount: number;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

// ข้อมูลเริ่มต้นตั้งต้น
const defaultRooms: RoomData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `10${i + 1}`,
  name: `ห้อง 10${i + 1}`,
  deviceId: '',
  usageCount: 0,
  lastCheckIn: null,
  lastCheckOut: null,
}));

export default function AdminPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ดึงข้อมูลที่เคยบันทึกไว้ในความจำของเบราว์เซอร์ (ช่วยให้ไม่ต้องกรอก Device ID ใหม่ทุกครั้ง)
  useEffect(() => {
    const saved = localStorage.getItem('singburi_grand_rooms');
    if (saved) {
      setRooms(JSON.parse(saved));
    } else {
      setRooms(defaultRooms);
    }
  }, []);

  // ฟังก์ชันบันทึกข้อมูลอัตโนมัติ
  const saveToLocal = (newRooms: RoomData[]) => {
    setRooms(newRooms);
    localStorage.setItem('singburi_grand_rooms', JSON.stringify(newRooms));
  };

  // ฟังก์ชันเมื่อมีการพิมพ์เปลี่ยนชื่อห้อง หรือ Device ID
  const handleUpdateRoom = (id: string, field: keyof RoomData, value: string) => {
    const updated = rooms.map(r => r.id === id ? { ...r, [field]: value } : r);
    saveToLocal(updated);
  };

  // ฟังก์ชันกดเปิด-ปิดไฟ
  const handleControl = async (room: RoomData, action: 'turn-on' | 'turn-off') => {
    if (!room.deviceId) {
      alert(`⚠️ กรุณาใส่รหัส "Device ID" ของ ${room.name} ในช่องก่อนสั่งงานครับ`);
      return;
    }

    setIsLoading(true);
    setStatusMsg(`⏳ กำลังส่งคำสั่งไปยัง ${room.name}...`);

    try {
      // หมายเหตุ: โค้ดส่วนนี้จะส่ง deviceId ไปให้ API ของคุณใช้งานด้วย
      const res = await fetch('/api/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber: room.id, deviceId: room.deviceId, action }),
      });

      const data = await res.json();
      const now = new Date().toLocaleString('th-TH');

      if (res.ok && data.success) {
        setStatusMsg(`✅ สำเร็จ: ${room.name} ถูก ${action === 'turn-on' ? 'เปิด' : 'ปิด'} แล้ว`);

        // บันทึกเวลาเข้า-ออก และนับจำนวนครั้ง
        const updated = rooms.map(r => {
          if (r.id === room.id) {
            if (action === 'turn-on') {
              return { ...r, lastCheckIn: now, usageCount: r.usageCount + 1 };
            } else {
              return { ...r, lastCheckOut: now };
            }
          }
          return r;
        });
        saveToLocal(updated);

      } else {
        setStatusMsg(`❌ ไม่สำเร็จ: ${data.message || 'รหัส Device ID อาจไม่ถูกต้อง หรืออุปกรณ์ออฟไลน์'}`);
      }
    } catch (error) {
      setStatusMsg('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  // ป้องกันหน้าจอกระพริบตอนโหลดข้อมูล
  if (rooms.length === 0) return null; 

  return (
    <div className="min-h-screen bg-gray-100 pb-12 font-sans">
      {/* ส่วนหัวโรงแรม (Header) */}
      <div className="bg-blue-900 text-white py-8 px-4 shadow-lg mb-8 border-b-4 border-yellow-500">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 text-yellow-400 drop-shadow-md">
            โรงแรม สิงห์บุรีแกรนด์บางระจัน
          </h1>
          <p className="text-xl font-light opacity-90">ระบบจัดการหลังบ้าน (Admin Dashboard)</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* กล่องข้อความแจ้งเตือน */}
        {statusMsg && (
          <div className={`mb-8 p-4 rounded-xl border-2 text-xl font-bold text-center shadow-md ${
            statusMsg.includes('✅') ? 'bg-green-100 border-green-400 text-green-800' : 
            statusMsg.includes('⏳') ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 
            'bg-red-100 border-red-400 text-red-800'
          }`}>
            {statusMsg}
          </div>
        )}

        {/* ตารางห้องพัก (Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition">
              
              {/* แถบสีด้านบนของแต่ละการ์ด */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <input 
                  type="text" 
                  value={room.name}
                  onChange={(e) => handleUpdateRoom(room.id, 'name', e.target.value)}
                  className="text-2xl font-bold text-gray-800 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-1/2"
                  placeholder="ชื่อห้อง..."
                />
                <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
                  ใช้งาน {room.usageCount} ครั้ง
                </span>
              </div>

              <div className="p-6">
                {/* ช่องกรอก Device ID */}
                <div className="mb-5">
                  <label className="block text-gray-700 font-bold mb-2 text-lg">🔧 รหัสอุปกรณ์ (Device ID):</label>
                  <input 
                    type="text" 
                    value={room.deviceId}
                    onChange={(e) => handleUpdateRoom(room.id, 'deviceId', e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="ใส่รหัส Device ID ของ Tuya/Sonoff ที่นี่..."
                  />
                </div>

                {/* สรุปเวลาเข้า-ออก */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200 text-gray-600 space-y-2 text-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2 text-xl">🟢</span>
                    <strong>เวลาเข้าล่าสุด:</strong> <span className="ml-2">{room.lastCheckIn || 'ยังไม่มีข้อมูล'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-red-500 mr-2 text-xl">🔴</span>
                    <strong>เวลาออกล่าสุด:</strong> <span className="ml-2">{room.lastCheckOut || 'ยังไม่มีข้อมูล'}</span>
                  </div>
                </div>

                {/* ปุ่มควบคุม */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleControl(room, 'turn-on')}
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-2xl transition shadow-sm"
                  >
                    เปิดไฟ
                  </button>
                  <button
                    onClick={() => handleControl(room, 'turn-off')}
                    disabled={isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold text-2xl transition shadow-sm"
                  >
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
