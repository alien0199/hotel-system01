import { supabase } from '../../../lib/supabase'

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  // อ่านเลขห้องจาก URL
  const { id } = await params;

  // ดึงข้อมูลสถานะห้องจาก Supabase
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_number', id)
    .single();

  // ถ้าหาห้องไม่เจอ
  if (error || !room) {
    return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold text-xl">ไม่พบข้อมูลห้องพักนี้</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ห้อง {room.room_number}</h1>
        
        {/* เช็คสถานะห้องจากฐานข้อมูล */}
        {room.status === 'available' ? (
          <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full font-semibold mb-6 inline-block">
            🟢 สถานะ: ว่าง
          </div>
        ) : (
          <div className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full font-semibold mb-6 inline-block">
            🔴 สถานะ: มีผู้ใช้งาน
          </div>
        )}
        
        <div className="space-y-4">
          <div className="border-t border-b border-gray-100 py-6 mb-4">
            <p className="text-gray-500 mb-1">ราคาเข้าพัก (2 ชั่วโมง)</p>
            <p className="text-5xl font-extrabold text-blue-600">250 ฿</p>
          </div>
          
          {/* ซ่อนปุ่มจ่ายเงินถ้าห้องไม่ว่าง */}
          {room.status === 'available' ? (
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl transition duration-200 text-lg shadow-md">
              สแกนจ่ายเงินเพื่อเปิดห้อง
            </button>
          ) : (
            <button disabled className="w-full bg-gray-400 text-white font-bold py-4 px-4 rounded-xl text-lg shadow-md cursor-not-allowed">
              ห้องไม่ว่าง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
