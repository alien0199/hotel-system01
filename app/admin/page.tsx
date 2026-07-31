'use client';

import { useEffect, useState } from 'react';

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

const defaultRooms: RoomData[] = Array.from({ length: 8 }, (_, i) => ({
  id: `room_${i + 1}`,
  name: `10${i + 1}`,
  deviceId: '',
  price: 350,
  usageCount: 0,
  status: 'ว่าง',
  lastCheckIn: null,
  lastCheckOut: null,
  expireAt: null,
}));

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

// แปลงเวลาหมดอายุ (expire_time) เป็นข้อความนับถอยหลัง HH:MM:SS
function formatCountdown(
  expireAt: string | null,
  nowTick: number
): string {
  if (!expireAt) {
    return '-';
  }

  const target = new Date(expireAt).getTime();

  if (Number.isNaN(target)) {
    return '-';
  }

  const diffMs = target - nowTick;

  if (diffMs <= 0) {
    return 'กำลังจะปิดไฟ...';
  }

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

  // ⏱️ ค่าตั้งเวลาปิดไฟอัตโนมัติ (ชั่วโมง) และตัวช่วยนับถอยหลังแบบเรียลไทม์
  const [autoOffHours, setAutoOffHours] = useState<number>(2);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    // ล้างข้อมูลเก่าที่เคยบันทึกไว้ในเบราว์เซอร์
    localStorage.removeItem('singburi_grand_rooms_v2');
    localStorage.removeItem('singburi_promptpay');

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

  // โหลดข้อมูลห้อง, พร้อมเพย์ และค่าตั้งเวลาปิดไฟอัตโนมัติจากฐานข้อมูล
  const fetchInitialData = async () => {
    try {
      const ts = Date.now();

      const roomsResponse = await fetch(`/api/get-rooms?t=${ts}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!roomsResponse.ok) {
        throw new Error(
          `โหลดข้อมูลห้องไม่สำเร็จ (${roomsResponse.status})`
        );
      }

      const roomsData =
        (await roomsResponse.json()) as RoomsApiResponse;

      if (roomsData.success && Array.isArray(roomsData.rooms)) {
        setRooms((previousRooms) =>
          previousRooms.map((room) => {
            const databaseRoom = roomsData.rooms?.find((item) => {
              const databaseRoomNumber =
                item.room_num ?? item.room_number;

              return (
                String(databaseRoomNumber ?? '').trim() ===
                String(room.name).trim()
              );
            });

            if (!databaseRoom) {
              return room;
            }

            const newStatus: RoomStatus =
              databaseRoom.status === 'occupied'
                ? 'ใช้งานอยู่'
                : 'ว่าง';

            return {
              ...room,
              id: databaseRoom.id || room.id,
              status: newStatus,
              deviceId:
                databaseRoom.tuya_device_id !== undefined &&
                databaseRoom.tuya_device_id !== null
                  ? String(databaseRoom.tuya_device_id)
                  : room.deviceId,
              price:
                databaseRoom.price !== undefined &&
                databaseRoom.price !== null
                  ? Number(databaseRoom.price)
                  : room.price,
              expireAt:
                databaseRoom.expire_time !== undefined
                  ? databaseRoom.expire_time
                  : room.expireAt,
            };
          })
        );
      }

      const promptPayResponse = await fetch(
        `/api/get-promptpay?t=${ts}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      if (!promptPayResponse.ok) {
        throw new Error(
          `โหลดข้อมูลพร้อมเพย์ไม่สำเร็จ (${promptPayResponse.status})`
        );
      }

      const promptPayData =
        (await promptPayResponse.json()) as PromptPayApiResponse;

      if (
        promptPayData.success !== false &&
        typeof promptPayData.promptpay === 'string'
      ) {
        setPromptpay(promptPayData.promptpay);
      }

      // โหลดค่าตั้งเวลาปิดไฟอัตโนมัติ (ไม่ทำให้ทั้งหน้าพังถ้าโหลดไม่สำเร็จ)
      try {
        const hoursResponse = await fetch(
          `/api/auto-off-settings?t=${ts}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

        const hoursData =
          (await hoursResponse.json()) as AutoOffSettingsApiResponse;

        if (
          hoursResponse.ok &&
          hoursData.success !== false &&
          typeof hoursData.autoOffHours === 'number'
        ) {
          setAutoOffHours(hoursData.autoOffHours);
        }
      } catch (hoursError) {
        console.error(
          'โหลดค่าตั้งเวลาปิดไฟอัตโนมัติไม่สำเร็จ:',
          hoursError
        );
      }
    } catch (error) {
      console.error('Fetch initial data error:', error);
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    }
  };

  // ดึงเฉพาะสถานะห้อง (รวมเวลาหมดอายุ) ทุก 5 วินาที
  const fetchRoomStatusOnly = async () => {
    try {
      const ts = Date.now();

      const response = await fetch(`/api/get-rooms?t=${ts}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `โหลดสถานะห้องไม่สำเร็จ (${response.status})`
        );
      }

      const data = (await response.json()) as RoomsApiResponse;

      if (!data.success || !Array.isArray(data.rooms)) {
        return;
      }

      setRooms((previousRooms) =>
        previousRooms.map((room) => {
          const databaseRoom = data.rooms?.find((item) => {
            const databaseRoomNumber =
              item.room_num ?? item.room_number;

            return (
              String(databaseRoomNumber ?? '').trim() ===
              String(room.name).trim()
            );
          });

          if (!databaseRoom) {
            return room;
          }

          const newStatus: RoomStatus =
            databaseRoom.status === 'occupied'
              ? 'ใช้งานอยู่'
              : 'ว่าง';

          const newExpireAt =
            databaseRoom.expire_time !== undefined
              ? databaseRoom.expire_time
              : room.expireAt;

          if (
            room.status === newStatus &&
            room.expireAt === newExpireAt
          ) {
            return room;
          }

          const now = new Date().toLocaleString('th-TH');

          return {
            ...room,
            status: newStatus,
            expireAt: newExpireAt,
            lastCheckIn:
              newStatus === 'ใช้งานอยู่' && room.status !== newStatus
                ? now
                : room.lastCheckIn,
            lastCheckOut:
              newStatus === 'ว่าง' && room.status !== newStatus
                ? now
                : room.lastCheckOut,
            usageCount:
              newStatus === 'ใช้งานอยู่' && room.status !== newStatus
                ? room.usageCount + 1
                : room.usageCount,
          };
        })
      );
    } catch (error) {
      console.error('Fetch room status error:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void fetchInitialData();

    const interval = window.setInterval(() => {
      void fetchRoomStatusOnly();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated]);

  // ⏱️ ตัวนับเวลาปัจจุบัน อัปเดตทุก 1 วินาที เพื่อให้ตัวนับถอยหลังวิ่งแบบเรียลไทม์
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const tickInterval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(tickInterval);
  }, [isAuthenticated]);

  const handleSaveData = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatusMsg('⏳ กำลังบันทึกข้อมูลลงฐานข้อมูล...');

    try {
      const response = await fetch('/api/update-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          rooms,
          promptpay,
        }),
      });

      const data =
        (await response.json().catch(() => null)) as
          | SaveApiResponse
          | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            `บันทึกข้อมูลไม่สำเร็จ (${response.status})`
        );
      }

      // ดึงข้อมูลจาก Supabase กลับมาตรวจสอบหลังบันทึกทันที
      await fetchInitialData();

      setStatusMsg(
        `✅ ${data.message || 'บันทึกข้อมูลลง Supabase สำเร็จ'}`
      );
    } catch (error) {
      console.error('Save data error:', error);
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);

      window.setTimeout(() => {
        setStatusMsg('');
      }, 5000);
    }
  };

  // 💾 บันทึกค่าตั้งเวลาปิดไฟอัตโนมัติ (แยกจากปุ่มบันทึกข้อมูลห้องหลัก)
  const handleSaveAutoOffHours = async () => {
    if (isSavingHours) {
      return;
    }

    if (!Number.isFinite(autoOffHours) || autoOffHours <= 0) {
      setStatusMsg('❌ จำนวนชั่วโมงต้องมากกว่า 0');
      window.setTimeout(() => setStatusMsg(''), 3000);
      return;
    }

    setIsSavingHours(true);

    try {
      const response = await fetch('/api/auto-off-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ autoOffHours }),
      });

      const data =
        (await response.json().catch(() => null)) as
          | AutoOffSettingsApiResponse
          | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || 'บันทึกค่าตั้งเวลาไม่สำเร็จ'
        );
      }

      setStatusMsg(
        `✅ ตั้งเวลาปิดไฟอัตโนมัติที่ ${autoOffHours} ชั่วโมงเรียบร้อยแล้ว`
      );
    } catch (error) {
      console.error('Save auto-off hours error:', error);
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    } finally {
      setIsSavingHours(false);

      window.setTimeout(() => {
        setStatusMsg('');
      }, 4000);
    }
  };

  const handleUpdateRoom = (
    id: string,
    field: keyof RoomData,
    value: string | number
  ) => {
    setRooms((previousRooms) =>
      previousRooms.map((room) =>
        room.id === id
          ? {
              ...room,
              [field]: value,
            }
          : room
      )
    );
  };

  const handleResetDaily = () => {
    const confirmed = window.confirm(
      '⚠️ ต้องการเคลียร์ยอดสรุปรายวันและสถานะห้องทั้งหมดหรือไม่?'
    );

    if (!confirmed) {
      return;
    }

    const resetRooms = rooms.map((room) => ({
      ...room,
      usageCount: 0,
      status: 'ว่าง' as RoomStatus,
      lastCheckIn: null,
      lastCheckOut: null,
      expireAt: null,
    }));

    setRooms(resetRooms);

    resetRooms.forEach((room) => {
      void fetch('/api/get-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          roomNumber: room.name,
          status: 'available',
        }),
      });
    });

    setStatusMsg('🔄 รีเซ็ตข้อมูลรายวันเรียบร้อยแล้ว');

    window.setTimeout(() => {
      setStatusMsg('');
    }, 3000);
  };

  const handleControl = async (
    room: RoomData,
    action: 'turn-on' | 'turn-off'
  ) => {
    if (!room.deviceId.trim()) {
      alert(
        `⚠️ กรุณาใส่ Device ID ของห้อง ${room.name} และกดบันทึกก่อน`
      );
      return;
    }

    setIsLoading(true);
    setStatusMsg(
      `⏳ กำลังส่งคำสั่งไปยังห้อง ${room.name}...`
    );

    try {
      const response = await fetch('/api/sonoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          roomNumber: room.name,
          deviceId: room.deviceId.trim(),
          action,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'ส่งคำสั่งไปยังอุปกรณ์ไม่สำเร็จ'
        );
      }

      const now = new Date().toLocaleString('th-TH');
      const newStatus: RoomStatus =
        action === 'turn-on' ? 'ใช้งานอยู่' : 'ว่าง';
      const databaseStatus =
        action === 'turn-on' ? 'occupied' : 'available';

      const statusResponse = await fetch('/api/get-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          roomNumber: room.name,
          status: databaseStatus,
        }),
      });

      if (!statusResponse.ok) {
        console.error(
          'บันทึกสถานะห้องไม่สำเร็จ:',
          statusResponse.status
        );
      }

      // ดึงสถานะล่าสุด (รวม expire_time ที่ /api/sonoff เพิ่งบันทึกไป) กลับมาแสดงทันที
      await fetchRoomStatusOnly();

      setRooms((previousRooms) =>
        previousRooms.map((item) => {
          if (item.id !== room.id) {
            return item;
          }

          if (action === 'turn-on') {
            return {
              ...item,
              status: newStatus,
              lastCheckIn: now,
              usageCount: item.usageCount + 1,
            };
          }

          return {
            ...item,
            status: newStatus,
            lastCheckOut: now,
            expireAt: null,
          };
        })
      );

      setStatusMsg(
        `✅ สำเร็จ: ไฟห้อง ${room.name} ถูก${
          action === 'turn-on' ? 'เปิด' : 'ปิด'
        }แล้ว`
      );
    } catch (error) {
      console.error('Control room error:', error);
      setStatusMsg(`❌ ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getBaseUrl = () =>
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://hotel-system01.vercel.app';

  const totalIncome = rooms.reduce(
    (sum, room) => sum + room.usageCount * room.price,
    0
  );

  const totalCheckIns = rooms.reduce(
    (sum, room) => sum + room.usageCount,
    0
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center px-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border-4 border-yellow-400 text-center">
          <h1 className="text-2xl font-black text-blue-900 mb-2">
            🏨 สิงห์บุรีแกรนด์บางระจัน
          </h1>

          <p className="text-gray-500 mb-6 font-semibold">
            กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบจัดการ
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) =>
                setPasswordInput(e.target.value)
              }
              placeholder="🔑 กรอกรหัสผ่านผู้ดูแลระบบ"
              className="w-full p-3 border-2 border-blue-400 rounded-xl mb-4 text-center font-bold text-xl text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-600"
              autoFocus
            />

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-lg shadow-lg transition"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12 font-sans">
      <div className="bg-blue-900 text-white py-6 px-4 shadow-lg border-b-4 border-yellow-500 sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-yellow-400">
            🏨 สิงห์บุรีแกรนด์บางระจัน
          </h1>

          <p className="text-sm opacity-90">
            ระบบจัดการหลังบ้าน (Admin)
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveData()}
          disabled={isSaving}
          className="mt-4 md:mt-0 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center transition transform hover:scale-105 disabled:hover:scale-100"
        >
          {isSaving
            ? '⏳ กำลังบันทึก...'
            : '💾 บันทึกข้อมูลการตั้งค่า'}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        {statusMsg && (
          <div
            className={`mb-6 p-4 rounded-xl border-2 text-xl font-bold text-center shadow-md transition-all ${
              statusMsg.includes('✅') ||
              statusMsg.includes('💾')
                ? 'bg-green-100 border-green-400 text-green-800'
                : statusMsg.includes('⏳') ||
                    statusMsg.includes('🔄')
                  ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                  : 'bg-red-100 border-red-400 text-red-800'
            }`}
          >
            {statusMsg}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex space-x-8">
            <div>
              <p className="text-gray-500 font-bold">
                💰 คาดการณ์รายได้วันนี้
              </p>

              <p className="text-4xl font-black text-green-600">
                {totalIncome.toLocaleString()} บาท
              </p>
            </div>

            <div>
              <p className="text-gray-500 font-bold">
                🛏️ จำนวนการเปิดห้อง
              </p>

              <p className="text-4xl font-black text-blue-600">
                {totalCheckIns} ครั้ง
              </p>
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

            {/* ⏱️ ช่องตั้งค่าจำนวนชั่วโมงก่อนปิดไฟอัตโนมัติ */}
            <div className="flex items-center space-x-2 mb-2 bg-orange-50 border-2 border-orange-300 rounded-lg px-3 py-2">
              <span className="font-bold text-orange-700 text-sm whitespace-nowrap">
                ⏱️ ปิดไฟอัตโนมัติหลัง (ชม.):
              </span>

              <input
                type="number"
                min="0.5"
                step="0.5"
                value={autoOffHours}
                onChange={(e) =>
                  setAutoOffHours(Number(e.target.value))
                }
                className="w-16 p-1 border border-gray-300 rounded font-bold text-orange-700 text-center bg-white"
              />

              <button
                type="button"
                onClick={() => void handleSaveAutoOffHours()}
                disabled={isSavingHours}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 py-1 rounded font-bold text-xs whitespace-nowrap"
              >
                {isSavingHours ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetDaily}
              className="text-red-500 hover:text-red-700 font-bold text-sm underline"
            >
              🔄 รีเซ็ตยอดรายวัน (เริ่มวันใหม่)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-2xl shadow-md overflow-hidden border-2 border-gray-200"
            >
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-2 w-1/2">
                  <span className="font-bold text-gray-500">
                    ห้อง:
                  </span>

                  <input
                    type="text"
                    value={room.name}
                    onChange={(e) =>
                      handleUpdateRoom(
                        room.id,
                        'name',
                        e.target.value
                      )
                    }
                    className="text-2xl font-black text-blue-900 bg-white border border-gray-300 rounded px-2 w-full focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="font-bold text-gray-500">
                    ราคา:
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={room.price}
                    onChange={(e) =>
                      handleUpdateRoom(
                        room.id,
                        'price',
                        Number(e.target.value)
                      )
                    }
                    className="w-20 p-1 border border-gray-300 rounded font-bold text-blue-700 text-center bg-white"
                  />

                  <span className="font-bold text-gray-500">
                    ฿
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div
                  className={`text-center py-2 mb-2 rounded-lg font-bold text-lg transition-colors duration-500 ${
                    room.status === 'ว่าง'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  สถานะ:{' '}
                  {room.status === 'ว่าง'
                    ? '🟢 ว่างพร้อมให้บริการ'
                    : '🔴 มีลูกค้า (กำลังใช้งาน)'}
                </div>

                {/* ⏱️ ตัวนับถอยหลังก่อนปิดไฟอัตโนมัติ (แสดงเฉพาะห้องที่มีลูกค้าและมีเวลาหมดอายุ) */}
                {room.status === 'ใช้งานอยู่' && room.expireAt && (
                  <div className="text-center py-2 mb-4 rounded-lg font-bold text-base bg-orange-50 border border-orange-300 text-orange-700">
                    ⏱️ ปิดไฟอัตโนมัติในอีก:{' '}
                    {formatCountdown(room.expireAt, nowTick)}
                  </div>
                )}

                <div className="mb-4 text-sm text-gray-600 flex justify-between">
                  <span>
                    เข้า: {room.lastCheckIn || '-'}
                  </span>

                  <span>
                    ออก: {room.lastCheckOut || '-'}
                  </span>
                </div>

                <div className="mb-4">
                  <input
                    type="text"
                    value={room.deviceId}
                    onChange={(e) =>
                      handleUpdateRoom(
                        room.id,
                        'deviceId',
                        e.target.value
                      )
                    }
                    className="w-full p-2 border-2 border-gray-300 rounded text-base font-semibold text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="🔧 ใส่ Device ID ของ Tuya ที่นี่..."
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-xl mb-4 flex justify-around">
                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-red-600 text-xs mb-1">
                      1. สแกนจ่ายเงิน ({room.price} ฿)
                    </p>

                    {promptpay ? (
                      <img
                        src={`https://promptpay.io/${encodeURIComponent(
                          promptpay
                        )}/${room.price}.png`}
                        alt={`คิวอาร์โค้ดชำระเงินห้อง ${room.name}`}
                        className="w-24 h-24 mx-auto"
                      />
                    ) : (
                      <div className="w-24 h-24 mx-auto bg-gray-100 border text-xs flex items-center justify-center text-gray-500">
                        ใส่พร้อมเพย์ก่อน
                      </div>
                    )}
                  </div>

                  <div className="text-center bg-white p-2 rounded shadow-sm w-[45%]">
                    <p className="font-bold text-green-600 text-xs mb-1">
                      2. ส่งสลิป (ห้อง {room.name})
                    </p>

                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `${getBaseUrl()}/?room=${room.name}`
                      )}`}
                      alt={`คิวอาร์โค้ดส่งสลิปห้อง ${room.name}`}
                      className="w-24 h-24 mx-auto"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() =>
                      void handleControl(room, 'turn-on')
                    }
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-xl shadow"
                  >
                    เปิดไฟ
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleControl(room, 'turn-off')
                    }
                    disabled={isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-xl shadow"
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
