// app/api/test-db/route.ts

import { Pool } from 'pg';
import { NextResponse } from 'next/server';

// 1. .env.local에서 개별 변수를 읽어옵니다.
if (!process.env.PG_HOST || !process.env.PG_DATABASE || !process.env.PG_USER || !process.env.PG_PASSWORD) {
  throw new Error(".env.local 파일에 DB 접속 정보(PG_HOST 등)가 올바르게 설정되지 않았습니다.");
}

// 2. 'connectionString' 대신 '객체'로 Pool을 생성합니다.
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT) || 5432, // 포트 번호는 숫자로 변환
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: false // 로컬 DB는 SSL이 필요 없습니다.
});

// 3. GET 요청을 처리할 함수
export async function GET() {
  try {
    const result = await pool.query('SELECT NOW()');
    
    // 성공 시
    return NextResponse.json({
      message: "✅ [로컬 DB] 연결 성공!",
      db_time: result.rows[0].now,
    }, { status: 200 });

  } catch (error) {
    // 실패 시
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    
    return NextResponse.json({
      message: "❌ [로컬 DB] 연결 실패...",
      error: errorMessage,
    }, { status: 500 });
  }
}