import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈 (pg pool)
import { PoolClient } from 'pg';
import * as bcrypt from 'bcryptjs'; // ✅ 암호화 라이브러리 추가

/**
 * @summary 사용자 생성/회원가입 (POST)
 * @description 새로운 사용자를 USERS 테이블에 등록합니다.
 */
export async function POST(request: Request) {
  let client: PoolClient | undefined;

  try {
    // 1. JSON Body에서 사용자 정보 가져오기
    const {
      username, 
      email,
      password,
    } = await request.json();

    // 2. (유효성 검사) 필수 값 확인 및 비밀번호 길이 확인 (8자)
    if (!username || !email || !password) {
      return NextResponse.json({
        message: "❌ 'username', 'email', 'password'는 필수 항목입니다.",
      }, { status: 400 });
    }
    
    const MIN_PASSWORD_LENGTH = 8;
    if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json({
            message: `❌ 회원가입 실패: 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
        }, { status: 400 }); 
    }

    // 3. DB 클라이언트 연결
    client = await pool.connect();
    
    // --- 트랜잭션 시작 ---
    await client.query('BEGIN');

    // 4. 이메일 중복 확인
    const checkEmailQuery = `
        SELECT user_id FROM "USERS" WHERE "email" = $1;
    `;
    const checkEmailResult = await client.query(checkEmailQuery, [email]);

    if (checkEmailResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({
            message: "❌ 회원가입 실패: 이미 존재하는 이메일 주소입니다.",
        }, { status: 409 });
    }

    // 5. 사용자 이름 중복 확인
    const checkUsernameQuery = `
        SELECT user_id FROM "USERS" WHERE "username" = $1;
    `;
    const checkUsernameResult = await client.query(checkUsernameQuery, [username]);

    if (checkUsernameResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({
            message: "❌ 회원가입 실패: 이미 존재하는 사용자 이름입니다.",
        }, { status: 409 });
    }

    // ✅ 6. 비밀번호 암호화 (핵심 추가 사항)
    // 10은 salt round 수입니다.
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. 새 사용자 INSERT
    // created_at에 NOW()를 추가하여 가입 시간을 자동 기록합니다.
    const insertUserQuery = `
      INSERT INTO "USERS" (username, email, hashed_password, join_date)
      VALUES ($1, $2, $3, NOW())
      RETURNING user_id, username, email, join_date;
    `;
    
    // ⚠️ 중요: password 대신 hashedPassword를 넣어야 합니다.
    const insertUserValues = [username, email, hashedPassword];
    
    const insertResult = await client.query(insertUserQuery, insertUserValues);
    
    await client.query('COMMIT'); // 커밋

    // 8. 성공 시
    const newUser = insertResult.rows[0];
    return NextResponse.json({
      message: "✅ 사용자 계정 생성 성공!",
      user: {
          user_id: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          created_at: newUser.created_at,
      }
    }, { status: 201 });

  } catch (error) {
    // 9. 실패 시 (롤백 시도 및 상세 오류 로깅)
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error("Rollback Attempt Failed:", rollbackError);
      }
    }
    
    const pgError = error as any; 
    console.error("User POST API DB Error (Full Object):", pgError);

    let displayMessage = "❌ 사용자 계정 생성 실패: 데이터베이스 처리 중 알 수 없는 오류 발생.";
    let errorDetail = (pgError instanceof Error) ? pgError.message : String(pgError);

    if (pgError.code) { 
        errorDetail = `[DB Error Code: ${pgError.code}] ${pgError.detail || pgError.message}`;

        if (pgError.code === '23505') { 
            displayMessage = "❌ 회원가입 실패: 데이터 중복 오류입니다 (이메일/사용자 이름).";
        } else if (pgError.code === '22001') { 
            displayMessage = "❌ 회원가입 실패: 입력된 값의 길이가 너무 깁니다.";
        } else if (pgError.code === '23502') { 
            displayMessage = "❌ 회원가입 실패: 필수 필드(NOT NULL)에 값이 누락되었습니다.";
        }
    }
    
    return NextResponse.json({
      message: displayMessage,
      error_detail: errorDetail,
    }, { status: 500 });
  } finally {
    // 10. client 반환 (항상 실행)
    if (client) {
        client.release();
    }
  }
}