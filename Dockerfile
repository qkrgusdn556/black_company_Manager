# 1. Node.js 설치된 리눅스 이미지 가져오기 (버전 18)
FROM node:18-alpine

# 2. 컨테이너 내부 작업 폴더 설정
WORKDIR /app

# 3. 패키지 정보 복사 및 라이브러리 설치
# (package.json만 먼저 복사해서 캐싱 효율을 높임)
COPY package.json ./
RUN npm install

# 4. 나머지 소스 코드 전체 복사
COPY . .

# 5. 컨테이너가 사용할 포트 지정 (문서용)
EXPOSE 4000

# 6. 서버 실행 명령어
CMD ["node", "admin_server.js"]
