const express = require('express');
const cors = require('cors');
const pool = require('./db'); // <--- เรียกใช้ตัวเชื่อม Supabase จากไฟล์ db.js
const app = express();

app.use(cors());
app.use(express.json());

// ---------------- API ENDPOINTS ----------------

// 1. ดึงรายชื่อกล้อง (รวมสถานะ)
app.get('/api/cameras', (req, res) => {
  pool.query('SELECT * FROM cameras ORDER BY id ASC', (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result.rows);
  });
});

// ✨ [เพิ่ม] เปลี่ยนสถานะกล้อง (ซ่อม/ปกติ)
app.patch('/api/cameras/:id/status', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    pool.query("UPDATE cameras SET status = $1 WHERE id = $2", [status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Status updated" });
    });
});

// 2. ดึงรายการจอง (เพิ่ม status)
app.get('/api/bookings', (req, res) => {
  const sql = `
    SELECT bookings.id, bookings.item_id as "itemId", bookings.title as "customerName", 
           bookings.start_date as "start", bookings.end_date as "end", 
           bookings.price as "totalPrice", bookings.status,
           cameras.name as "cameraName"
    FROM bookings 
    LEFT JOIN cameras ON bookings.item_id = cameras.id
    ORDER BY bookings.start_date ASC
  `;
  pool.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result.rows);
  });
});

// ✨ [เพิ่ม] เปลี่ยนสถานะการจอง (คืนของแล้ว)
app.patch('/api/bookings/:id/status', (req, res) => {
    const id = req.params.id;
    const { status } = req.body; 
    pool.query("UPDATE bookings SET status = $1 WHERE id = $2", [status, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Booking status updated" });
    });
});

// 3. เช็คคิวว่าง (กรองกล้องส่งซ่อมออก)
app.get('/api/available', (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: "ระบุวันไม่ครบ" });

    const sql = `
        SELECT * FROM cameras 
        WHERE status = 'available' 
        AND id NOT IN (
            SELECT item_id FROM bookings 
            WHERE start_date < $1 AND end_date > $2 
            AND item_id IS NOT NULL
        )
        ORDER BY id ASC
    `;
    pool.query(sql, [end, start], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows);
    });
});

// 4. สร้างการจอง
app.post('/api/bookings', (req, res) => {
  const { itemId, customerName, start, end, totalPrice } = req.body;
  
  // เช็คคิวซ้อนอีกทีเพื่อความชัวร์
  const sqlCheck = `SELECT * FROM bookings WHERE item_id = $1 AND start_date < $2 AND end_date > $3`;
  pool.query(sqlCheck, [itemId, end, start], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.rows.length > 0) return res.status(400).json({ error: "❌ ไม่ว่าง: มีคนจองเวลานี้แล้ว" });

    // บันทึกการจอง
    const sqlInsert = `
        INSERT INTO bookings (item_id, title, start_date, end_date, price, status) 
        VALUES ($1, $2, $3, $4, $5, 'booked') 
        RETURNING id
    `;
    pool.query(sqlInsert, [itemId, customerName, start, end, totalPrice], (err, insertResult) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "success", id: insertResult.rows[0].id });
    });
  });
});

// 5. แก้ไขการจอง
app.put('/api/bookings/:id', (req, res) => {
  const { itemId, customerName, start, end, totalPrice } = req.body;
  const id = req.params.id;
  
  // เช็คว่าชนกับรายการอื่นไหม (ยกเว้นตัวเอง)
  const sqlCheck = `SELECT * FROM bookings WHERE item_id = $1 AND start_date < $2 AND end_date > $3 AND id != $4`;
  pool.query(sqlCheck, [itemId, end, start, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.rows.length > 0) return res.status(400).json({ error: "❌ ชนกับรายการอื่น" });

    const sqlUpdate = `UPDATE bookings SET item_id=$1, title=$2, start_date=$3, end_date=$4, price=$5 WHERE id=$6`;
    pool.query(sqlUpdate, [itemId, customerName, start, end, totalPrice, id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "updated successfully" });
    });
  });
});

// 6. ลบการจอง
app.delete('/api/bookings/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM bookings WHERE id = $1', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "deleted successfully" });
  });
});

// Export ให้ Vercel เอาไปใช้
module.exports = app;