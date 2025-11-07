// app/api/capsules/[id]/sign/route.ts

import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈

/**
 * @summary 캡슐 봉인 승인/거절 (Co-Signer)
 * @description 'pending_sign' 상태의 캡슐에 대해 공동 서명자가 서명을 처리합니다.
 * @description 모든 서명자가 'approved'하면 캡슐 상태를 'sealed'로 변경합니다.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const client = await pool.connect(); // 트랜잭션을 위해 client 연결
  
  try {
    // 1. URL에서 capsule_id 가져오기
    const params = await context.params;
    const capsule_id = parseInt(params.id, 10);

    // 2. JSON Body에서 서명자 ID와 승인 여부 가져오기
    const { signer_id, sign_status } = await request.json(); // 'approved' 또는 'rejected'

    // 3. 유효성 검사
    if (isNaN(capsule_id) || !signer_id || !['approved', 'rejected'].includes(sign_status)) {
      client.release();
      return NextResponse.json({
        message: "❌ 잘못된 요청입니다. capsule_id, signer_id, sign_status('approved'/'rejected')가 필요합니다.",
      }, { status: 400 });
    }

    // --- 트랜잭션 시작 ---
    await client.query('BEGIN');

    // 4. (1단계) Co-Signer의 서명 상태를 UPDATE
    const updateSignQuery = `
      UPDATE "CAPSULE_SIGN"
      SET "sign_status" = $1
      WHERE "capsule_id" = $2 AND "signer_id" = $3 AND "sign_status" = 'pending'
      RETURNING *;
    `;
    const updateResult = await client.query(updateSignQuery, [sign_status, capsule_id, signer_id]);

    if (updateResult.rows.length === 0) {
      // 이미 서명했거나, 서명 대상이 아닌 경우
      await client.query('ROLLBACK');
      client.release();
      return NextResponse.json({
        message: "❌ 서명 실패: 서명 대상이 아니거나, 'pending' 상태가 아닙니다.",
      }, { status: 404 });
    }

    // 5. (2단계) 캡슐의 최종 봉인 여부 확인
    //    'pending' 상태인 서명이 0개인지 확인
    const checkPendingQuery = `
      SELECT COUNT(*) AS pending_count FROM "CAPSULE_SIGN"
      WHERE "capsule_id" = $1 AND "sign_status" = 'pending';
    `;
    const pendingResult = await client.query(checkPendingQuery, [capsule_id]);
    const pendingCount = parseInt(pendingResult.rows[0].pending_count, 10);

    let capsuleStatus = 'pending_sign'; // 기본 상태

    if (pendingCount === 0) {
      // 모든 서명자가 서명을 완료한 경우
      
      // 'rejected'한 사람이 있는지 확인
      const checkRejectedQuery = `
        SELECT COUNT(*) AS rejected_count FROM "CAPSULE_SIGN"
        WHERE "capsule_id" = $1 AND "sign_status" = 'rejected';
      `;
      const rejectedResult = await client.query(checkRejectedQuery, [capsule_id]);
      const rejectedCount = parseInt(rejectedResult.rows[0].rejected_count, 10);

      if (rejectedCount === 0) {
        // (3단계) 아무도 거절하지 않았음 -> 'sealed' (완전 봉인) 상태로 변경
        const updateCapsuleQuery = `
          UPDATE "CAPSULE" SET "status" = 'sealed'
          WHERE "capsule_id" = $1 AND "status" = 'pending_sign'
          RETURNING "status";
        `;
        const capsuleUpdateResult = await client.query(updateCapsuleQuery, [capsule_id]);
        if(capsuleUpdateResult.rows.length > 0) {
          capsuleStatus = capsuleUpdateResult.rows[0].status; // 'sealed'
        }
      }
      // (참고) 만약 'rejected'가 1개라도 있다면, 캡슐 상태는 'sealed'가 되지 않고 'pending_sign'에 머무름
      // (또는 'rejected' 상태를 새로 만들어 관리할 수도 있습니다)
    }

    // --- 트랜잭션 커밋 ---
    await client.query('COMMIT');

    // 6. 성공 시
    return NextResponse.json({
      message: "✅ 서명 처리 성공!",
      sign_update: updateResult.rows[0],
      capsule_status: capsuleStatus, // 캡슐의 현재 (또는 변경된) 상태
    }, { status: 200 });

  } catch (error) {
    // 7. 실패 시
    await client.query('ROLLBACK');
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json({
      message: "❌ 서명 처리 실패... (트랜잭션 롤백)",
      error: errorMessage,
    }, { status: 500 });
  } finally {
    // 8. (필수!) 사용한 client를 Pool에 반환
    client.release();
  }
}