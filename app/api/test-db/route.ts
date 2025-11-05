// app/api/test-db/route.ts

import { Pool } from 'pg';
import { NextResponse } from 'next/server';

// 1. .env.local에서 POSTGRES_URL을 읽어옵니다.
const connectionString = process.env.POSTGRES_URL;

// 2. URL 변수가 있는지 TypeScript에게 확인시킵니다.
if (!connectionString) {
  throw new Error("POSTGRES_URL 환경 변수가 .env.local 파일에 설정되지 않았습니다.");
}

// 3. 로컬 DB에 연결하는 Pool 생성 (SSL 옵션 없음!)
//    로컬 DB는 Vercel/Supabase와 달리 복잡한 SSL이 필요 없습니다.
const pool = new Pool({
  connectionString: connectionString,
});

// 4. GET 요청을 처리할 함수
export async function GET() {
  try {
    // 5. DB에 '현재 시간'을 물어보는 간단한 SQL 쿼리 전송
    const result = await pool.query('SELECT NOW()');

    // 6. 성공 시
    return NextResponse.json({
      message: "✅ [로컬 DB] 연결 성공!",
      db_time: result.rows[0].now,
    }, { status: 200 });

  } catch (error) {
    // 7. 실패 시 (예: 비밀번호가 틀렸거나, DB 이름이 틀렸을 때)
    const errorMessage = (error instanceof Error) ? error.message : String(error);

    return NextResponse.json({
      message: "❌ [로컬 DB] 연결 실패...",
      error: errorMessage,
    }, { status: 500 });
  }
}