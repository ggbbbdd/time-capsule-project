// app/api/users/route.ts (이 내용으로 덮어쓰세요)

import { NextResponse } from 'next/server';
// 1. 방금 만든 'pool' 객체를 import 합니다.
import pool from '@/app/lib/db'; 

// POST 요청 (회원가입 요청)을 처리할 함수
export async function POST(request: Request) {
  try {
    // 2. 프론트엔드에서 보낸 JSON 데이터를 받습니다.
    const { username, password, email } = await request.json();

    // 3. (보안) 실제로는 password를 해시(bcrypt)해야 하지만, 지금은 그대로 저장합니다.
    
    // 4. DB에 INSERT 쿼리를 날립니다. (테이블 이름이 "USERS"로 변경됨)
    const query = `
      INSERT INTO "USERS" (username, password, email)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email;
    `;
    // $1, $2, $3: SQL Injection 공격을 방지하는 'parameterized query' 방식입니다.
    const values = [username, password, email];
    
    const result = await pool.query(query, values);

    // 5. 성공 시, 방금 생성된 사용자 정보를 반환합니다.
    return NextResponse.json({
      message: "✅ 회원가입 성공!",
      user: result.rows[0],
    }, { status: 201 }); // 201: 'Created' (성공적으로 생성됨)

  } catch (error) {
    // 6. 실패 시 (예: username 또는 email 중복)
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 회원가입 실패...",
      error: errorMessage,
    }, { status: 500 });
  }
}