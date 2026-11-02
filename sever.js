const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

const DB_FILE = './keys.json';

// Đọc cơ sở dữ liệu từ file JSON
function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ keys: {} }));
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

// Lưu dữ liệu vào file
function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. API ADMIN: Tạo Key mới
app.post('/api/admin/create-key', (req, res) => {
    const { key, durationDays } = req.body; // durationDays: số ngày hết hạn
    if (!key) return res.status(400).json({ success: false, message: 'Thiếu thông tin Key' });

    const db = loadData();
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + (parseInt(durationDays) || 30));

    db.keys[key] = {
        active: true,
        deviceId: null, // Chưa gán thiết bị nào
        expiresAt: expireDate.toISOString(),
        createdAt: new Date().toISOString()
    };

    saveData(db);
    res.json({ success: true, message: `Tạo Key ${key} thành công!`, data: db.keys[key] });
});

// 2. API ADMIN: Khóa / Mở Key từ xa
app.post('/api/admin/toggle-key', (req, res) => {
    const { key, status } = req.body; // status: true/false
    const db = loadData();

    if (!db.keys[key]) return res.status(404).json({ success: false, message: 'Key không tồn tại' });

    db.keys[key].active = status;
    saveData(db);

    res.json({ success: true, message: `Cập nhật trạng thái Key ${key} thành ${status ? 'MỞ' : 'KHÓA'}` });
});

// 3. API CLIENT: Xác thực & Gắn thiết bị
app.post('/api/client/verify', (req, res) => {
    const { key, deviceId } = req.body;
    const db = loadData();

    const keyData = db.keys[key];

    // Kiểm tra tồn tại
    if (!keyData) {
        return res.status(400).json({ success: false, message: 'Key không hợp lệ!' });
    }

    // Kiểm tra trạng thái Khóa từ xa
    if (!keyData.active) {
        return res.status(403).json({ success: false, message: 'Key này đã bị vô hiệu hóa từ xa!' });
    }

    // Kiểm tra thời hạn
    if (new Date() > new Date(keyData.expiresAt)) {
        return res.status(403).json({ success: false, message: 'Key đã hết hạn sử dụng!' });
    }

    // Kiểm tra & Gắn thiết bị (Hardware Binding)
    if (!keyData.deviceId) {
        // Lần đầu đăng nhập: Gắn ID thiết bị vào Key
        keyData.deviceId = deviceId;
        saveData(db);
    } else if (keyData.deviceId !== deviceId) {
        // Sử dụng trên thiết bị khác
        return res.status(403).json({ success: false, message: 'Key đã được sử dụng trên một thiết bị khác!' });
    }

    res.json({ 
        success: true, 
        message: 'Xác thực thành công!',
        expiresAt: keyData.expiresAt 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
