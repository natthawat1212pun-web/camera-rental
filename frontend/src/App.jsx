import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import './App.css'; 

// --- Config IP Address ---
const API_URL = 'http://192.168.1.103:3000'; 

// --- 🎨 ชุดสีสำหรับแยกประเภทกล้อง (แก้ไขใหม่: เอาสีเทาออก) ---
const cameraColors = [
  '#e74c3c', // แดง
  '#e67e22', // ส้ม
  '#f1c40f', // เหลือง
  '#2ecc71', // เขียวอ่อน
  '#16a085', // เขียวเข้ม
  '#3498db', // ฟ้า
  '#2980b9', // น้ำเงิน
  '#9b59b6', // ม่วงอ่อน
  '#8e44ad', // ม่วงเข้ม
  '#d35400', // ส้มอิฐ
  '#c0392b', // แดงเลือดหมู
  '#1abc9c', // เขียวมินต์
  '#e91e63', // ชมพูบานเย็น
  '#3f51b5', // น้ำเงินคราม
  '#00bcd4', // ฟ้าสว่าง
  '#ff9800', // ส้มสว่าง
];

const getCameraColor = (id) => {
  if (!id) return '#3b82f6'; 
  const index = id % cameraColors.length;
  return cameraColors[index];
};

const PROMOTIONS = [
  { id: 'none', label: '🚫 ไม่ใช้ส่วนลด', type: 'none', value: 0 },
  { id: 'ig_tag', label: '📸 โพสต์ IG/Story (ลด 10%)', type: 'percent', value: 10 },
  { id: 'review', label: '✨ ส่งรูปรีวิว (ลด 5%)', type: 'percent', value: 5 },
  { id: 'birthday', label: '🎂 โปรเดือนเกิด (ลด 10%)', type: 'percent', value: 10 },
  { id: 'follow', label: '✅ กดติดตามร้าน (ลด 10 บาท)', type: 'amount', value: 10 }
];

