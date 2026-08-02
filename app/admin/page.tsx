'use client';

import { useEffect, useState, useRef } from 'react';

type RoomStatus = 'ว่าง' | 'ใช้งานอยู่';

interface RoomData {
  id: string;
  name: string;
  deviceId: string;
  price: number;
  usageCount: number;
  status: RoomStatus;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
  expireAt: string | null;
  isOnline?: boolean | null;
}

interface DatabaseRoom {
  id?: string;
  room_num?: string | number;
  room_number?: string | number;
  status?: string;
  tuya_device_id?: string | null;
  price?: number | string | null;
  expire_time?: string | null;
}

interface RoomsApiResponse {
  success?: boolean;
  rooms?: DatabaseRoom[];
  message?: string;
}

interface PromptPayApiResponse {
  success?: boolean;
  promptpay?: string;
  message?: string;
}

interface SaveApiResponse {
  success?: boolean;
  message?: string;
}

interface AutoOffSettingsApiResponse {
  success?: boolean;
  autoOffHours?: number;
  message?: string;
}

interface HistoryLog {
  room: string;
  price: number;
  checkIn: string;
  checkOut: string;
}

// 🛠️ บังคับค่าเริ่มต้นเป็น 11-18 ตายตัว
const defaultRooms: RoomData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `room_${i + 1}`,
  name: `${11 + i}`, 
  deviceId: '',
  price: 350,
  usageCount: 0,
  status: 'ว่าง',
  lastCheckIn: null,
  lastCheckOut: null,
  expireAt: null,
  isOnline: null,
}));

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

