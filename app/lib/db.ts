// app/lib/db.ts

import { Pool } from 'pg';

// .env.local에서 개별 변수를 읽어옵니다.
if (!process.env.PG_HOST || !process.env.PG_DATABASE || !process.env.PG_USER || !process.env.PG_PASSWORD) {
  throw new Error(".env.local 파일에 DB 접속 정보가 올바르게 설정되지 않았습니다.");
}

// 1. Pool 객체를 생성합니다.
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: false 
});

// 2. 생성한 Pool 객체를 'export' (수출)합니다.
//    이제 다른 파일에서 이 'pool'을 import해서 재사용할 수 있습니다.
export default pool;