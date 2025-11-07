// app/api/capsules/route.ts

import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈 재사용

/**
 * @summary 캡슐 생성 (Creator)
 * @description '창작자'가 새 캡슐을 'draft' 상태로 생성합니다.
 */
export async function POST(request: Request) {
  try {
    // 1. 프론트엔드에서 보낸 JSON 데이터를 받습니다.
    const {
      owner_id, // 캡슐을 생성하는 사용자 ID (Creator)
      title,
      content,
      unlock_date, // 개봉일 (예: "2026-11-05T14:00:00Z")
    } = await request.json();

    // 2. (유효성 검사) 필수 값들이 모두 있는지 확인합니다.
    if (!owner_id || !title || !unlock_date) {
      return NextResponse.json({
        message: "❌ 'owner_id', 'title', 'unlock_date'는 필수 항목입니다.",
      }, { status: 400 }); // 400: Bad Request (잘못된 요청)
    }

    // 3. DB에 INSERT 쿼리를 날립니다.
    const query = `
      INSERT INTO "CAPSULE" (owner_id, title, content, status, unlock_date)
      VALUES ($1, $2, $3, 'draft', $4)
      RETURNING capsule_id, title, status, unlock_date;
    `;
    // 'status'는 'draft' (초안)로 고정해서 저장합니다.
    const values = [owner_id, title, content, unlock_date];
    
    const result = await pool.query(query, values);

    // 4. 성공 시, 방금 생성된 캡슐 정보를 반환합니다.
    return NextResponse.json({
      message: "✅ 캡슐 생성 성공!",
      capsule: result.rows[0],
    }, { status: 201 }); // 201: Created

  } catch (error) {
    // 5. 실패 시
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 캡슐 생성 실패...",
      error: errorMessage,
    }, { status: 500 });
  }
}