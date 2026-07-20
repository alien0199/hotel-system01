"use client";
import { useState } from "react";

export default function AdminDashboard() {
  // ตั้งค่าเริ่มต้น
  const [promptPay, setPromptPay] = useState("");
  const [rooms, setRooms] = useState([
    { number: "101", price: 250 },
    { number: "102", price: 250 },
  ]);
  
  // ตัวแปรสำหรับฟอร์มเพิ่มห้อง
  const [newRoom, setNewRoom] = useState("");
  const [newPrice, setNewPrice] = useState(250);

  // ฟังก์ชันเพิ่มห้องใหม่
  const handleAddRoom = () => {
    if (newRoom.trim() !== "") {
      setRooms([...rooms, { number: newRoom, price: newPrice }]);
      setNewRoom(""); // เคลียร์ช่องพิมพ์
    }
  };

  // ฟังก์ชันลบห้อง
  const handleDelete = (indexToDelete: number) => {
    setRooms(rooms.filter((_, index) => index !== indexToDelete));
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      
      {/* 🟢 ส่วนที่ 1: หน้าจอแอดมิน (จะถูกซ่อนไว้ตอนกดปริ้นกระดาษ) */}
      <div className="p-8 print:hidden">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">🛠️ ระบบจัดการห้องพัก (Admin)</h1>

          {/* ตั้งค่าพร้อมเพย์ */}
          <div className="mb-8 p-6 border-2 border-blue-100 rounded-xl bg-blue-50/50">
            <label className="block font-bold text-gray-700 mb-2">1. ตั้งค่าเบอร์พร้อมเพย์รับเงิน:</label>
            <input
              type="text"
              value={promptPay}
              onChange={(e) => setPromptPay(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="ใส่เบอร์มือถือ หรือ เลขบัตรประชาชน"
            />
          </div>

          {/* เพิ่มห้องพัก */}
          <div className="mb-8 p-6 border-2 border-green-100 rounded-xl bg-green-50/50">
            <label className="block font-bold text-gray-700 mb-2">2. เพิ่มห้องพักใหม่:</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                placeholder="ชื่อ/เลขห้อง (เช่น 103)"
                className="flex-1 p-3 border border-gray-300 rounded-lg text-lg outline-none"
              />
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                placeholder="ราคา"
                className="w-32 p-3 border border-gray-300 rounded-lg text-lg outline-none"
              />
              <button
                onClick={handleAddRoom}
                className="bg-green-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-green-700 transition"
              >
                + เพิ่มห้อง
              </button>
            </div>
          </div>

          {/* รายการห้องพักและปุ่มปริ้น */}
          <div>
            <div className="flex justify-between items-end mb-4">
              <label className="block font-bold text-gray-700 text-xl">3. รายการห้องพักทั้งหมด:</label>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700 transition shadow-md flex items-center gap-2"
              >
                🖨️ สั่งปริ้น QR Code ทุกห้อง
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room, index) => (
                <div key={index} className="border border-gray-200 p-5 rounded-xl flex justify-between items-center bg-gray-50 hover:bg-gray-100">
                  <div>
                    <p className="font-bold text-2xl text-gray-800">ห้อง {room.number}</p>
                    <p className="text-gray-600 font-medium mt-1">ราคา: {room.price} บาท</p>
                  </div>
                  <button
                    onClick={() => handleDelete(index)}
                    className="text-red-500 font-semibold hover:text-red-700 bg-red-50 px-3 py-1 rounded-lg"
                  >
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 🟢 ส่วนที่ 2: หน้ากระดาษสำหรับปริ้น (ปกติจะมองไม่เห็น จะโผล่มาแค่ตอนสั่งปริ้น) */}
      <div className="hidden print:block print:bg-white print:p-0">
        {rooms.map((room, index) => (
          <div 
            key={index} 
            style={{ pageBreakAfter: 'always' }} 
            className="flex flex-col items-center justify-center h-screen text-center p-10"
          >
            <div className="border-8 border-gray-900 rounded-3xl p-16 w-full max-w-2xl">
              <h1 className="text-8xl font-black text-gray-900 mb-6">ห้อง {room.number}</h1>
              <div className="bg-gray-900 text-white py-4 px-8 rounded-full inline-block mb-12">
                <p className="text-3xl font-bold">สแกนเพื่อเปิดห้องพัก (2 ชั่วโมง)</p>
              </div>
              
              {/* ดึง API สร้าง QR Code ของพร้อมเพย์มาแสดงอัตโนมัติ */}
              {promptPay ? (
                <img
                  src={`https://promptpay.io/${promptPay}/${room.price}.png`}
                  alt={`QR Code ห้อง ${room.number}`}
                  className="w-96 h-96 mx-auto mb-10 object-contain"
                />
              ) : (
                <div className="w-96 h-96 mx-auto mb-10 border-4 border-dashed flex items-center justify-center text-gray-400 text-2xl">
                  กรุณาตั้งค่าเบอร์พร้อมเพย์ก่อนปริ้น
                </div>
              )}

              <p className="text-5xl font-extrabold text-blue-600 mb-4">{room.price} บาท</p>
              <p className="text-2xl text-gray-600 font-semibold mt-4">PromptPay: {promptPay || "ยังไม่ได้ตั้งค่า"}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
