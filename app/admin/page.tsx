'use client';

import { useState, useEffect } from 'react';

interface RoomData {
  id: string;
  name: string;
  deviceId: string;
  price: number;
  usageCount: number;
  status: 'ว่าง' | 'ใช้งานอยู่'; // เพิ่มสถานะห้อง
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

const defaultRooms: RoomData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `room_${i + 1}`,
  name: `10${i + 1}`, // ชื่อห้องที่แก้ไขได้และจะไปโผล่ใน QR
  deviceId: '',
  price: 350,
  usageCount: 0,
  status: 'ว่าง',
  lastCheckIn: null,
  lastCheckOut: null,
}));

export default function AdminPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [promptpay, setPromptpay] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ดึงข้อมูลเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    const savedRooms = localStorage.getItem('singburi_grand_rooms_v2');
    const savedPP = localStorage.getItem('singburi_promptpay');
    
    if (savedRooms) setRooms(JSON.parse(savedRooms));
    else setRooms(defaultRooms);
    
    if (savedPP) setPromptpay(savedPP);
  }, []);

  // ฟังก์ชันสำหรับ "ปุ่มเซฟ" โดยเฉพาะ
  const handleSaveData = () => {
    localStorage.setItem('singburi_grand_rooms_v2', JSON.stringify(rooms));
    localStorage.setItem('singburi_promptpay', promptpay);
    setStatusMsg('💾 บันทึกข้อมูลการตั้งค่าทั้งหมดเรียบร้อยแล้ว!');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  // อัปเดตค่าต่างๆ ในหน้าจอ (ยังไม่เซฟถาวรจนกว่าจะกดปุ่ม)
  const handleUpdateRoom = (id: string, field: keyof RoomData, value: string | number) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // รีเซ็ตยอดรายวัน (กดตอนเที่ยงคืนหรือเช้า)
  const handleResetDaily = () => {
    if(confirm('⚠️ ต้องการเคลียร์ยอดสรุปรายวันและประวัติการเข้าพักทั้งหมดหรือไม่? (ชื่อห้องและราคายังอยู่เหมือนเดิม)')) {
      const resetRooms = rooms.map(r => ({ ...r, usageCount: 0, status: 'ว่าง' as const, lastCheckIn: null, lastCheckOut: null }));
      setRooms(resetRooms);
      localStorage.setItem('singburi_grand_rooms_v2', JSON.stringify(resetRooms));
      setStatusMsg('🔄 รีเซ็ตข้อมูลรายวันเรียบร้อยแล้ว');
    }
  };

  // สั่งเปิด-ปิดไฟ และเปลี่ยนสถานะ
  const handleControl = async (room: RoomData, action: 'turn-on' | 'turn-off') => {
    if (!room.deviceId) {
      alert(`⚠️ กรุณาใส่ "Device ID" ของห้อง ${room.name} และกดบันทึกก่อนครับ`);
      return;
    }
    setIsLoading(true);
    setStatusMsg(`⏳ กำลังส่งคำสั่งไปยังห้อง ${room.name}...`);
    try {
      const res = await fetch('/api/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber: room.name, deviceId: room.deviceId, action }),
      });
      const data = await res.json();
      const now = new Date().toLocaleString('th-TH');

      if (res.ok && data.success) {
        setStatusMsg(`✅ สำเร็จ: ไฟห้อง ${room.name} ถูก ${action === 'turn-on' ? 'เปิด' : 'ปิด'} แล้ว`);
        
        // อัปเดตสถานะและจำนวนครั้ง
        const updated = rooms.map(r => {
          if (r.id === room.id) {
            if (action === 'turn-on') return { ...r, status: 'ใช้งานอยู่', lastCheckIn: now, usageCount: r.usageCount + 1 };
            else return { ...r, status: 'ว่าง', lastCheckOut: now };
          }
          return r;
        });
        setRooms(updated);
        localStorage.setItem('singburi_grand_rooms_v2', JSON.stringify(updated)); // เซฟให้อัตโนมัติเมื่อมีการเปิดปิดไฟ

      } else {
        setStatusMsg(`❌ ไม่สำเร็จ: ${data.message}`);
      }
    } catch (error) {
      setStatusMsg('❌ ระบบขัดข้อง ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsLoading(false);
    }
  };

  const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : 'https://hotel-system01.vercel.app';

  // คำนวณสรุปรายวัน
  const totalIncome = rooms.reduce((sum, r) => sum + (r.usageCount * r.price), 0);
  const totalCheckIns = rooms.reduce((sum, r) => sum + r.usageCount, 0);

  if (rooms.length === 0) return null;

  return (
    <div className="min-h-screen bg-gray-100 pb-12 font-sans">
      <div className="bg-blue-900 text-white py-6 px-4 shadow-lg border-b-4 border-yellow-500 sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-yellow-400">🏨 สิงห์บุรีแกรนด์บางระจัน</h1>
          <p className="text-sm opacity-90">ระบบจัดการหลังบ้าน (Admin)</p>
        </div>
        <button onClick={handleSaveData} className="mt-4 md:mt-0 bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center transition transform hover:scale-105">
          💾 บันทึกข้อมูลการตั้งค่า
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        {statusMsg && (
          <div className={`mb-6 p-4 rounded-xl border-2 text-xl font-bold text-center shadow-md transition-all ${
            statusMsg.includes('✅') || statusMsg.includes('💾') ? 'bg-green-100 border-green-400 text-green-800' : 
            statusMsg.includes('⏳') ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 
            'bg-red-100 border-red-400 text-red-800'
          }`}>{statusMsg}</div>
        )}

        {/* แดชบอร์ดสรุปรายวัน */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex space-x-8">
            <div>
              <p className="text-gray-500 font-bold">💰 คาดการณ์รายได้วันนี้</p>
              <p className="text-4xl font-black text-green-600">{totalIncome.toLocaleString()} บาท</p>
            </div>
            <div>
              <p className="text-gray-500 font-bold">🛏️ จำนวนการเปิดห้อง</p>
              <p className="text-4xl font-black text-blue-600">{totalCheckIns} ครั้ง</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col items-end">
            <input type="text" value={promptpay} onChange={(e) => setPromptpay(e.target.value)} placeholder="เบอร์พร้อมเพย์รับเงิน..." className="p-2 border-2 border-blue-300 rounded mb-2 text-center font-bold" />
            <button onClick={handleResetDaily} className="text-red-500 hover:text-red-700 font-bold text-sm underline">🔄 รีเซ็ตยอดรายวัน (เริ่มวันใหม่)</button>
          </div>
        </div>

        {/* จัดการห้องพัก */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl shadow-md overflow-hidden border-2 border-gray-200">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-2 w-1/2">
                  <span className="font-bold text-gray-500">ห้อง:</span>
                  <input type="text" value={room.name} onChange={(e) => handleUpdateRoom(room.id, 'name', e.target.value)} className="text-2xl font-black text-blue-900 bg-white border border-gray-300 rounded px-2 w-full focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-500">ราคา:</span>
                  <input type="number" value={room.price} onChange={(e) => handleUpdateRoom(room.id, 'price', Number(e.target.value))} className="w-20 p-1 border border-gray-300 rounded font-bold text-blue-700 text-center" />
                  <span className="font-bold text-gray-500">฿</span>
                </div>
              </div>

              <div className="p-4">
                {/* แสดงสถานะแบบชัดเจน */}
                <div className={`text-center py-2 mb-4 rounded-lg font-bold text-lg ${room.status === 'ว่าง' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  สถานะ: {room.status === 'ว่าง' ? '🟢 ว่างพร้อมให้บริการ' : '🔴 มีลูกค้า (กำลังใช้งาน)'}
                </div>

                <div className="mb-4 text-sm text-gray-600 flex justify-between">
                  <span>เข้า: {room.lastCheckIn || '-'}</span>
                  <span>ออก: {room.lastCheckOut || '-'}</span>
                </div>

                <div className="mb-4">
                  <input type="text" value={room.deviceId} onChange={(e) => handleUpdateRoom(room.id, 'deviceId', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50" placeholder="🔧 Device ID ของ Tuya" />
                </div>

                <div className="bg-blue-50 p-4 rounded-xl mb-4 flex justify-around">
                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-red-600 text-xs mb-1">1. สแกนจ่ายเงิน ({room.price} ฿)</p>
                    {promptpay ? <img src={`https://promptpay.io/${promptpay}/${room.price}.png`} alt="Pay QR" className="w-24 h-24 mx-auto" /> : <div className="w-24 h-24 mx-auto bg-gray-100 border text-xs flex items-center">ใส่พร้อมเพย์ก่อน</div>}
                  </div>
                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-green-600 text-xs mb-1">2. ส่งสลิป (ห้อง {room.name})</p>
                    {/* สังเกตว่าโค้ด QR ใช้ room.name ที่ตั้งไว้เป๊ะๆ */}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${getBaseUrl()}/?room=${room.name}`)}`} alt="Upload QR" className="w-24 h-24 mx-auto" />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button onClick={() => handleControl(room, 'turn-on')} disabled={isLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-xl shadow">เปิดไฟ</button>
                  <button onClick={() => handleControl(room, 'turn-off')} disabled={isLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-xl shadow">ปิดไฟ</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
