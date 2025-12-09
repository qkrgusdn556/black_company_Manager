const express = require('express');
const mysql = require('mysql2');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
// [수정 1] Render가 할당하는 포트(process.env.PORT)를 사용하도록 수정합니다.
const PORT = process.env.PORT || 3000; 

// 설정
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// [수정 2] 경로의 안정성을 높여줍니다. (Render 환경에서는 필요할 수 있음)
app.use(express.static(path.join(__dirname, 'admin_public'))); 

// 1. MySQL 연결 (지원자 정보 + 문의 내역)
// [수정 3] 하드코딩된 정보를 Render의 환경 변수(Secrets)를 통해 가져오도록 수정합니다.
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS, // DB_PASS로 변수명 통일
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        // [추가] Render 로그에서 DB 연결 실패 원인을 명확히 출력
        console.error('❌ 관리자 MySQL 실패 - 정보 확인 필요:', err.message); 
    } else {
        console.log('✅ 관리자 MySQL 성공');
    }
});

// 2. MongoDB Atlas 연결 (이력서 파일)
// [수정 4] MongoDB 접속 주소도 환경 변수(MONGO_URI)를 사용하도록 수정합니다.
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
    const { title, content } = req.body;
    db.query('INSERT INTO notices (title, content) VALUES (?, ?)', [title, content], (err) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json({ message: '등록 완료' });
    });
});

// 4. [API] 공지사항 목록 조회 (메인 화면용) - ★ 추가됨
app.get('/api/admin/notices', (req, res) => {
    db.query('SELECT * FROM notices ORDER BY id DESC LIMIT 5', (err, results) => {
        if (err) return res.status(500).json({ error: '오류' });
        res.json(results);
    });
});

// [API] 공지사항 삭제 (DELETE 요청 처리)
app.delete('/api/admin/notices/:id', (req, res) => {
    const id = req.params.id;
    // DB에서 해당 ID의 글을 삭제
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

// 7. [API] 문의사항 상세 조회 (상세보기용) - ★ 추가됨
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