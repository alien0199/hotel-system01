'use client';

import { useState, useEffect } from 'react';

interface RoomData {
  id: string;
  name: string;
  deviceId: string;
  price: number;
  usageCount: number;
  status: 'ว่าง' | 'ใช้งานอยู่';
  lastCheckIn: string | null;
  lastCheckOut: string | null;
}

const defaultRooms: RoomData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `room_${i + 1}`,
  name: `10${i + 1}`,
  deviceId: '',
  price: 350,
  usageCount: 0,
  status: 'ว่าง',
  lastCheckIn: null,
  lastCheckOut: null,
}));

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const [rooms, setRooms] = useState<RoomData[]>(defaultRooms);
  const [promptpay, setPromptpay] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 🧹 ทุบหม้อข้าว! ล้างความจำเก่าในเครื่องทิ้งให้หมด จะได้ไม่เอาเบอร์เก่ามาโชว์
    localStorage.removeItem('singburi_grand_rooms_v2');
    localStorage.removeItem('singburi_promptpay');

    const auth = sessionStorage.getItem('admin_authenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'SG1234') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
    } else {
      alert('❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      setPasswordInput('');
    }
  };

  // โหลดข้อมูลทั้งหมดครั้งแรกตอนเข้าหน้าเว็บ
  const fetchInitialData = async () => {
    try {
      // 🚀 ใส่ timestamp เพื่อหลอก Vercel ไม่ให้ใช้ Cache เก่า (บังคับดึงข้อมูลใหม่เสมอ)
      const ts = new Date().getTime();

      const res = await fetch(`/api/get-rooms?t=${ts}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rooms) {
          setRooms(prevRooms => {
            return prevRooms.map(room => {
              const dbRoom = data.rooms.find((r: any) => String(r.room_number || r.room_num) === String(room.name));
              if (dbRoom) {
                const newStatus = dbRoom.status === 'occupied' ? 'ใช้งานอยู่' : 'ว่าง';
                return {
                  ...room,
                  status: newStatus as 'ว่าง' | 'ใช้งานอยู่',
                  deviceId: dbRoom.tuya_device_id || room.deviceId,
                  price: dbRoom.price !== undefined && dbRoom.price !== null ? Number(dbRoom.price) : room.price,
                };
              }
              return room;
            });
          });
        }
      }

      const ppRes = await fetch(`/api/get-promptpay?t=${ts}`);
      if (ppRes.ok) {
        const ppData = await ppRes.json();
        if (ppData.promptpay) {
          setPromptpay(ppData.promptpay);
        }
      }
    } catch (err) {
      console.error('Fetch initial data error:', err);
    }
  };

  // ดึงเฉพาะสถานะห้องทุกๆ 5 วินาที
  const fetchRoomStatusOnly = async () => {
    try {
      const ts = new Date().getTime();
      const res = await fetch(`/api/get-rooms?t=${ts}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rooms) {
          setRooms(prevRooms => {
            return prevRooms.map(room => {
              const dbRoom = data.rooms.find((r: any) => String(r.room_number || r.room_num) === String(room.name));
              if (dbRoom) {
                const newStatus = dbRoom.status === 'occupied' ? 'ใช้งานอยู่' : 'ว่าง';
                if (room.status !== newStatus) {
                  const now = new Date().toLocaleString('th-TH');
                  return {
                    ...room,
                    status: newStatus as 'ว่าง' | 'ใช้งานอยู่',
                    lastCheckIn: newStatus === 'ใช้งานอยู่' ? now : room.lastCheckIn,
                    lastCheckOut: newStatus === 'ว่าง' ? now : room.lastCheckOut,
                    usageCount: newStatus === 'ใช้งานอยู่' ? room.usageCount + 1 : room.usageCount
                  };
                }
              }
              return room;
            });
          });
        }
      }
    } catch (err) {
      console.error('Fetch status error:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInitialData();
    const interval = setInterval(fetchRoomStatusOnly, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleSaveData = async () => {
    setStatusMsg('⏳ กำลังบันทึกข้อมูล...');
    try {
      const res = await fetch('/api/update-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms, promptpay }),
      });

      if (res.ok) {
        setStatusMsg('💾 บันทึกข้อมูลลงฐานข้อมูลสำเร็จ รีเฟรชก็ไม่หายแล้ว!');
      } else {
        setStatusMsg('❌ บันทึกลงฐานข้อมูลไม่สำเร็จ');
      }
    } catch (error) {
      setStatusMsg('❌ ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleUpdateRoom = (id: string, field: keyof RoomData, value: string | number) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleResetDaily = () => {
    if(confirm('⚠️ ต้องการเคลียร์ยอดสรุปรายวันและสถานะห้องทั้งหมดหรือไม่?')) {
      const resetRooms = rooms.map(r => ({ ...r, usageCount: 0, status: 'ว่าง' as 'ว่าง' | 'ใช้งานอยู่', lastCheckIn: null, lastCheckOut: null }));
      setRooms(resetRooms);
      
      resetRooms.forEach(room => {
        fetch('/api/get-rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomNumber: room.name, status: 'available' }),
        });
      });

      setStatusMsg('🔄 รีเซ็ตข้อมูลรายวันเรียบร้อยแล้ว');
    }
  };

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
        
        const newStatus = action === 'turn-on' ? 'ใช้งานอยู่' : 'ว่าง';
        const dbStatus = action === 'turn-on' ? 'occupied' : 'available';

        fetch('/api/get-rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomNumber: room.name, status: dbStatus }),
        });
        
        setRooms(rooms.map(r => {
          if (r.id === room.id) {
            if (action === 'turn-on') return { ...r, status: newStatus as 'ว่าง' | 'ใช้งานอยู่', lastCheckIn: now, usageCount: r.usageCount + 1 };
            else return { ...r, status: newStatus as 'ว่าง' | 'ใช้งานอยู่', lastCheckOut: now };
          }
          return r;
        }));

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
  const totalIncome = rooms.reduce((sum, r) => sum + (r.usageCount * r.price), 0);
  const totalCheckIns = rooms.reduce((sum, r) => sum + r.usageCount, 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center px-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border-4 border-yellow-400 text-center">
          <h1 className="text-2xl font-black text-blue-900 mb-2">🏨 สิงห์บุรีแกรนด์บางระจัน</h1>
          <p className="text-gray-500 mb-6 font-semibold">กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบจัดการ</p>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              placeholder="🔑 กรอกรหัสผ่านผู้ดูแลระบบ" 
              className="w-full p-3 border-2 border-blue-400 rounded-xl mb-4 text-center font-bold text-xl text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-600"
              autoFocus
            />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-lg shadow-lg transition">
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            <input 
              type="text" 
              value={promptpay} 
              onChange={(e) => setPromptpay(e.target.value)} 
              placeholder="เบอร์พร้อมเพย์รับเงิน..." 
              className="p-2 border-2 border-blue-400 rounded mb-2 text-center font-bold text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-600" 
            />
            <button onClick={handleResetDaily} className="text-red-500 hover:text-red-700 font-bold text-sm underline">🔄 รีเซ็ตยอดรายวัน (เริ่มวันใหม่)</button>
          </div>
        </div>

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
                  <input type="number" value={room.price} onChange={(e) => handleUpdateRoom(room.id, 'price', Number(e.target.value))} className="w-20 p-1 border border-gray-300 rounded font-bold text-blue-700 text-center bg-white" />
                  <span className="font-bold text-gray-500">฿</span>
                </div>
              </div>

              <div className="p-4">
                <div className={`text-center py-2 mb-4 rounded-lg font-bold text-lg transition-colors duration-500 ${room.status === 'ว่าง' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  สถานะ: {room.status === 'ว่าง' ? '🟢 ว่างพร้อมให้บริการ' : '🔴 มีลูกค้า (กำลังใช้งาน)'}
                </div>

                <div className="mb-4 text-sm text-gray-600 flex justify-between">
                  <span>เข้า: {room.lastCheckIn || '-'}</span>
                  <span>ออก: {room.lastCheckOut || '-'}</span>
                </div>

                <div className="mb-4">
                  <input 
                    type="text" 
                    value={room.deviceId} 
                    onChange={(e) => handleUpdateRoom(room.id, 'deviceId', e.target.value)} 
                    className="w-full p-2 border-2 border-gray-300 rounded text-base font-semibold text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500" 
                    placeholder="🔧 ใส่ Device ID ของ Tuya ที่นี่..." 
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-xl mb-4 flex justify-around">
                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-red-600 text-xs mb-1">1. สแกนจ่ายเงิน ({room.price} ฿)</p>
                    {promptpay ? <img src={`https://promptpay.io/${promptpay}/${room.price}.png`} alt="Pay QR" className="w-24 h-24 mx-auto" /> : <div className="w-24 h-24 mx-auto bg-gray-100 border text-xs flex items-center justify-center text-gray-500">ใส่พร้อมเพย์ก่อน</div>}
                  </div>
                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-green-600 text-xs mb-1">2. ส่งสลิป (ห้อง {room.name})</p>
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