function formatCountdown(expireAt: string | null, nowTick: number): string {
  if (!expireAt) return '-';
  const target = new Date(expireAt).getTime();
  if (Number.isNaN(target)) return '-';
  const diffMs = target - nowTick;

  if (diffMs <= 0) return 'กำลังจะปิดไฟ...';

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const [rooms, setRooms] = useState<RoomData[]>(defaultRooms);
  const [promptpay, setPromptpay] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [autoOffHours, setAutoOffHours] = useState<number>(2);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);

  const roomsRef = useRef<RoomData[]>(rooms);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_authenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passwordInput === 'SG1234') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      return;
    }
    alert('❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    setPasswordInput('');
  };

  const addHistoryLog = async (roomName: string, roomPrice: number, checkInTime: string, checkOutTime: string) => {
    const newLog: HistoryLog = { room: roomName, price: roomPrice, checkIn: checkInTime, checkOut: checkOutTime };
    setHistoryLogs((prev) => [newLog, ...prev]);

    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', room: roomName, price: roomPrice, checkIn: checkInTime, checkOut: checkOutTime })
      });
    } catch (e) {
      console.error('Failed to save history to DB', e);
    }
  };

  const fetchInitialData = async () => {
    try {
      const ts = Date.now();
      
      try {
        const historyRes = await fetch(`/api/history?t=${ts}`, { cache: 'no-store' });
        const historyData = await historyRes.json();
        if (historyData.success && Array.isArray(historyData.logs)) {
          setHistoryLogs(historyData.logs.map((log: any) => ({
            room: log.room_name,
            price: log.price,
            checkIn: log.check_in,
            checkOut: log.check_out
          })));
        }
      } catch (e) {
        console.error('Fetch history error:', e);
      }

      const roomsResponse = await fetch(`/api/get-rooms?t=${ts}`, { method: 'GET', cache: 'no-store' });
      if (!roomsResponse.ok) throw new Error(`โหลดข้อมูลห้องไม่สำเร็จ (${roomsResponse.status})`);
      
      const roomsData = (await roomsResponse.json()) as RoomsApiResponse;

      if (roomsData.success && Array.isArray(roomsData.rooms)) {
        const sortedDbRooms = [...roomsData.rooms].sort((a, b) => {
            const numA = parseInt(String(a.room_num ?? a.room_number).replace(/\D/g, '')) || 0;
            const numB = parseInt(String(b.room_num ?? b.room_number).replace(/\D/g, '')) || 0;
            return numA - numB;
        });

        setRooms((previousRooms) =>
          previousRooms.map((room, index) => {
            const databaseRoom = sortedDbRooms[index]; 
            // 💡 ล็อกตายตัว! บังคับให้ชื่อห้องเป็น 11-18 ตามลำดับเสมอ ไม่สนใจข้อมูลจากฐานข้อมูล
            const fixedName = String(11 + index); 

            if (!databaseRoom) return { ...room, name: fixedName };

            const newStatus: RoomStatus = databaseRoom.status === 'occupied' ? 'ใช้งานอยู่' : 'ว่าง';
            const savedCheckIn = localStorage.getItem(`checkIn_${fixedName}`);

            return {
              ...room,
              id: databaseRoom.id || room.id, 
              name: fixedName, // 💡 ใช้ชื่อที่ล็อกไว้
              status: newStatus,
              deviceId: databaseRoom.tuya_device_id !== undefined && databaseRoom.tuya_device_id !== null
                  ? String(databaseRoom.tuya_device_id)
                  : room.deviceId,
              price: databaseRoom.price !== undefined && databaseRoom.price !== null
                  ? Number(databaseRoom.price)
                  : room.price,
              expireAt: databaseRoom.expire_time !== undefined ? databaseRoom.expire_time : room.expireAt,
              lastCheckIn: newStatus === 'ใช้งานอยู่' ? (savedCheckIn || room.lastCheckIn) : null,
            };
          })
        );
      }

      const promptPayResponse = await fetch(`/api/get-promptpay?t=${ts}`, { method: 'GET', cache: 'no-store' });
      if (promptPayResponse.ok) {
        const promptPayData = (await promptPayResponse.json()) as PromptPayApiResponse;
        if (promptPayData.success !== false && typeof promptPayData.promptpay === 'string') {
          setPromptpay(promptPayData.promptpay);
        }
      }

      try {
        const hoursResponse = await fetch(`/api/auto-off-settings?t=${ts}`, { method: 'GET', cache: 'no-store' });
        const hoursData = (await hoursResponse.json()) as AutoOffSettingsApiResponse;
        if (hoursResponse.ok && hoursData.success !== false && typeof hoursData.autoOffHours === 'number') {
          setAutoOffHours(hoursData.autoOffHours);
        }
      } catch (hoursError) {
        console.error('โหลดค่าตั้งเวลาปิดไฟอัตโนมัติไม่สำเร็จ:', hoursError);
      }
    } catch (error) {
      console.error('Fetch initial data error:', error);
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    }
  };

  const fetchRoomStatusOnly = async () => {
    try {
      const ts = Date.now();
      const response = await fetch(`/api/get-rooms?t=${ts}`, { method: 'GET', cache: 'no-store' });
      if (!response.ok) return;

      const data = (await response.json()) as RoomsApiResponse;
      if (!data.success || !Array.isArray(data.rooms)) return;

      setRooms((previousRooms) =>
        previousRooms.map((room) => {
          const databaseRoom = data.rooms?.find((item) => item.id === room.id);

          if (!databaseRoom) return room;

          const newStatus: RoomStatus = databaseRoom.status === 'occupied' ? 'ใช้งานอยู่' : 'ว่าง';
          const newExpireAt = databaseRoom.expire_time !== undefined ? databaseRoom.expire_time : room.expireAt;
          
          // 💡 คงชื่อห้อง 11-18 เอาไว้ ไม่ให้เปลี่ยนตามฐานข้อมูลตอนรีเฟรช
          const fixedName = room.name; 

          if (room.status === newStatus && room.expireAt === newExpireAt) {
            return room;
          }

          const now = new Date().toLocaleString('th-TH');
          let currentCheckIn = room.lastCheckIn;

          if (room.status === 'ว่าง' && newStatus === 'ใช้งานอยู่') {
            localStorage.setItem(`checkIn_${fixedName}`, now);
            currentCheckIn = now;
          } else if (room.status === 'ใช้งานอยู่' && newStatus === 'ว่าง') {
            const checkInTime = localStorage.getItem(`checkIn_${fixedName}`) || room.lastCheckIn || '-';
            addHistoryLog(fixedName, room.price, checkInTime, now);
            localStorage.removeItem(`checkIn_${fixedName}`);
            currentCheckIn = null;
          } else if (newStatus === 'ใช้งานอยู่') {
            currentCheckIn = localStorage.getItem(`checkIn_${fixedName}`) || room.lastCheckIn;
          }

          return {
            ...room,
            name: fixedName,
            status: newStatus,
            expireAt: newExpireAt,
            lastCheckIn: currentCheckIn,
            lastCheckOut: newStatus === 'ว่าง' && room.status === 'ใช้งานอยู่' ? now : (newStatus === 'ว่าง' ? room.lastCheckOut : null),
          };
        })
      );
    } catch (error) {
      console.error('Fetch room status error:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const checkWifiStatus = async () => {
      const currentRooms = [...roomsRef.current];
      let hasChanges = false;
      const ts = Date.now();

      for (let i = 0; i < currentRooms.length; i++) {
        const room = currentRooms[i];
        if (room.deviceId && room.deviceId.trim() !== '') {
          try {
            const res = await fetch(`/api/tuya-status?deviceId=${room.deviceId.trim()}&t=${ts}`, {
              cache: 'no-store'
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && room.isOnline !== data.isOnline) {
                currentRooms[i] = { ...room, isOnline: data.isOnline };
                hasChanges = true;
              }
            }
          } catch (e) {
            // ซ่อน error
          }
        }
      }
      
      if (hasChanges) {
        setRooms(currentRooms);
      }
    };

    checkWifiStatus();
    const wifiInterval = window.setInterval(checkWifiStatus, 60000); 
    return () => window.clearInterval(wifiInterval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchInitialData();
    const interval = window.setInterval(() => {
      void fetchRoomStatusOnly();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const tickInterval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(tickInterval);
  }, [isAuthenticated]);

  const handleSaveData = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setStatusMsg('⏳ กำลังบันทึกข้อมูลลงฐานข้อมูล...');

    try {
      const response = await fetch('/api/update-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ rooms, promptpay }),
      });

      const data = (await response.json().catch(() => null)) as SaveApiResponse | null;
      if (!response.ok || !data?.success) throw new Error(data?.message || `บันทึกข้อมูลไม่สำเร็จ (${response.status})`);

      await fetchInitialData();
      setStatusMsg(`✅ ${data.message || 'บันทึกข้อมูลลง Supabase สำเร็จ'}`);
    } catch (error) {
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
      window.setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  const handleSaveAutoOffHours = async () => {
    if (isSavingHours) return;
    if (!Number.isFinite(autoOffHours) || autoOffHours <= 0) {
      setStatusMsg('❌ จำนวนชั่วโมงต้องมากกว่า 0');
      window.setTimeout(() => setStatusMsg(''), 3000);
      return;
    }
    setIsSavingHours(true);
    try {
      const response = await fetch('/api/auto-off-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ autoOffHours }),
      });
      const data = (await response.json().catch(() => null)) as AutoOffSettingsApiResponse | null;
      if (!response.ok || !data?.success) throw new Error(data?.message || 'บันทึกค่าตั้งเวลาไม่สำเร็จ');
      setStatusMsg(`✅ ตั้งเวลาปิดไฟอัตโนมัติที่ ${autoOffHours} ชั่วโมงเรียบร้อยแล้ว`);
    } catch (error) {
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    } finally {
      setIsSavingHours(false);
      window.setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  const handleUpdateRoom = (id: string, field: keyof RoomData, value: string | number) => {
    // ปิดการอัปเดต 'name' เผื่อไว้กันพลาด
    if (field === 'name') return; 
    setRooms((previousRooms) =>
      previousRooms.map((room) => (room.id === id ? { ...room, [field]: value } : room))
    );
  };

  const handleExportCSV = () => {
    if (historyLogs.length === 0) {
      alert('ยังไม่มีประวัติการเข้าพักให้ส่งออก');
      return;
    }
    let csvContent = '\uFEFFห้อง,ราคา (บาท),เวลาเข้าพัก,เวลาออก\n';
    historyLogs.forEach((log) => {
      csvContent += `"${log.room}","${log.price}","${log.checkIn}","${log.checkOut}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hotel_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetCycle = async () => {
    const confirmed = window.confirm(
      '⚠️ ต้องการดาวน์โหลดเอกสาร และล้างข้อมูลเพื่อเริ่มรอบเดือนใหม่หรือไม่?\n(ข้อมูลในฐานข้อมูลจะถูกลบทิ้งถาวร)'
    );
    if (!confirmed) return;

    handleExportCSV();
    
    try {
      setStatusMsg('⏳ กำลังล้างข้อมูลในระบบ...');
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      });
      
      setHistoryLogs([]);
      setStatusMsg('🔄 รีเซ็ตรอบใหม่ และล้างฐานข้อมูลเรียบร้อยแล้ว');
    } catch (e) {
      setStatusMsg('❌ เกิดข้อผิดพลาดในการล้างข้อมูล');
    }
    
    window.setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleControl = async (room: RoomData, action: 'turn-on' | 'turn-off') => {
    if (!room.deviceId.trim()) {
      alert(`⚠️ กรุณาใส่ Device ID ของห้อง ${room.name} และกดบันทึกก่อน`);
      return;
    }

    setIsLoading(true);
    setStatusMsg(`⏳ กำลังส่งคำสั่งไปยังห้อง ${room.name}...`);
    const now = new Date().toLocaleString('th-TH');

    try {
      const response = await fetch('/api/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ roomNumber: room.name, deviceId: room.deviceId.trim(), action }),
      });

      const data = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message || 'ส่งคำสั่งไปยังอุปกรณ์ไม่สำเร็จ');

      const newStatus: RoomStatus = action === 'turn-on' ? 'ใช้งานอยู่' : 'ว่าง';
      const databaseStatus = action === 'turn-on' ? 'occupied' : 'available';

      await fetch('/api/get-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ roomNumber: room.name, status: databaseStatus }),
      });

      if (action === 'turn-on') {
        localStorage.setItem(`checkIn_${room.name}`, now);
      } else if (action === 'turn-off' && room.status === 'ใช้งานอยู่') {
        const checkInTime = localStorage.getItem(`checkIn_${room.name}`) || room.lastCheckIn || '-';
        addHistoryLog(room.name, room.price, checkInTime, now);
        localStorage.removeItem(`checkIn_${room.name}`);
      }

      await fetchRoomStatusOnly();
      setStatusMsg(`✅ สำเร็จ: ไฟห้อง ${room.name} ถูก${action === 'turn-on' ? 'เปิด' : 'ปิด'}แล้ว`);
    } catch (error) {
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getBaseUrl = () =>
    typeof window !== 'undefined' ? window.location.origin : 'https://hotel-system01.vercel.app';

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
          <p className="text-sm opacity-90">ระบบจัดการหลังบ้าน (Admin) & บันทึกประวัติการเข้าพัก</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveData()}
          disabled={isSaving}
          className="mt-4 md:mt-0 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center transition transform hover:scale-105"
        >
          {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูลการตั้งค่า'}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        {statusMsg && (
          <div className={`mb-6 p-4 rounded-xl border-2 text-xl font-bold text-center shadow-md transition-all ${
              statusMsg.includes('✅') || statusMsg.includes('💾') ? 'bg-green-100 border-green-400 text-green-800'
                : statusMsg.includes('⏳') || statusMsg.includes('🔄') ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                : 'bg-red-100 border-red-400 text-red-800'
            }`}>
            {statusMsg}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex flex-col space-y-2">
            <span className="font-bold text-gray-700">📱 หมายเลขพร้อมเพย์รับเงิน:</span>
            <input
              type="text"
              value={promptpay}
              onChange={(e) => setPromptpay(e.target.value)}
              placeholder="เบอร์พร้อมเพย์..."
              className="p-2 border-2 border-blue-400 rounded text-center font-bold text-gray-900 bg-white focus:outline-none focus:border-blue-600 w-64"
            />
          </div>

          <div className="mt-4 md:mt-0 flex flex-col items-end space-y-3">
            <div className="flex items-center space-x-2 bg-orange-50 border-2 border-orange-300 rounded-lg px-3 py-2">
              <span className="font-bold text-orange-700 text-sm whitespace-nowrap">⏱️ ปิดไฟอัตโนมัติหลัง (ชม.):</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={autoOffHours}
                onChange={(e) => setAutoOffHours(Number(e.target.value))}
                className="w-16 p-1 border border-gray-300 rounded font-bold text-orange-700 text-center bg-white"
              />
              <button
                type="button"
                onClick={() => void handleSaveAutoOffHours()}
                disabled={isSavingHours}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded font-bold text-xs"
              >
                บันทึก
              </button>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow"
              >
                📊 โหลดรายงาน Excel
              </button>
              <button
                type="button"
                onClick={handleResetCycle}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow"
              >
                🔄 จบรอบเดือน / เคลียร์ฐานข้อมูล
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl shadow-md overflow-hidden border-2 border-gray-200">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-2 w-1/2">
                  <span className="font-bold text-gray-500">ห้อง:</span>
                  {/* 💡 ล็อกช่องพิมพ์เป็น Read-only ให้เป็นสีเทาและพิมพ์แก้ไม่ได้ */}
                  <input
                    type="text"
                    value={room.name}
                    readOnly
                    className="text-2xl font-black text-blue-900 bg-gray-200 border border-gray-300 rounded px-2 w-full focus:outline-none cursor-not-allowed"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-500">ราคา:</span>
                  <input
                    type="number"
                    min="0"
                    value={room.price}
                    onChange={(e) => handleUpdateRoom(room.id, 'price', Number(e.target.value))}
                    className="w-20 p-1 border border-gray-300 rounded font-bold text-blue-700 text-center bg-white"
                  />
                  <span className="font-bold text-gray-500">฿</span>
                </div>
              </div>

              <div className="p-4">
                <div className={`text-center py-2 mb-2 rounded-lg font-bold text-lg transition-colors duration-500 ${
                    room.status === 'ว่าง' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                  สถานะ: {room.status === 'ว่าง' ? '🟢 ว่างพร้อมให้บริการ' : '🔴 มีลูกค้า (กำลังใช้งาน)'}
                </div>

                <div className={`text-center py-1 mb-2 rounded-lg font-semibold text-sm transition-colors duration-500 ${
                  room.isOnline === true ? 'bg-blue-50 text-blue-600 border border-blue-200' : 
                  room.isOnline === false ? 'bg-red-50 text-red-600 border border-red-200' : 
                  'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  📡 สัญญาณ Wi-Fi: {
                    room.isOnline === true ? '🟢 ออนไลน์ (ปกติ)' : 
                    room.isOnline === false ? '🔴 ออฟไลน์ (ไม่มีไฟ/เน็ตหลุด)' : 
                    '⚪ กำลังตรวจสอบ...'
                  }
                </div>

                {room.status === 'ใช้งานอยู่' && room.expireAt && (
                  <div className="text-center py-2 mb-4 rounded-lg font-bold text-base bg-orange-50 border border-orange-300 text-orange-700">
                    ⏱️ ปิดไฟอัตโนมัติในอีก: {formatCountdown(room.expireAt, nowTick)}
                  </div>
                )}

                <div className="mb-4 text-sm text-gray-600 flex justify-between mt-2">
                  <span>เข้า: {room.lastCheckIn || '-'}</span>
                  <span>ออก: {room.lastCheckOut || '-'}</span>
                </div>

                <div className="mb-4">
                  <input
                    type="text"
                    value={room.deviceId}
                    onChange={(e) => handleUpdateRoom(room.id, 'deviceId', e.target.value)}
                    className="w-full p-2 border-2 border-gray-300 rounded text-base font-semibold text-gray-900 bg-white placeholder-gray-400"
                    placeholder="🔧 ใส่ Device ID ของ Tuya ที่นี่..."
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-xl mb-4 flex justify-around">
                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-red-600 text-xs mb-1">1. สแกนจ่ายเงิน ({room.price} ฿)</p>
                    {promptpay ? (
                      <img src={`https://promptpay.io/${encodeURIComponent(promptpay)}/${room.price}.png`} alt={`QR ${room.name}`} className="w-24 h-24 mx-auto"/>
                    ) : (
                      <div className="w-24 h-24 mx-auto bg-gray-100 border text-xs flex items-center justify-center text-gray-500">ใส่พร้อมเพย์ก่อน</div>
                    )}
                  </div>

                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-green-600 text-xs mb-1">2. ส่งสลิป (ห้อง {room.name})</p>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${getBaseUrl()}/?room=${room.name}`)}`} alt={`QR Slip ${room.name}`} className="w-24 h-24 mx-auto"/>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button type="button" onClick={() => void handleControl(room, 'turn-on')} disabled={isLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-xl shadow">เปิดไฟ</button>
                  <button type="button" onClick={() => void handleControl(room, 'turn-off')} disabled={isLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-xl shadow">ปิดไฟ</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-black text-blue-900 mb-4">📋 ตารางประวัติการเข้าพัก (เก็บบันทึกรายละเอียด)</h2>
          {historyLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">ยังไม่มีประวัติการใช้งานในรอบนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-blue-100 text-blue-900">
                    <th className="p-3 border">ห้อง</th>
                    <th className="p-3 border">ราคา (บาท)</th>
                    <th className="p-3 border">เวลาเข้าพัก</th>
                    <th className="p-3 border">เวลาออก (สิ้นสุด)</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 border font-bold">ห้อง {log.room}</td>
                      <td className="p-3 border text-green-600 font-bold">{log.price} ฿</td>
                      <td className="p-3 border text-gray-700">{log.checkIn}</td>
                      <td className="p-3 border text-gray-700">{log.checkOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
