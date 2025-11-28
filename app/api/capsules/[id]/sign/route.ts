import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = id;

  try {
    const { signer_id, decision } = await request.json(); // decision: 'approved' or 'rejected'

    if (!signer_id || !decision) {
      return NextResponse.json({ message: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. 내가 서명자가 맞는지, 그리고 상태가 pending인지 확인
      const checkQuery = `
        SELECT sign_status 
        FROM "CAPSULE_SIGN" 
        WHERE capsule_id = $1 AND signer_id = $2
      `;
      const checkResult = await client.query(checkQuery, [capsuleId, signer_id]);

      if (checkResult.rows.length === 0) {
        throw new Error("당신은 이 캡슐의 공동 서명자가 아닙니다.");
      }
      if (checkResult.rows[0].sign_status !== 'pending') {
        throw new Error("이미 서명을 완료했습니다.");
      }

      // 2. 서명 상태 업데이트 (승인 or 거절)
      const updateSignQuery = `
        UPDATE "CAPSULE_SIGN" 
        SET sign_status = $1 
        WHERE capsule_id = $2 AND signer_id = $3
      `;
      await client.query(updateSignQuery, [decision, capsuleId, signer_id]);

      let message = "서명이 완료되었습니다.";

      // 3. (중요) '승인'일 경우, 모든 서명자가 다 승인했는지 확인
      if (decision === 'approved') {
        // 아직 승인 안 한(pending/rejected) 사람이 몇 명인지 셈
        const remainingQuery = `
          SELECT COUNT(*) 
          FROM "CAPSULE_SIGN" 
          WHERE capsule_id = $1 AND sign_status != 'approved'
        `;
        const remainingResult = await client.query(remainingQuery, [capsuleId]);
        const remainingCount = parseInt(remainingResult.rows[0].count);

        // 남은 사람이 0명이면 -> 전원 승인 완료! -> 캡슐 봉인(Sealed)!!
        if (remainingCount === 0) {
          await client.query(`UPDATE "CAPSULE" SET status = 'sealed' WHERE capsule_id = $1`, [capsuleId]);
          message = "모든 서명자가 동의하여 타임캡슐이 봉인되었습니다! 🔒";
        } else {
          message = "승인 완료! 다른 친구들의 동의를 기다립니다.";
        }
      } else {
        message = "서명을 거절했습니다. (캡슐이 봉인되지 않습니다)";
      }

      await client.query('COMMIT');
      return NextResponse.json({ message }, { status: 200 });

    } catch (error: any) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: error.message || "서버 오류" }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Sign Error:", error);
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  }
}