"use client";
import { useState } from "react";

export default function AdminDashboard() {
  const [promptPay, setPromptPay] = useState("");
  const [rooms, setRooms] = useState([
    { number: "101", price: 250, isLightOn: false, timeLeft: 0 },
    { number: "102", price: 250, isLightOn: false, timeLeft: 0 },
  ]);
  const [newRoom, setNewRoom] = useState("");
  const [newPrice, setNewPrice] = useState(250);

  // ฟังก์ชันเพิ่มห้อง
  const handleAddRoom = () => {
    if (newRoom.trim() !== "") {
      setRooms([...rooms, { number: newRoom, price: newPrice, isLightOn: false, timeLeft: 0 }]);
      setNewRoom("");
    }
  };

  // ฟังก์ชันลบห้อง
  const handleDelete = (indexToDelete: number) => {
    setRooms(rooms.filter((_, index) => index !== indexToDelete));
  };

  // 🔴 ฟังก์ชันจำลอง: แอดมินกดปุ่มเปิด-ปิดไฟแบบแมนนวล (เดี๋ยวเราจะเอา API ปลั๊กไฟมาใส่ตรงนี้)
  const toggleLight = (index: number) => {
    const updatedRooms = [...rooms];
    updatedRooms[index].isLightOn = !updatedRooms[index].isLightOn;
    // ถ้าสั่งปิดไฟ ให้รีเซ็ตเวลาเป็น 0 ด้วย
    if (!updatedRooms[index].isLightOn) {
      updatedRooms[index].timeLeft = 0;
    }
    setRooms(updatedRooms);
    
    // อนาคต: ใส่โค้ด fetch('https://api.tuya.com/...', { method: 'POST', ... }) ตรงนี้
    alert(`สั่งการปลั๊กไฟ: ${updatedRooms[index].isLightOn ? 'เปิดไฟ (ON)' : 'ปิดไฟ (OFF)'} ห้อง ${updatedRooms[index].number}`);
  };

  // 🟢 ฟังก์ชันจำลอง: เมื่อมีการจ่ายเงิน (หรือแอดมินกดเปิดให้ 2 ชม.)
  const startTwoHours = (index: number) => {
    const updatedRooms = [...rooms];
    updatedRooms[index].isLightOn = true;
    updatedRooms[index].timeLeft = 120; // 120 นาที (2 ชั่วโมง)
    setRooms(updatedRooms);
    alert(`ห้อง ${updatedRooms[index].number} เริ่มทำงาน 2 ชั่วโมง และเปิดไฟแล้ว`);
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      
      {/* หน้าจอแอดมิน (ซ่อนตอนปริ้น) */}
      <div className="p-8 print:hidden">
        <div className="max-w-5xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">🛠️ ระบบจัดการห้องพัก (Admin Control Panel)</h1>

          <div className="mb-8 p-6 border-2 border-blue-100 rounded-xl bg-blue-50/50">
            <label className="block font-bold text-gray-700 mb-2">1. ตั้งค่าเบอร์พร้อมเพย์รับเงิน:</label>
            <input
              type="text"
              value={promptPay}
              onChange={(e) => setPromptPay(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg outline-none"
              placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน"
            />
          </div>

          <div className="mb-8 p-6 border-2 border-green-100 rounded-xl bg-green-50/50">
            <label className="block font-bold text-gray-700 mb-2">2. เพิ่มห้องพักใหม่:</label>
            <div className="flex gap-4">
              <input type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="เลขห้อง" className="flex-1 p-3 border border-gray-300 rounded-lg text-lg" />
              <input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} placeholder="ราคา" className="w-32 p-3 border border-gray-300 rounded-lg text-lg" />
              <button onClick={handleAddRoom} className="bg-green-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-green-700">+ เพิ่มห้อง</button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
              <label className="block font-bold text-gray-700 text-xl">3. แผงควบคุมและรายการห้องพัก:</label>
              <button onClick={() => window.print()} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-lg shadow-md">🖨️ ปริ้น QR Code</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {rooms.map((room, index) => (
                <div key={index} className="border-2 border-gray-200 p-5 rounded-xl bg-white shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-bold text-3xl text-gray-800">ห้อง {room.number}</p>
                      <p className="text-gray-500 font-medium mt-1">ราคา: {room.price} บาท</p>
                    </div>
                    {/* ไฟสถานะ */}
                    <div className={`px-4 py-2 rounded-full font-bold text-sm border-2 ${room.isLightOn ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                      {room.isLightOn ? '💡 ไฟเปิดอยู่' : 'ปิดไฟ'}
                    </div>
                  </div>
                  
                  {/* แผงควบคุม (Control Panel) */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 font-bold mb-3">แผงควบคุม (Manual Control)</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleLight(index)}
                        className={`flex-1 py-2 rounded-lg font-bold text-white transition ${room.isLightOn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                      >
                        {room.isLightOn ? '🔴 สั่งปิดไฟ' : '🟢 สั่งเปิดไฟ'}
                      </button>
                      <button 
                        onClick={() => startTwoHours(index)}
                        className="flex-1 py-2 rounded-lg font-bold bg-blue-500 text-white hover:bg-blue-600"
                      >
                        ⏱️ จำลองเปิด 2 ชม.
                      </button>
                    </div>
                    <div className="mt-3 flex justify-between items-center text-sm font-semibold">
                      <span className="text-gray-600">เวลาที่เหลือ: {room.timeLeft > 0 ? `${room.timeLeft} นาที` : '-'}</span>
                      <button onClick={() => handleDelete(index)} className="text-red-400 hover:text-red-600">ลบห้อง</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* หน้าสำหรับปริ้น QR Code (เหมือนเดิม) */}
      <div className="hidden print:block print:bg-white print:p-0">
        {rooms.map((room, index) => (
          <div key={index} style={{ pageBreakAfter: 'always' }} className="flex flex-col items-center justify-center h-screen text-center p-10">
            <div className="border-8 border-gray-900 rounded-3xl p-16 w-full max-w-2xl">
              <h1 className="text-8xl font-black text-gray-900 mb-6">ห้อง {room.number}</h1>
              <div className="bg-gray-900 text-white py-4 px-8 rounded-full inline-block mb-12">
                <p className="text-3xl font-bold">สแกนเพื่อเปิดห้องพัก (2 ชั่วโมง)</p>
              </div>
              
              {promptPay ? (
                <img src={`https://promptpay.io/${promptPay}/${room.price}.png`} alt={`QR Code ห้อง ${room.number}`} className="w-96 h-96 mx-auto mb-10 object-contain" />
              ) : (
                <div className="w-96 h-96 mx-auto mb-10 border-4 border-dashed flex items-center justify-center text-gray-400 text-2xl">กรุณาตั้งค่าเบอร์พร้อมเพย์ก่อนปริ้น</div>
              )}

              <p className="text-5xl font-extrabold text-blue-600 mb-4">{room.price} บาท</p>
              <p className="text-2xl text-gray-600 font-semibold mt-4">PromptPay: {promptPay}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