function App() {
  const [events, setEvents] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [editingId, setEditingId] = useState(null);
  
  // State: Search & Modal
  const [searchDates, setSearchDates] = useState({ start: '', end: '' });
  const [availableCameras, setAvailableCameras] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State: Modal
  const [activeModal, setActiveModal] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewMonth, setViewMonth] = useState(new Date()); // ✨ สำหรับตารางรายเดือน

  // State: Promotion & Status
  const [selectedPromo, setSelectedPromo] = useState('none');
  const [currentBookingStatus, setCurrentBookingStatus] = useState('booked'); // ✨ เก็บสถานะ

  const [formData, setFormData] = useState({
    itemId: '', customerName: '', start: '', end: '', totalPrice: 0
  });

  // --- Formatters ---
  const formatDateForInput = (dateInput) => {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if(isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        return (new Date(date - offset)).toISOString().slice(0, 16);
    } catch(e) { return ''; }
  };

  const formatTime = (dateString) => {
    if(!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  
  const formatDateShort = (dateString) => {
    if(!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };
  
  const formatDateFull = (dateString) => {
    if(!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatMonth = (dateString) => {
    if(!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  };

  const formatDateTimeChat = (dateString) => {
    if(!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + 
           date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // --- Initial Load ---
  useEffect(() => { fetchCameras(); fetchEvents(); }, []);
  useEffect(() => { calculateTotal(); }, [formData.start, formData.end, selectedPromo]); 

  const fetchCameras = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cameras`);
      const data = await res.json();
      if (Array.isArray(data)) {
          setCameras(data);
          if (data.length > 0 && !editingId && !formData.itemId) {
             const firstAvailable = data.find(c => c.status === 'available');
             if (firstAvailable) setFormData(prev => ({ ...prev, itemId: firstAvailable.id }));
          }
      }
    } catch (err) { console.error(err); }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/bookings`);
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const formatted = data.map(b => ({
        id: b.id,
        title: `${b.customerName} (${b.cameraName}) ${b.status === 'returned' ? '✅' : ''}`,
        start: b.start,
        end: b.end,
        color: b.status === 'returned' ? '#7f8c8d' : getCameraColor(b.itemId), 
        extendedProps: { 
            ...b,
            totalPrice: Number(b.totalPrice || 0) // 🔴 แก้ปัญหาตัวเลขยาวๆ ตรงนี้
        }
      }));
      setEvents(formatted);
    } catch (err) { console.error(err); }
  };

  // --- ✨ Functions ใหม่ ---

  // เปลี่ยนสถานะกล้อง (ส่งซ่อม)
  const toggleCameraStatus = async (cam) => {
      const newStatus = cam.status === 'available' ? 'maintenance' : 'available';
      try {
          const res = await fetch(`${API_URL}/api/cameras/${cam.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
              setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, status: newStatus } : c));
          } else {
              alert("บันทึกสถานะไม่สำเร็จ (กรุณาเช็ค Server)");
          }
      } catch (err) { alert("Server Error"); }
  };

  // กดคืนของแล้ว (จบงาน)
  const handleFinishBooking = async () => {
      try {
          const res = await fetch(`${API_URL}/api/bookings/${editingId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'returned' })
          });
          if (res.ok) {
              alert("✅ บันทึกคืนของเรียบร้อย");
              fetchEvents();
              handleCancel();
          }
      } catch (err) { console.error(err); }
  };

  // สร้างตารางรายเดือน
  const generateMonthlyGrid = () => {
      const year = viewMonth.getFullYear();
      const month = viewMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      return cameras.map(cam => {
          const daysStatus = daysArray.map(day => {
              const currentDay = new Date(year, month, day, 12, 0, 0); 
              if (cam.status === 'maintenance') return { day, status: 'maintenance' };
              const booking = events.find(e => {
                  if (e.extendedProps.itemId !== cam.id) return false;
                  const start = new Date(e.start); start.setHours(0,0,0,0);
                  const end = new Date(e.end); end.setHours(23,59,59,999);
                  return currentDay >= start && currentDay <= end;
              });
              let status = 'free';
              if (booking) status = booking.extendedProps.status === 'returned' ? 'returned' : 'booked';
              return { day, booking, status };
          });
          return { ...cam, daysStatus };
      });
  };
  const handleMonthChange = (dir) => { const d = new Date(viewMonth); d.setMonth(d.getMonth() + dir); setViewMonth(d); };

  // ตารางรายวัน
  const getDailySchedule = (targetDateStr) => {
      const targetDate = new Date(targetDateStr);
      const dayStart = new Date(targetDate); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(targetDate); dayEnd.setHours(23,59,59,999);
      return cameras.map(cam => {
          if (cam.status === 'maintenance') return { ...cam, status: '⛔ ส่งซ่อมอยู่', colorClass: '#e74c3c' }; 
          const bookings = events.filter(e => {
              if (e.extendedProps.itemId !== cam.id) return false;
              const eStart = new Date(e.start); const eEnd = new Date(e.end);
              return eStart < dayEnd && eEnd > dayStart;
          }).sort((a,b) => new Date(a.start) - new Date(b.start));
          let status = ''; let colorClass = ''; 
          if (bookings.length === 0) { status = '✅ ว่างทั้งวัน'; colorClass = '#10b981'; } 
          else {
              const isFullDay = bookings.some(b => new Date(b.start) <= dayStart && new Date(b.end) >= dayEnd);
              if (isFullDay) { status = '❌ ไม่ว่าง (เต็ม)'; colorClass = '#e74c3c'; } 
              else { status = '⚠️ ว่างบางช่วง'; colorClass = '#f1c40f'; }
          }
          return { ...cam, status, colorClass, bookings };
      });
  };

  const handleCopySummary = () => {
      if (!formData.customerName || !formData.start || !formData.end) {
          alert("กรุณากรอกข้อมูลให้ครบก่อนกด Copy ครับ");
          return;
      }
      const camera = cameras.find(c => c.id == formData.itemId); 
      const cameraName = camera ? camera.name : 'ไม่ระบุรุ่น';
      const promoObj = PROMOTIONS.find(p => p.id === selectedPromo);
      const promoText = selectedPromo !== 'none' ? `\n🏷️ โปร: ${promoObj.label}` : '';

      const summaryText = `✅ สรุปรายการจอง\n` +
          `👤 คุณ: ${formData.customerName}\n` +
          `📸 รุ่น: ${cameraName}\n` +
          `📤 รับ: ${formatDateTimeChat(formData.start)}\n` +
          `📥 คืน: ${formatDateTimeChat(formData.end)}` +
          promoText + `\n` +
          `💸 ยอดสุทธิ: ${formData.totalPrice.toLocaleString()} บาท\n` +
          `-------------------------\n` +
          `🏦 ธนาคารกสิกรไทย\n` +
          `เลขที่: 123-4-56789-0\n` +
          `ชื่อ: ณัฐวัตร คำโชติ`;

      navigator.clipboard.writeText(summaryText)
          .then(() => alert("คัดลอกสรุปรายการเรียบร้อย!"))
          .catch(err => console.error("Copy failed", err));
  };

  const handleDateClick = (arg) => { setSelectedDate(arg.dateStr); setActiveModal('date_menu'); };
  const getEventsByDate = (dateStr, type) => {
      if (!dateStr) return [];
      const startOfDay = new Date(dateStr); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(dateStr); endOfDay.setHours(23,59,59,999);
      return events.filter(e => {
          const t = new Date(type === 'start' ? e.start : e.end);
          return t >= startOfDay && t <= endOfDay;
      }).sort((a,b) => new Date(a.start) - new Date(b.start));
  };

  const handleSearchAvailability = async () => {
    if (!searchDates.start || !searchDates.end) { alert("กรุณาระบุวันรับและวันคืนเพื่อค้นหา"); return; }
    const s = new Date(searchDates.start).toISOString();
    const e = new Date(searchDates.end).toISOString();
    try {
        const res = await fetch(`${API_URL}/api/available?start=${s}&end=${e}`);
        const data = await res.json();
        setAvailableCameras(data);
    } catch (err) { alert("เกิดข้อผิดพลาดในการค้นหา"); }
  };

  const selectCameraFromSearch = (cam) => {
      setFormData({ ...formData, itemId: cam.id, start: searchDates.start, end: searchDates.end });
      const formElement = document.querySelector('.main-content');
      if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredBookings = events.filter(e => {
    if (!searchTerm) return false;
    return e.extendedProps.customerName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const calculateTotal = () => {
    if (!formData.start || !formData.end) return;
    const diffTime = new Date(formData.end) - new Date(formData.start);
    if (diffTime <= 0) { setFormData(prev => ({ ...prev, totalPrice: 0 })); return; }
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    let basePrice = 0;
    if (diffDays <= 1) basePrice = 160;       
    else if (diffDays === 2) basePrice = 320; 
    else if (diffDays === 3) basePrice = 400; 
    else if (diffDays > 3) basePrice = 400 + ((diffDays - 3) * 100); 

    const promo = PROMOTIONS.find(p => p.id === selectedPromo);
    let finalPrice = basePrice;
    if (promo.type === 'percent') { const discountAmount = Math.ceil((basePrice * promo.value) / 100); finalPrice = basePrice - discountAmount; } 
    else if (promo.type === 'amount') finalPrice = basePrice - promo.value;
    if (finalPrice < 0) finalPrice = 0;

    setFormData(prev => ({ ...prev, totalPrice: finalPrice }));
  };

  const handleEventClick = (info) => {
    const props = info.event.extendedProps;
    setEditingId(info.event.id);
    setFormData({
      itemId: props.itemId,
      customerName: props.customerName,
      start: formatDateForInput(props.start),
      end: formatDateForInput(props.end),
      totalPrice: Number(props.totalPrice || 0)
    });
    setCurrentBookingStatus(props.status || 'booked');
    setSelectedPromo('none'); 
    setSearchTerm(''); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveModal(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(prev => ({ ...prev, customerName: '', start: '', end: '', totalPrice: 0 }));
    setSelectedPromo('none');
    setCurrentBookingStatus('booked');
  };

  const handleDelete = async () => {
    if (!window.confirm("⚠️ การลบจะทำให้ยอดเงินหายไป (ใช้สำหรับกรณียกเลิก/จองผิด)\nหากคืนของแล้ว ให้กด '✅ คืนของแล้ว' แทน\n\nยืนยันที่จะลบ?")) return;
    try {
      const res = await fetch(`${API_URL}/api/bookings/${editingId}`, { method: 'DELETE' });
      if (res.ok) { alert("ลบเรียบร้อย"); fetchEvents(); handleCancel(); }
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/api/bookings/${editingId}` : `${API_URL}/api/bookings`;
    const method = editingId ? 'PUT' : 'POST';
    const payload = { ...formData, start: new Date(formData.start).toISOString(), end: new Date(formData.end).toISOString() };
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) alert(result.error || "บันทึกไม่สำเร็จ");
      else { alert(editingId ? "แก้ไขเรียบร้อย!" : "จองสำเร็จ!"); fetchEvents(); handleCancel(); setAvailableCameras(null); }
    } catch (error) { alert("Server Error"); }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const setDuration = (days) => {
    if (!formData.start) { alert("⚠️ กรุณาเลือกวันรับของก่อนครับ"); return; }
    const startDate = new Date(formData.start);
    const endDate = new Date(startDate.getTime() + (days * 24 * 60 * 60 * 1000));
    setFormData(prev => ({ ...prev, end: formatDateForInput(endDate) }));
  };
  const setSearchDuration = (days) => {
    if (!searchDates.start) { alert("⚠️ กรุณาเลือกวันรับของก่อนครับ"); return; }
    const startDate = new Date(searchDates.start);
    const endDate = new Date(startDate.getTime() + (days * 24 * 60 * 60 * 1000));
    setSearchDates(prev => ({ ...prev, end: formatDateForInput(endDate) }));
  };

  const getTodayStart = () => getEventsByDate(new Date(), 'start');
  const getTodayEnd = () => getEventsByDate(new Date(), 'end');

  // 🔴 แก้ไข: บังคับให้เป็น Number() เพื่อไม่ให้ราคาต่อกันเป็นสตริงยาวๆ
  const calculateProfit = () => {
    const totalRevenue = events.reduce((sum, e) => sum + Number(e.extendedProps.totalPrice || 0), 0);
    const monthlyStats = {};
    events.forEach(e => {
        const date = new Date(e.start);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyStats[key]) monthlyStats[key] = { name: formatMonth(e.start), total: 0, count: 0, sortKey: key };
        monthlyStats[key].total += Number(e.extendedProps.totalPrice || 0);
        monthlyStats[key].count += 1;
    });
    return { totalRevenue, monthlyList: Object.values(monthlyStats).sort((a, b) => b.sortKey.localeCompare(a.sortKey)) };
  };

  const startListToday = getTodayStart();
  const endListToday = getTodayEnd();
  const profitStats = calculateProfit();
  const currentPromoLabel = PROMOTIONS.find(p => p.id === selectedPromo)?.label || 'เลือกโปรโมชั่น';
  const dailyScheduleList = activeModal === 'daily_schedule' ? getDailySchedule(dailyDate) : [];
  const monthlyGridData = activeModal === 'monthly_view' ? generateMonthlyGrid() : [];
  const cameraList = cameras; 

  let modalContent = null;
  if (activeModal === 'profit') {
      modalContent = { title: '💰 สรุปรายได้', color: '#10b981', type: 'profit' };
  } else if (activeModal === 'send') {
      modalContent = { title: '📦 ส่งของวันนี้', list: startListToday, color: '#e67e22', emptyMsg: 'วันนี้ไม่มีรายการต้องส่ง', type: 'list' };
  } else if (activeModal === 'return') {
      modalContent = { title: '↩️ รับคืนวันนี้', list: endListToday, color: '#3498db', emptyMsg: 'วันนี้ไม่มีรายการครบกำหนดคืน', type: 'list' };
  } else if (activeModal === 'date_menu') {
      const sends = getEventsByDate(selectedDate, 'start');
      const returns = getEventsByDate(selectedDate, 'end');
      modalContent = { title: `📅 รายการวันที่ ${formatDateFull(selectedDate)}`, color: '#ffd700', type: 'menu', data: { sends, returns } };
  } else if (activeModal === 'send_date') {
      const list = getEventsByDate(selectedDate, 'start');
      modalContent = { title: `📦 ส่งของวันที่ ${formatDateShort(selectedDate)}`, list: list, color: '#e67e22', emptyMsg: 'ไม่มีรายการต้องส่งในวันนี้', type: 'list' };
  } else if (activeModal === 'return_date') {
      const list = getEventsByDate(selectedDate, 'end');
      modalContent = { title: `↩️ รับคืนวันที่ ${formatDateShort(selectedDate)}`, list: list, color: '#3498db', emptyMsg: 'ไม่มีรายการรับคืนในวันนี้', type: 'list' };
  } else if (activeModal === 'promo') {
      modalContent = { title: '🏷️ เลือกโปรโมชั่น / ส่วนลด', color: '#f1c40f', type: 'promo' };
  } else if (activeModal === 'daily_schedule') {
      modalContent = { title: '📅 ตารางว่างรายวัน', color: '#9b59b6', type: 'daily_schedule' };
  } 
  // ✨ เพิ่ม Modal ใหม่: จัดการกล้อง + ตารางเดือน
  else if (activeModal === 'camera_status') {
      modalContent = { title: '🔧 จัดการสถานะกล้อง', color: '#7f8c8d', type: 'camera_status' };
  } else if (activeModal === 'monthly_view') {
      modalContent = { title: '🗓️ ตารางว่างรายเดือน', color: '#3498db', type: 'monthly_view' };
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header-wrapper">
        <h1 className="header-title"><span>📸</span> ระบบจองคิวเช่ากล้อง</h1>
        <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
            {/* ✨ เพิ่มปุ่มใหม่ */}
            <button className="btn" style={{background:'#57606f', color:'white', border:'1px solid #777'}} onClick={() => setActiveModal('camera_status')}>
                🔧 จัดการกล้อง
            </button>
            <button className="btn" style={{background:'#9b59b6', color:'white', boxShadow:'0 4px 10px rgba(155, 89, 182, 0.3)'}} onClick={() => setActiveModal('daily_schedule')}>
                📅 ตารางวัน
            </button>
            <button className="btn" style={{background:'#3498db', color:'white', boxShadow:'0 4px 10px rgba(52, 152, 219, 0.3)'}} onClick={() => setActiveModal('monthly_view')}>
                🗓️ ตารางเดือน
            </button>
            
            <button className="btn" style={{background:'#10b981', color:'white'}} onClick={() => setActiveModal('profit')}>💰 สรุปกำไร</button>
            <button className="btn" style={{background:'#333', color:'white', border:'1px solid #444'}} onClick={() => setActiveModal('send')}>
                📦 ส่งวันนี้ <span className="stat-badge">{startListToday.length}</span>
            </button>
            <button className="btn" style={{background:'#333', color:'white', border:'1px solid #444'}} onClick={() => setActiveModal('return')}>
                ↩️ คืนวันนี้ <span className="stat-badge">{endListToday.length}</span>
            </button>
        </div>
      </div>

      {/* Search Availability */}
      <div className="search-box">
        <div className="search-group">
            <div className="label-row">
                <label>วันที่ต้องการเริ่มเช่า</label>
                <div className="duration-tags">
                    {[1, 2, 3, 5].map(d => <button key={d} type="button" className="tag-btn" onClick={() => setSearchDuration(d)}>+{d} วัน</button>)}
                </div>
            </div>
            <input type="datetime-local" value={searchDates.start} onChange={(e) => setSearchDates({...searchDates, start: e.target.value})} />
        </div>
        <div className="search-group">
            <label style={{marginBottom:'8px'}}>ถึงวันที่</label>
            <input type="datetime-local" value={searchDates.end} onChange={(e) => setSearchDates({...searchDates, end: e.target.value})} />
        </div>
        <button className="btn btn-search" onClick={handleSearchAvailability}>🔍 เช็คคิวว่าง</button>
      </div>

      {/* Available Results */}
      {availableCameras !== null && (
        <div className="card" style={{marginBottom: '30px', borderColor: '#10b981'}}>
            <h4 style={{margin: '0 0 15px 0', color: '#34d399'}}>
                {availableCameras.length === 0 ? '❌ ไม่พบกล้องว่าง' : `✅ พบกล้องว่าง ${availableCameras.length} เครื่อง`}
            </h4>
            {availableCameras.length > 0 && (
                <div className="result-grid">
                    {availableCameras.map(cam => (
                        <div key={cam.id} className="result-item" onClick={() => selectCameraFromSearch(cam)}><strong>{cam.name}</strong></div>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            {/* History */}
            <div className="card" style={{padding:'20px', border:'1px solid #333'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px'}}>
                    <span style={{fontSize:'1.2rem'}}>🔎</span><h3 style={{margin:0, fontSize:'1rem', color:'#aaa'}}>ค้นหาประวัติ</h3>
                </div>
                <input type="text" placeholder="พิมพ์ชื่อลูกค้า..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{background:'#111', height:'45px', border:'1px solid #444'}} />
                {searchTerm && (
                    <div className="history-results">
                        {filteredBookings.length === 0 ? <div style={{padding:'15px', color:'#777', textAlign:'center'}}>ไม่พบข้อมูล</div> : filteredBookings.map(item => (
                            <div key={item.id} className="history-item" onClick={() => handleEventClick({event: {id: item.id, extendedProps: item.extendedProps}})}>
                                <div><div style={{color:'white', fontWeight:'600'}}>{item.extendedProps.customerName}</div><div className="history-cam" style={{color: item.color}}>{item.extendedProps.cameraName}</div></div>
                                <div style={{textAlign:'right'}}><div className="history-date">{formatDateShort(item.start)} - {formatDateShort(item.end)}</div></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Form */}
            <div className="card">
                <div className="card-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                         <h3 className="card-title">{editingId ? '✏️ แก้ไขข้อมูล' : '📝 ทำรายการจอง'}</h3>
                         {editingId && <span style={{fontSize:'0.75rem', background:'#f39c12', color:'black', padding:'2px 8px', borderRadius:'4px', fontWeight:'bold'}}>EDITING</span>}
                    </div>
                    <button type="button" onClick={handleCopySummary} style={{background:'#1abc9c', border:'none', padding:'5px 10px', borderRadius:'6px', cursor:'pointer', color:'white', fontSize:'0.9rem'}}>
                        📋 Copy สรุป
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{marginBottom:'8px', display:'block'}}>เลือกรุ่นกล้อง</label>
                        <select name="itemId" value={formData.itemId} onChange={handleChange}>
                            {cameras.map(cam => (
                                <option 
                                    key={cam.id} 
                                    value={cam.id}
                                    disabled={cam.status === 'maintenance'}
                                    style={{color: cam.status === 'maintenance' ? '#e74c3c' : 'white'}}
                                >
                                    {cam.name} {cam.status === 'maintenance' ? '(⛔ ส่งซ่อม)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{marginBottom:'8px', display:'block'}}>ชื่อลูกค้า</label>
                        <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} required placeholder="ระบุชื่อลูกค้า..." />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <div className="label-row"><label>วันรับของ</label>
                            <div className="duration-tags">{[1, 2, 3, 5, 7].map(d => <button key={d} type="button" className="tag-btn" onClick={() => setDuration(d)}>+{d}</button>)}</div>
                        </div>
                        <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} required />
                    </div>
                    <div style={{ marginBottom: '20px' }}><label style={{marginBottom:'8px', display:'block'}}>วันคืนของ</label>
                        <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} required />
                    </div>

                    <div style={{ marginBottom: '20px', background:'#222', padding:'15px', borderRadius:'8px', border:'1px dashed #444', textAlign:'center' }}>
                        <label style={{marginBottom:'10px', display:'block', color:'#aaa', fontSize:'0.9rem'}}>ส่วนลด / โปรโมชั่น</label>
                        <button type="button" onClick={() => setActiveModal('promo')} style={{ width: '100%', padding: '12px', background: selectedPromo === 'none' ? '#333' : 'rgba(241, 196, 15, 0.15)', color: selectedPromo === 'none' ? '#aaa' : '#f1c40f', border: selectedPromo === 'none' ? '1px solid #444' : '1px solid #f1c40f', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                            {selectedPromo === 'none' ? '🎫 กดเพื่อเลือกส่วนลด' : currentPromoLabel}
                        </button>
                    </div>

                    <div className="price-box"><p style={{ margin: 0, color: '#aaa', fontSize:'0.9rem' }}>ยอดรวมสุทธิ</p><h2 className="price-text">{formData.totalPrice.toLocaleString()} บาท</h2></div>
                    
                    <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button type="submit" className="btn btn-primary">{editingId ? '💾 บันทึกการแก้ไข' : '✅ ยืนยันการจอง'}</button>
                        {editingId && (
                            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                {/* ✨ ปุ่มคืนของ (ใหม่) */}
                                {currentBookingStatus !== 'returned' && (
                                    <button type="button" onClick={handleFinishBooking} style={{background:'#27ae60', color:'white', border:'none', padding:'10px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>
                                        ✅ ลูกค้าคืนของแล้ว (จบงาน)
                                    </button>
                                )}
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                                    <button type="button" onClick={handleDelete} className="btn btn-danger">🗑️ ลบ</button>
                                    <button type="button" onClick={handleCancel} className="btn btn-secondary">❌ ยกเลิก</button>
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>

        {/* Calendar */}
        <div className="card">
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                events={events}
                eventClick={handleEventClick}
                dateClick={handleDateClick}
                height="auto"
                dayMaxEvents={false}
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                eventContent={(arg) => (
                    <div style={{fontSize:'0.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'1px 2px'}}>
                        <span style={{fontWeight:'bold', marginRight:'4px'}}>{arg.event.start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        {arg.event.title}
                    </div>
                )}
            />
        </div>
      </div>

      {/* --- MODAL OVERLAY --- */}
      {activeModal && modalContent && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.85)', backdropFilter:'blur(4px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:9999}} onClick={() => setActiveModal(null)}>
            <div className="card" style={{width:'95%', maxWidth: activeModal === 'monthly_view' ? '900px' : '450px', maxHeight:'90vh', display:'flex', flexDirection:'column', padding:'0', overflow:'hidden', boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{padding:'20px', background:'#1a1a1a', borderBottom:'1px solid #333', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h3 style={{margin:0, color: modalContent.color}}>{modalContent.title}</h3>
                    <button onClick={() => setActiveModal(null)} style={{background:'none', border:'none', color:'#aaa', fontSize:'1.5rem', cursor:'pointer'}}>×</button>
                </div>

                {/* Body */}
                <div style={{padding:'20px', overflowY:'auto', background:'#222'}}>
                    {modalContent.type === 'menu' ? (
                        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            <button className="btn" style={{background:'#2d2d2d', border:'1px solid #444', color:'white', justifyContent:'space-between', height:'60px'}} onClick={() => setActiveModal('send_date')}>
                                <span>📦 คิวส่งของ</span>
                                <span className="stat-badge" style={{background:'#e67e22', color:'white'}}>{modalContent.data.sends.length}</span>
                            </button>
                            <button className="btn" style={{background:'#2d2d2d', border:'1px solid #444', color:'white', justifyContent:'space-between', height:'60px'}} onClick={() => setActiveModal('return_date')}>
                                <span>↩️ คิวรับคืน</span>
                                <span className="stat-badge" style={{background:'#3498db', color:'white'}}>{modalContent.data.returns.length}</span>
                            </button>
                        </div>
                    ) : modalContent.type === 'promo' ? (
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {PROMOTIONS.map(p => (
                                <button key={p.id} onClick={() => { setSelectedPromo(p.id); setActiveModal(null); }} style={{ padding: '15px', background: selectedPromo === p.id ? 'rgba(241, 196, 15, 0.1)' : '#2d2d2d', border: selectedPromo === p.id ? '1px solid #f1c40f' : '1px solid #333', borderRadius: '8px', color: selectedPromo === p.id ? '#f1c40f' : 'white', textAlign: 'left', cursor: 'pointer', fontSize: '1rem', fontWeight: selectedPromo === p.id ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{fontSize:'1.2rem'}}>{selectedPromo === p.id ? '✅' : '⚪'}</span>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    ) : modalContent.type === 'profit' ? (
                        <div>
                            <div style={{textAlign:'center', padding:'20px', background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)', borderRadius:'12px', marginBottom:'20px'}}>
                                <div style={{color:'rgba(255,255,255,0.8)', fontSize:'0.9rem', marginBottom:'5px'}}>ยอดขายรวม</div>
                                <div style={{fontSize:'2.5rem', fontWeight:'bold', color:'white'}}>{profitStats.totalRevenue.toLocaleString()} ฿</div>
                                <div style={{fontSize:'0.8rem', color:'rgba(255,255,255,0.7)', marginTop:'5px'}}>{events.length} รายการ</div>
                            </div>
                            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                {profitStats.monthlyList.map(m => (
                                    <div key={m.sortKey} style={{display:'flex', justifyContent:'space-between', padding:'12px', background:'#2d2d2d', borderRadius:'8px', alignItems:'center'}}>
                                        <div><div style={{fontWeight:'bold', color:'white'}}>{m.name}</div><div style={{fontSize:'0.75rem', color:'#777'}}>{m.count} รายการ</div></div>
                                        <div style={{color:'#10b981', fontWeight:'bold', fontSize:'1.1rem'}}>+{m.total.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : modalContent.type === 'daily_schedule' ? (
                        <div>
                            <div style={{marginBottom:'15px', display:'flex', justifyContent:'center'}}>
                                <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} style={{width:'auto', padding:'10px'}} />
                            </div>
                            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                {dailyScheduleList.map(cam => (
                                    <div key={cam.id} style={{background:'#2d2d2d', padding:'12px', borderRadius:'8px', borderLeft:`4px solid ${cam.colorClass}`}}>
                                        <div style={{fontWeight:'bold', color:'white', marginBottom:'4px'}}>{cam.name}</div>
                                        <div style={{color:cam.colorClass, fontSize:'0.95rem'}}>{cam.status}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : modalContent.type === 'camera_status' ? (
                        /* ✨ หน้าจัดการสถานะกล้อง */
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            <p style={{textAlign:'center', color:'#aaa', marginBottom:'10px'}}>เลือกกล้องเพื่อแจ้งส่งซ่อม / รับกลับ</p>
                            {cameraList.map(cam => (
                                <div key={cam.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#2d2d2d', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}>
                                    <span style={{color:'white', fontWeight:'bold'}}>{cam.name}</span>
                                    {cam.status === 'available' ? (
                                        <button 
                                            onClick={() => toggleCameraStatus(cam)}
                                            style={{
                                                padding:'6px 15px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem',
                                                background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: '1px solid #e74c3c'
                                            }}
                                        >
                                            🛠️ กดส่งซ่อม
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => toggleCameraStatus(cam)}
                                            style={{
                                                padding:'6px 15px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'0.85rem',
                                                background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981'
                                            }}
                                        >
                                            ✅ รับคืน (ใช้งานได้)
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : modalContent.type === 'monthly_view' ? (
                        /* ✨ หน้าตารางรายเดือน */
                        <div>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', background:'#333', padding:'10px', borderRadius:'8px'}}>
                                <button onClick={() => handleMonthChange(-1)} style={{background:'none', border:'none', color:'white', fontSize:'1.2rem', cursor:'pointer'}}>◀ ย้อนกลับ</button>
                                <span style={{color:'#3498db', fontWeight:'bold', fontSize:'1.1rem'}}>{viewMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={() => handleMonthChange(1)} style={{background:'none', border:'none', color:'white', fontSize:'1.2rem', cursor:'pointer'}}>ถัดไป ▶</button>
                            </div>
                            <div style={{overflowX:'auto'}}>
                                <div style={{display:'grid', gridTemplateColumns:'200px repeat(31, 30px)', gap:'5px', minWidth:'max-content'}}>
                                    <div style={{color:'#aaa', textAlign:'right', paddingRight:'10px'}}>วันที่</div>
                                    {Array.from({length:31}, (_, i) => i+1).map(d => (
                                        <div key={d} style={{textAlign:'center', color:'#777', fontSize:'0.8rem'}}>{d}</div>
                                    ))}
                                    {monthlyGridData.map(cam => (
                                        <React.Fragment key={cam.id}>
                                            <div style={{color:'white', fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'5px 0'}}>{cam.name}</div>
                                            {cam.daysStatus.map((ds, idx) => (
                                                <div 
                                                    key={idx} 
                                                    title={ds.status === 'maintenance' ? 'ส่งซ่อม' : (ds.booking ? `${ds.booking.extendedProps.customerName}` : 'ว่าง')}
                                                    style={{
                                                        width:'100%', height:'25px', borderRadius:'4px',
                                                        background: ds.status === 'maintenance' 
                                                            ? '#555' 
                                                            : (ds.booking ? (ds.booking.extendedProps.status === 'returned' ? '#7f8c8d' : '#e74c3c') : '#10b981'),
                                                        opacity: 0.8,
                                                        cursor: ds.booking ? 'pointer' : 'default'
                                                    }}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <div style={{marginTop:'20px', display:'flex', gap:'15px', justifyContent:'center', fontSize:'0.8rem', color:'#aaa'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'5px'}}><div style={{width:'12px', height:'12px', background:'#10b981', borderRadius:'2px'}}></div> ว่าง</div>
                                <div style={{display:'flex', alignItems:'center', gap:'5px'}}><div style={{width:'12px', height:'12px', background:'#e74c3c', borderRadius:'2px'}}></div> มีคิวจอง</div>
                                <div style={{display:'flex', alignItems:'center', gap:'5px'}}><div style={{width:'12px', height:'12px', background:'#7f8c8d', borderRadius:'2px'}}></div> คืนแล้ว (จบงาน)</div>
                                <div style={{display:'flex', alignItems:'center', gap:'5px'}}><div style={{width:'12px', height:'12px', background:'#555', borderRadius:'2px'}}></div> ส่งซ่อม</div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {modalContent.list.length === 0 ? <p style={{textAlign:'center', color:'#777', padding:'30px 0'}}>{modalContent.emptyMsg}</p> : 
                                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                    {modalContent.list.map(item => (
                                        <div key={item.id} style={{background:'#2d2d2d', padding:'12px', borderRadius:'8px', borderLeft:`4px solid ${item.color}`, cursor:'pointer'}} onClick={() => handleEventClick({event: {id: item.id, extendedProps: item.extendedProps}})}>
                                            <div style={{display:'flex', justifyContent:'space-between', fontWeight:'600', marginBottom:'4px', color:'white'}}>
                                                <span>{formatTime(activeModal.includes('send') ? item.start : item.end)} น.</span>
                                                <span style={{color:item.color, fontSize:'0.9rem'}}>{item.extendedProps.cameraName}</span>
                                            </div>
                                            <div style={{color:'#aaa', fontSize:'0.9rem'}}>{item.extendedProps.customerName}</div>
                                        </div>
                                    ))}
                                </div>
                            }
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;