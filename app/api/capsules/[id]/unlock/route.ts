import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈

/**
 * @summary 캡슐 개봉 승인 (Verifier)
 * @description 1. 인증자(Verifier)가 캡슐의 개봉을 승인합니다.
 * @description 2. 캡슐 상태를 'sealed'에서 'unlocked'로 변경하고 VERIFICATION_NOTE를 기록합니다.
 * @description 3. 모든 과정을 트랜잭션으로 처리합니다.
 */
export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const client = await pool.connect(); // 트랜잭션을 위해 client 연결
  
  try {
    // 1. URL에서 capsule_id 가져오기
    const capsule_id = parseInt(context.params.id, 10);

    // 2. JSON Body에서 Verifier ID와 승인 노트 가져오기
    const { 
      verifier_id, 
      note, // 개봉 승인 시 남기는 메모
    } = await request.json(); 
    
    // 🚨 2.1. 권한 확인을 위해 실제 인증된 사용자 ID를 사용합니다.
    const authenticated_user_id = verifier_id; 

    // 3. 유효성 검사
    if (isNaN(capsule_id) || !authenticated_user_id || !note) {
      client.release();
      return NextResponse.json({
        message: "❌ 잘못된 요청입니다. 필수 정보(capsule_id, verifier_id, note)가 누락되었습니다.",
      }, { status: 400 });
    }

    // --- 트랜잭션 시작 ---
    await client.query('BEGIN');
    
    // 4. (1단계) 권한 및 캡슐 상태 확인 (CAPSULE_ROLE 및 CAPSULE 테이블 동시 조회)
    // 캡슐이 'sealed' 상태이고, 요청자가 'verifier' 역할을 가지고 있는지 확인합니다.
    const checkAuthAndStatusQuery = `
      SELECT C.status, R.role_type 
      FROM "CAPSULE" C
      JOIN "CAPSULE_ROLE" R ON C.capsule_id = R.capsule_id
      WHERE C.capsule_id = $1 AND R.user_id = $2;
    `;
    const checkResult = await client.query(checkAuthAndStatusQuery, [capsule_id, authenticated_user_id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return NextResponse.json({
        message: "❌ 개봉 권한 없음: 해당 캡슐의 인증자(Verifier)가 아니거나 캡슐이 존재하지 않습니다.",
      }, { status: 403 });
    }

    const { status, role_type } = checkResult.rows[0];

    if (role_type !== 'verifier' || status !== 'sealed') {
      await client.query('ROLLBACK');
      client.release();
      return NextResponse.json({
        message: `❌ 개봉 승인 실패: 현재 상태(${status})에서 개봉할 수 없거나, 요청자가 Verifier가 아닙니다.`,
      }, { status: 403 });
    }

    // 5. (2단계) 캡슐 상태를 'sealed' -> 'unlocked'로 변경
    const updateCapsuleQuery = `
      UPDATE "CAPSULE" 
      SET "status" = 'unlocked', "unlocked_at" = NOW()
      WHERE "capsule_id" = $1
      RETURNING capsule_id, status, unlocked_at;
    `;
    const updateResult = await client.query(updateCapsuleQuery, [capsule_id]);

    // 6. (3단계) VERIFICATION_NOTE 기록 (개봉 승인 기록)
    const insertNoteQuery = `
      INSERT INTO "VERIFICATION_NOTE" (capsule_id, verifier_id, note)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const noteResult = await client.query(insertNoteQuery, [capsule_id, authenticated_user_id, note]);
    
    // --- 트랜잭션 커밋 ---
    await client.query('COMMIT');

    // 7. 성공 시
    return NextResponse.json({
      message: "✅ 캡슐 개봉 승인 성공! 'unlocked' 상태로 변경되었습니다.",
      capsule_status: updateResult.rows[0].status,
      unlocked_at: updateResult.rows[0].unlocked_at,
      verification_note: noteResult.rows[0],
    }, { status: 200 });

  } catch (error) {
    // 8. 실패 시 (트랜잭션 롤백)
    await client.query('ROLLBACK');
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 캡슐 개봉 승인 실패... (트랜잭션 롤백)",
      error: errorMessage,
    }, { status: 500 });
  } finally {
    // 9. (필수!) 사용한 client를 Pool에 반환
    client.release();
  }
}