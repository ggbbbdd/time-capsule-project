// app/api/capsules/[id]/seal/route.ts

import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈

/**
 * @summary 캡슐 봉인 요청 (Creator) [업그레이드 버전]
 * @description 1. 캡슐 상태를 'pending_sign'으로 변경합니다.
 * @description 2. 'co-signer'들을 'CAPSULE_SIGN' 테이블에 'pending' 상태로 추가합니다.
 * @description 3. 이 모든 과정을 트랜잭션으로 처리합니다.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const client = await pool.connect(); // 트랜잭션을 위해 Pool에서 client 연결
  
  try {
    // 1. context에서 params를 비동기로 꺼냅니다.
    const params = await context.params;
    const capsule_id = parseInt(params.id, 10);

    // 2. NaN 검사
    if (isNaN(capsule_id)) {
      client.release(); // client 반환
      return NextResponse.json({
        message: "❌ capsule_id가 숫자가 아닙니다.",
      }, { status: 400 });
    }

    // --- 트랜잭션 시작 ---
    await client.query('BEGIN');

    // 3. (1단계) 캡슐 상태를 'draft'에서 'pending_sign'으로 변경
    const updateCapsuleQuery = `
      UPDATE "CAPSULE"
      SET "status" = 'pending_sign'
      WHERE "capsule_id" = $1 AND "status" = 'draft'
      RETURNING capsule_id, status;
    `;
    const updateResult = await client.query(updateCapsuleQuery, [capsule_id]);

    if (updateResult.rows.length === 0) {
      // 'draft' 상태가 아니면 롤백하고 종료
      await client.query('ROLLBACK');
      client.release();
      return NextResponse.json({
        message: "❌ 봉인 요청 실패: 캡슐이 'draft' 상태가 아니거나 존재하지 않습니다.",
      }, { status: 404 });
    }

    // 4. (2단계) 이 캡슐의 'co-signer' 목록을 조회
    const findCoSignersQuery = `
      SELECT "user_id" FROM "CAPSULE_ROLE"
      WHERE "capsule_id" = $1 AND "role_type" = 'co-signer';
    `;
    const coSignersResult = await client.query(findCoSignersQuery, [capsule_id]);
    const coSigners = coSignersResult.rows; // 예: [{ user_id: 2 }, { user_id: 3 }]

    // 5. (3단계) 'co-signer'들을 'CAPSULE_SIGN' 테이블에 INSERT
    if (coSigners.length > 0) {
      // 여러 명을 한 번에 INSERT하는 쿼리 생성
      const insertSignQuery = `
        INSERT INTO "CAPSULE_SIGN" (capsule_id, signer_id, sign_status)
        VALUES ${coSigners.map(signer => `($1, ${signer.user_id}, 'pending')`).join(', ')}
      `;
      // $1에는 capsule_id가 들어감
      await client.query(insertSignQuery, [capsule_id]);
    } else {
      // (선택) 공동 서명자가 없으면 바로 'sealed'로 만들 수도 있지만,
      // 제안서 흐름상 'pending_sign'에 머무르는 것이 맞을 수 있습니다.
      // 여기서는 서명자 없으면 그냥 넘어갑니다.
    }

    // --- 트랜잭션 커밋 (모든 작업 확정) ---
    await client.query('COMMIT');

    // 6. 성공 시
    return NextResponse.json({
      message: "✅ 캡슐 봉인 요청 성공! 'pending_sign' 상태로 변경되었습니다.",
      capsule: updateResult.rows[0],
      signers_added: coSigners.length, // 몇 명의 서명자가 추가되었는지 알려줌
    }, { status: 200 });

  } catch (error) {
    // 7. 실패 시 (트랜잭션 롤백)
    await client.query('ROLLBACK');
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 캡슐 봉인 요청 실패... (트랜잭션 롤백)",
      error: errorMessage,
    }, { status: 500 });
  } finally {
    // 8. (필수!) 사용한 client를 Pool에 반환
    client.release();
  }
}