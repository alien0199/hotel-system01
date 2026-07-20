export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        
        {/* ชื่อห้อง */}
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ห้อง 101</h1>
        
        {/* ป้ายสถานะ */}
        <div className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full font-semibold mb-6 inline-block">
          🟢 สถานะ: ว่าง
        </div>
        
        <div className="space-y-4">
          {/* ราคา */}
          <div className="border-t border-b border-gray-100 py-6 mb-4">
            <p className="text-gray-500 mb-1">ราคาเข้าพัก (2 ชั่วโมง)</p>
            <p className="text-5xl font-extrabold text-blue-600">250 ฿</p>
          </div>
          
          {/* ปุ่มจ่ายเงิน */}
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl transition duration-200 text-lg shadow-md">
            สแกนจ่ายเงินเพื่อเปิดห้อง
          </button>
        </div>
        
      </div>
    </div>
  );
}