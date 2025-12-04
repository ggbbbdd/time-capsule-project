import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

/**
 * 계승자(Successor) 요청 등록 API
 * 특정 캡슐에 대한 계승 요청을 등록합니다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = parseInt(id);

  let client;
  try {
    const { email, reason } = await request.json();

    if (!email) {
      return NextResponse.json({ message: "이메일을 입력해주세요." }, { status: 400 });
    }

    if (isNaN(capsuleId)) {
      return NextResponse.json({ message: "유효한 캡슐 ID가 필요합니다." }, { status: 400 });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // 1. 캡슐 존재 및 상태 확인
    const capsuleCheck = await client.query(
      `SELECT owner_id, status FROM "CAPSULE" WHERE capsule_id = $1`,
      [capsuleId]
    );

    if (capsuleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "캡슐을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. 이메일로 계승자 찾기
    const userCheck = await client.query(
      `SELECT user_id FROM "USERS" WHERE email = $1`,
      [email]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "가입되지 않은 이메일입니다." }, { status: 404 });
    }

    const successorId = userCheck.rows[0].user_id;

    // 3. 이미 계승 요청이 있는지 확인
    const existingRequest = await client.query(
      `SELECT request_id FROM "OWNERSHIP_REQUEST" 
       WHERE capsule_id = $1 AND successor_id = $2`,
      [capsuleId, successorId]
    );

    if (existingRequest.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: "이미 계승 요청이 등록되어 있습니다." }, { status: 400 });
    }

    // 4. 계승 요청 등록
    await client.query(
      `INSERT INTO "OWNERSHIP_REQUEST" (capsule_id, successor_id, request_date, approved)
       VALUES ($1, $2, NOW(), false)`,
      [capsuleId, successorId]
    );

    // 5. CAPSULE_ROLE에 successor 역할 추가 (요청 단계에서 미리 추가)
    await client.query(
      `INSERT INTO "CAPSULE_ROLE" (capsule_id, user_id, role_type)
       VALUES ($1, $2, 'successor')
       ON CONFLICT (capsule_id, user_id) DO NOTHING`,
      [capsuleId, successorId]
    );

    await client.query('COMMIT');

    return NextResponse.json({ 
      message: "계승 요청이 등록되었습니다. 승인 대기 중입니다." 
    }, { status: 200 });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error("Successor Request Error:", error);
    return NextResponse.json({ 
      message: error.message || "계승 요청 등록 중 오류가 발생했습니다." 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

/**
 * 계승 요청 목록 조회 API
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = parseInt(id);

  let client;
  try {
    if (isNaN(capsuleId)) {
      return NextResponse.json({ message: "유효한 캡슐 ID가 필요합니다." }, { status: 400 });
    }

    client = await pool.connect();

    const result = await client.query(
      `SELECT 
        or.request_id,
        or.successor_id,
        or.request_date,
        or.approved,
        u.username,
        u.email
       FROM "OWNERSHIP_REQUEST" or
       JOIN "USERS" u ON or.successor_id = u.user_id
       WHERE or.capsule_id = $1
       ORDER BY or.request_date DESC`,
      [capsuleId]
    );

    return NextResponse.json({ 
      requests: result.rows 
    }, { status: 200 });

  } catch (error) {
    console.error("Successor Request List Error:", error);
    return NextResponse.json({ 
      message: "계승 요청 목록 조회 중 오류가 발생했습니다." 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

