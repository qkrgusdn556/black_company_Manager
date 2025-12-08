const express = require('express');
const mysql = require('mysql2');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 4000; // 관리자 포트

// 설정
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('admin_public')); // 관리자 화면 폴더

// 1. MySQL 연결 (지원자 정보 + 문의 내역)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root@1234', // ★ 비번 확인
    database: 'black_company'
});
db.connect(err => console.log(err ? '❌ 관리자 MySQL 실패' : '✅ 관리자 MySQL 성공'));

// 2. MongoDB Atlas 연결 (이력서 파일)
// ★ 메인 서버와 주소가 같아야 함 / 비번 수정 필수
const uri = "mongodb+srv://qkrgusdn556_db_user:1234@cluster0.xlmcslo.mongodb.net/?appName=Cluster0";

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

// --- [관리자 전용 API 및 라우트] ---

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
    console.log(`🕵️‍♂️ 중앙 통제실(관리자) 서버 가동: http://localhost:${PORT}`);
});