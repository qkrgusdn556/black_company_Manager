const express = require('express');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer 설정
const upload = multer({ storage: multer.memoryStorage() });

// 정적 파일 & Body Parser
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// PostgreSQL Pool 설정
const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// DB 연결 테스트 라우트
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query("SELECT NOW()");
        res.json({ success: true, now: result.rows[0].now });
    } catch (err) {
        console.error("PostgreSQL Test Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// MongoDB 연결
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("🎯 MongoDB Connected"))
        .catch(err => console.error("❌ MongoDB Connection Error:", err));
} else {
    console.log("⚠️ MongoDB URI 없음");
}

// MongoDB Schema
const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    createdAt: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);

// --- [API 라우트 시작] ---

// 메인 페이지 (index.html은 public 폴더에 있다고 가정)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 지원서 제출 (POST /submit)
app.post('/submit', upload.single('resume'), async (req, res) => {
    const { name, age, gender, phone, address } = req.body;
    let resumeFile = "No Image";

    if (req.file) {
        try {
            const doc = await ResumeImage.create({
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                imageBase64: req.file.buffer.toString('base64')
            });
            resumeFile = doc._id.toString();
        } catch (err) {
            console.error("❌ 이미지 MongoDB 저장 실패:", err);
        }
    }

    try {
        // [수정] PostgreSQL 플레이스홀더 $1, $2, ... 사용
        await db.query(`
        INSERT INTO applicants 
        (name, age, gender, phone_number, address, resume_file)
        VALUES ($1, $2, $3, $4, $5, $6)
        `, [name, age, gender, phone, address, resumeFile]);

        res.send('<script>alert("지원 완료!"); location.href="/";</script>');
    } catch (err) {
        console.error("❌ PostgreSQL 저장 실패:", err);
        res.send('<script>alert("DB 오류 발생"); history.back();</script>');
    }
});

// [추가] 공지사항 등록 API (POST /api/admin/notices)
app.post('/api/admin/notices', async (req, res) => {
    const { title, content } = req.body;
    try {
        // [수정] PostgreSQL 플레이스홀더 $1, $2 사용
        await db.query('INSERT INTO notices (title, content) VALUES ($1, $2)', [title, content]);
        res.json({ message: '등록 완료' });
    } catch (err) {
        console.error("PostgreSQL 공지사항 등록 오류:", err);
        res.status(500).json({ error: 'DB 오류' });
    }
});

// [추가] 공지사항 목록 조회 API (GET /api/admin/notices)
app.get('/api/admin/notices', async (req, res) => {
    try {
        // [수정] rows[0]가 아닌 rows를 반환
        const result = await db.query('SELECT id, title, created_at FROM notices ORDER BY id DESC LIMIT 5');
        res.json(result.rows);
    } catch (err) {
        console.error("PostgreSQL 공지사항 목록 조회 오류:", err);
        res.status(500).json({ error: '오류' });
    }
});

// [추가] 공지사항 상세 조회 API (GET /api/admin/notices/:id) - *가정된 라우트
app.get('/api/admin/notices/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await db.query('SELECT * FROM notices WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '없음' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("PostgreSQL 공지사항 상세 조회 오류:", err);
        res.status(500).json({ error: 'DB 오류' });
    }
});

// [추가] 공지사항 삭제 API (DELETE /api/admin/notices/:id)
app.delete('/api/admin/notices/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.query('DELETE FROM notices WHERE id = $1', [id]);
        res.json({ message: '삭제 완료' });
    } catch (err) {
        console.error("PostgreSQL 공지사항 삭제 오류:", err);
        res.status(500).json({ error: 'DB 오류' });
    }
});

// [추가] 지원자 목록 조회 API (GET /api/applicants)
app.get('/api/applicants', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM applicants ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("PostgreSQL 지원자 목록 조회 오류:", err);
        res.status(500).json({ error: '오류' });
    }
});

// [추가] 문의사항 목록 조회 API (GET /api/admin/inquiries)
app.get('/api/admin/inquiries', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM inquiries ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("PostgreSQL 문의사항 목록 조회 오류:", err);
        res.status(500).json({ error: '오류' });
    }
});

// [추가] 문의사항 상세 조회 API (GET /api/admin/inquiries/:id)
app.get('/api/admin/inquiries/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const result = await db.query('SELECT * FROM inquiries WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '없음' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("PostgreSQL 문의사항 상세 조회 오류:", err);
        res.status(500).json({ error: 'DB 오류' });
    }
});


// 서버 실행a
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on PORT ${PORT}`));
