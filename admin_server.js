const express = require('express');
const mysql = require('mysql2');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // [Render] 할당된 PORT 사용 (3000은 로컬 테스트용)

// 설정
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'admin_public'))); // [Render] 경로 안정성 확보

// 1. MySQL 연결 (지원자 정보 + 문의 내역)
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

let db;
const connectDB = () => {
    db = mysql.createConnection(dbConfig);
    db.connect(err => {
        if (err) {
            console.error(`❌ MySQL 연결 실패: ${err.message}. 5초 후 재시도...`);
            // [수정] 연결 실패 시 5초 후 재귀적으로 재시도
            setTimeout(connectDB, 5000); 
            return;
        }
        console.log('✅ 관리자 MySQL 성공');
        
        // [추가] 장시간 유휴 연결이 끊기는 것을 방지
        db.on('error', (err) => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.error('⚠️ DB 연결이 끊어져 재연결 시도 중...');
                connectDB();
            } else {
                throw err;
            }
        });
    });
};
connectDB(); // DB 연결 시도 시작

// 2. MongoDB Atlas 연결 (이력서 파일)
const uri = process.env.MONGO_URI; 

mongoose.connect(uri)
  .then(() => console.log('✅ 관리자 MongoDB Atlas 성공'))
  .catch(err => console.error('❌ MongoDB 실패:', err));

const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    uploadDate: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);


// --- [API 라우트] ---

// 1. 관리자 메인 화면 접속
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_public', 'index.html'));
});

// 2. 이미지 다운로드 기능
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

// 3. [API] 공지사항 등록
app.post('/api/admin/notices', (req, res) => {
    db.query('INSERT INTO notices (title, content) VALUES (?, ?)', [req.body.title, req.body.content], (err) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json({ message: '등록 완료' });
    });
});

// 4. [API] 공지사항 목록 조회
app.get('/api/admin/notices', (req, res) => {
    db.query('SELECT * FROM notices ORDER BY id DESC LIMIT 5', (err, results) => {
        if (err) return res.status(500).json({ error: '오류' });
        res.json(results);
    });
});

// [API] 공지사항 삭제
app.delete('/api/admin/notices/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM notices WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB 오류' });
        }
        res.json({ message: '삭제 완료' });
    });
});

// 5. [API] 지원자 목록 조회
app.get('/api/applicants', (req, res) => {
    db.query('SELECT * FROM applicants ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: '오류' });
        res.json(results);
    });
});

// 6. [API] 문의사항 목록 조회
app.get('/api/admin/inquiries', (req, res) => {
    db.query('SELECT * FROM inquiries ORDER BY id DESC', (err, results) => {
        if (err) return res.json([]); 
        res.json(results);
    });
});

// 7. [API] 문의사항 상세 조회
app.get('/api/admin/inquiries/:id', (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM inquiries WHERE id = ?', [id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: '없음' });
        res.json(results[0]);
    });
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`🕵️‍♂️ 중앙 통제실(관리자) 서버 가동: Port ${PORT}`);
});