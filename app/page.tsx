"use client";
import { useState } from "react";

export default function AdminDashboard() {
  const [promptPay, setPromptPay] = useState("");
  const [rooms, setRooms] = useState([
    { number: "101", price: 250, isLightOn: false, timeLeft: 0, deviceId: "ใส่รหัสDeviceIDที่นี่" },
  ]);
  
  const [newRoom, setNewRoom] = useState("");
  const [newPrice, setNewPrice] = useState(250);
  const [newDeviceId, setNewDeviceId] = useState("");

  const handleAddRoom = () => {
    if (newRoom.trim() !== "" && newDeviceId.trim() !== "") {
      setRooms([...rooms, { number: newRoom, price: newPrice, isLightOn: false, timeLeft: 0, deviceId: newDeviceId }]);
      setNewRoom("");
      setNewDeviceId("");
    }
  };

  const handleDelete = (indexToDelete: number) => {
    setRooms(rooms.filter((_, index) => index !== indexToDelete));
  };

  const toggleLight = async (index: number) => {
    const updatedRooms = [...rooms];
    const newState = !updatedRooms[index].isLightOn; 
    
    updatedRooms[index].isLightOn = newState;
    if (!newState) updatedRooms[index].timeLeft = 0;
    setRooms(updatedRooms);
    
    try {
      const response = await fetch('/api/sonoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: updatedRooms[index].deviceId,
          action: newState ? 'on' : 'off'
        })
      });
      const data = await response.json();
      if (!data.success) {
        alert("สั่งการปลั๊กไฟไม่สำเร็จ: " + data.error);
      }
    } catch (error) {
      alert("ไม่สามารถเชื่อมต่อระบบไฟได้");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="p-8 print:hidden">
        <div className="max-w-5xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">🛠️ ระบบจัดการห้องพัก</h1>

          <div className="mb-8 p-6 border-2 border-green-100 rounded-xl bg-green-50/50">
            <label className="block font-bold text-gray-700 mb-2">เพิ่มห้องพักใหม่ (เชื่อมต่อ Sonoff):</label>
            <div className="flex flex-wrap md:flex-nowrap gap-4">
              <input 
                type="text" 
                value={newRoom} 
                onChange={(e) => setNewRoom(e.target.value)} 
                placeholder="เลขห้อง" 
                className="w-24 p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500" 
              />
              <input 
                type="number" 
                value={newPrice} 
                onChange={(e) => setNewPrice(Number(e.target.value))} 
                placeholder="ราคา" 
                className="w-24 p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500" 
              />
              <input 
                type="text" 
                value={newDeviceId} 
                onChange={(e) => setNewDeviceId(e.target.value)} 
                placeholder="Device ID (จากแอป eWeLink)" 
                className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500" 
              />
              <button 
                onClick={handleAddRoom} 
                className="bg-green-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-green-700 whitespace-nowrap"
              >
                + เพิ่มห้อง
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 text-xl mb-4">แผงควบคุมและรายการห้องพัก:</label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {rooms.map((room, index) => (
                <div key={index} className="border-2 border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-bold text-3xl text-gray-800">ห้อง {room.number}</p>
                      <p className="text-gray-500 font-medium text-xs mt-1">Device ID: {room.deviceId}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold text-sm border-2 ${room.isLightOn ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                      {room.isLightOn ? '💡 ไฟเปิดอยู่' : 'ปิดไฟ'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <button 
                      onClick={() => toggleLight(index)}
                      className={`w-full py-3 rounded-lg font-bold text-white transition ${room.isLightOn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    >
                      {room.isLightOn ? '🔴 สั่งปิดไฟ (OFF)' : '🟢 สั่งเปิดไฟ (ON)'}
                    </button>
                    <div className="mt-3 text-right">
                      <button onClick={() => handleDelete(index)} className="text-red-400 text-sm hover:text-red-600">ลบห้อง</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
