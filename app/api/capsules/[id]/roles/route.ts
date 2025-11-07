// app/api/capsules/[id]/roles/route.ts

import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈

export async function POST(
  request: Request,
  // 🚨 'context' 객체를 올바르게 받고, 'params'가 Promise일 수 있음을 명시
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // 1. (🚨 중요!) context.params가 Promise이므로, await으로 엽니다.
    //    이것이 seal API를 성공시킨 코드입니다.
    const params = await context.params; 
    const capsule_id = parseInt(params.id, 10);

    // 2. NaN 검사
    if (isNaN(capsule_id)) {
      return NextResponse.json({
        message: "❌ capsule_id가 숫자가 아닙니다.",
        received: params.id,
      }, { status: 400 });
    }

    // 3. 프론트엔드에서 보낸 JSON 데이터를 받습니다.
    const { user_id, role_type } = await request.json();

    // 4. 유효성 검사
    if (!user_id || !role_type) {
      return NextResponse.json({
        message: "❌ 'user_id'와 'role_type'은 필수 항목입니다.",
      }, { status: 400 });
    }
    
    // 5. CAPSULE_ROLE 테이블에 INSERT 쿼리를 날립니다.
    const query = `
      INSERT INTO "CAPSULE_ROLE" (capsule_id, user_id, role_type)
      VALUES ($1, $2, $3)
      RETURNING *; 
    `;
    const values = [capsule_id, user_id, role_type];
    
    const result = await pool.query(query, values);

    // 6. 성공 시
    return NextResponse.json({
      message: "✅ 참여자 지정 성공!",
      role_assignment: result.rows[0],
    }, { status: 201 });

  } catch (error) {
    // 7. 실패 시 (예: 중복된 키)
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 참여자 지정 실패...",
      error: errorMessage,
    }, { status: 500 });
  }
}