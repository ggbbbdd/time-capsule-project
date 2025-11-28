import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

// 1. 캡슐 목록 가져오기 (GET) - 내가 만든 것 + 초대받은 것
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 6; 
  const offset = (page - 1) * limit; 

  if (!userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  let client;
  try {
    client = await pool.connect();

    // ✨ 쿼리 수정: OWNER이거나 OR 참여자(ROLE)인 경우 모두 조회
    const dataQuery = `
      SELECT DISTINCT c.capsule_id, c.title, c.status, c.unlock_date, c.created_at, c.owner_id
      FROM "CAPSULE" c
      LEFT JOIN "CAPSULE_ROLE" r ON c.capsule_id = r.capsule_id
      WHERE c.owner_id = $1 OR r.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    // 전체 개수 세기 (페이지네이션용)
    const countQuery = `
      SELECT COUNT(DISTINCT c.capsule_id) 
      FROM "CAPSULE" c
      LEFT JOIN "CAPSULE_ROLE" r ON c.capsule_id = r.capsule_id
      WHERE c.owner_id = $1 OR r.user_id = $1;
    `;

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuery, [userId, limit, offset]),
      client.query(countQuery, [userId])
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({ 
      capsules: dataResult.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Fetch Error:", error);
    return NextResponse.json({ message: "조회 실패" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// 2. 캡슐 생성하기 (POST) - 기존과 동일 (유지)
export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { owner_id, title, content, unlock_date } = body;

    if (!owner_id || !title || !unlock_date) {
      return NextResponse.json({ message: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    client = await pool.connect();

    const query = `
      INSERT INTO "CAPSULE" (owner_id, title, content, unlock_date, status)
      VALUES ($1, $2, $3, $4, 'draft') -- 초기 상태는 draft
      RETURNING *;
    `;
    
    const values = [owner_id, title, content, unlock_date];
    const result = await client.query(query, values);

    return NextResponse.json({ 
      message: "캡슐 초안이 생성되었습니다!", 
      capsule: result.rows[0] 
    }, { status: 201 });

  } catch (error) {
    console.error("Create Error:", error);
    return NextResponse.json({ message: "생성 실패", error: String(error) }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}