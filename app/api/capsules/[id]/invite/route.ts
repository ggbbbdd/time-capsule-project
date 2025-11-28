import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

// 친구 초대하기 (POST)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const capsuleId = id;

  try {
    const { email } = await request.json(); // 초대할 친구 이메일

    if (!email) return NextResponse.json({ message: "이메일을 입력해주세요." }, { status: 400 });

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN'); // 트랜잭션 시작

      // 1. 캡슐 상태 확인 (draft 상태에서만 초대 가능) 
      const capsuleCheck = await client.query(
        `SELECT status, owner_id FROM "CAPSULE" WHERE capsule_id = $1`, 
        [capsuleId]
      );
      
      if (capsuleCheck.rows.length === 0) throw new Error("캡슐이 없습니다.");
      if (capsuleCheck.rows[0].status !== 'draft') {
        throw new Error("초안(draft) 상태에서만 서명자를 초대할 수 있습니다.");
      }

      // 2. 이메일로 친구 찾기
      const userCheck = await client.query(
        `SELECT user_id FROM "USERS" WHERE email = $1`, 
        [email]
      );

      if (userCheck.rows.length === 0) {
        throw new Error("가입되지 않은 이메일입니다. 친구에게 먼저 가입하라고 해주세요!");
      }
      const friendId = userCheck.rows[0].user_id;

      // 3. 본인을 초대하는지 체크
      if (friendId === capsuleCheck.rows[0].owner_id) {
        throw new Error("자기 자신은 공동 서명자가 될 수 없습니다.");
      }

      // 4. 역할 부여 (CAPSULE_ROLE)
      // 이미 초대된 경우 에러 방지를 위해 ON CONFLICT 사용 가능하지만, 여기선 로직으로 체크
      const roleCheck = await client.query(
        `SELECT * FROM "CAPSULE_ROLE" WHERE capsule_id = $1 AND user_id = $2`,
        [capsuleId, friendId]
      );
      
      if (roleCheck.rows.length > 0) {
        throw new Error("이미 초대된 사용자입니다.");
      }

      // 역할 추가 (Co-Signer)
      await client.query(
        `INSERT INTO "CAPSULE_ROLE" (capsule_id, user_id, role_type) VALUES ($1, $2, 'co-signer')`,
        [capsuleId, friendId]
      );

      // 5. 서명 상태 초기화 (CAPSULE_SIGN) - 'pending' 상태로 시작
      await client.query(
        `INSERT INTO "CAPSULE_SIGN" (capsule_id, signer_id, sign_status) VALUES ($1, $2, 'pending')`,
        [capsuleId, friendId]
      );

      await client.query('COMMIT'); // 성공 시 커밋

      return NextResponse.json({ message: "친구를 공동 서명자로 초대했습니다!" }, { status: 200 });

    } catch (error: any) {
      await client.query('ROLLBACK'); // 실패 시 롤백
      return NextResponse.json({ message: error.message || "서버 오류" }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Invite Error:", error);
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  }
}