const express = require('express');
const mysql = require('mysql2');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'admin_public')));

// MySQL 연결 설정 (Railway Public Proxy)
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },
    connectTimeout: 20000,
    multipleStatements: true
};

// MySQL 연결 유지
let db;
const connectDB = () => {
    db = mysql.createConnection(dbConfig);

    db.connect((err) => {
        if (err) {
            console.error(`❌ MySQL 연결 실패: ${err.message}`);
            setTimeout(connectDB, 5000);
            return;
        }
        console.log('🐬 MySQL(관리자 DB) 연결 성공!');

        db.on('error', (err) => {
            console.error('⚠️ MySQL 연결 에러:', err);
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.log('🔄 자동 재연결...');
                connectDB();
            } else {
                throw err;
            }
        });
    });
};
connectDB();

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🍃 MongoDB Atlas 연결 성공!'))
    .catch(err => console.error('❌ MongoDB 실패:', err));


// MongoDB Schema
const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    uploadDate: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);

// 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_public', 'index.html'));
});

app.get('/download/:id', async (req, res) => {
    try {
        const doc = await ResumeImage.findById(req.params.id);
        if (!doc) return res.status(404).send('파일 없음');

        const encodedName = encodeURIComponent(doc.filename);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
        res.setHeader('Content-Type', doc.contentType);
        res.send(Buffer.from(doc.imageBase64, 'base64'));
    } catch (e) {
        console.error(e);
        res.status(500).send('다운로드 오류');
    }
});

// 공지사항 API
app.post('/api/admin/notices', (req, res) => {
    const sql = 'INSERT INTO notices (title, content) VALUES (?, ?)';
    db.query(sql, [req.body.title, req.body.content], (err) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json({ message: '등록 완료!' });
    });
});

app.get('/api/admin/notices', (req, res) => {
    db.query('SELECT * FROM notices ORDER BY id DESC LIMIT 5', (err, results) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json(results);
    });
});

app.delete('/api/admin/notices/:id', (req, res) => {
    db.query('DELETE FROM notices WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json({ message: '삭제 완료' });
    });
});

// 지원자 조회
app.get('/api/applicants', (req, res) => {
    db.query('SELECT * FROM applicants ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json([]);
        res.json(results);
    });
});

// 문의사항 조회
app.get('/api/admin/inquiries', (req, res) => {
    db.query('SELECT * FROM inquiries ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json([]);
        res.json(results);
    });
});

// 문의 상세조회
app.get('/api/admin/inquiries/:id', (req, res) => {
    db.query('SELECT * FROM inquiries WHERE id = ?', [req.params.id], (err, results) => {
        if (err || !results.length) return res.status(404).json({ error: '없음' });
        res.json(results[0]);
    });
});

// 서버 시작
app.listen(PORT, () => console.log(`🚀 Admin 서버 실행 중: PORT ${PORT}`));
