import { NextResponse } from 'next/server';
import pool from '@/app/lib/db'; // DB 연결 모듈 (pg pool)
import { PoolClient } from 'pg';

/**
 * @summary 사용자 생성/회원가입 (POST)
 * @description 새로운 사용자를 USERS 테이블에 등록합니다.
 */
export async function POST(request: Request) {
  let client: PoolClient | undefined; // client 변수를 PoolClient 타입으로 정의

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

    // 6. 새 사용자 INSERT (DB 컬럼 이름과 매핑 확인)
    const insertUserQuery = `
      INSERT INTO "USERS" (username, email, password)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email, join_date;
    `;
    // 경고: 실제 환경에서는 password를 저장하기 전에 bcrypt와 같은 라이브러리를 사용하여 해시해야 합니다.
    // 현재는 사용자의 DB 구조를 유지하기 위해 평문을 사용합니다.
    const insertUserValues = [username, email, password];
    
    const insertResult = await client.query(insertUserQuery, insertUserValues);
    
    await client.query('COMMIT'); // 커밋

    // 7. 성공 시
    const newUser = insertResult.rows[0];
    return NextResponse.json({
      message: "✅ 사용자 계정 생성 성공!",
      user: {
          user_id: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          join_date: newUser.join_date,
      }
    }, { status: 201 });

  } catch (error) {
    // 8. 실패 시 (롤백 시도 및 상세 오류 로깅)
    
    // 트랜잭션 도중 오류가 발생했다면 ROLLBACK을 시도합니다.
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // 롤백 실패는 무시하지만 로그에 남깁니다.
        console.error("Rollback Attempt Failed:", rollbackError);
      }
    }
    
    // Postgres 오류 객체에서 상세 정보를 추출합니다.
    const pgError = error as any; 
    console.error("User POST API DB Error (Full Object):", pgError);

    let displayMessage = "❌ 사용자 계정 생성 실패: 데이터베이스 처리 중 알 수 없는 오류 발생.";
    let errorDetail = (pgError instanceof Error) ? pgError.message : String(pgError);

    if (pgError.code) { // PostgreSQL specific error codes (e.g., '23505' for unique violation)
        errorDetail = `[DB Error Code: ${pgError.code}] ${pgError.detail || pgError.message}`;

        if (pgError.code === '23505') { // unique_violation
            displayMessage = "❌ 회원가입 실패: 데이터 중복 오류입니다 (이메일/사용자 이름).";
        } else if (pgError.code === '22001') { // string_data_right_truncation (value too long)
            displayMessage = "❌ 회원가입 실패: 입력된 값(예: 사용자 이름, 이메일, 비밀번호)의 길이가 너무 깁니다.";
        } else if (pgError.code === '23502') { // not_null_violation
            displayMessage = "❌ 회원가입 실패: 필수 필드(NOT NULL)에 값이 누락되었습니다.";
        }
    }
    
    return NextResponse.json({
      message: displayMessage,
      error_detail: errorDetail,
      // 이전 콜 스택과 혼동하지 않도록 500 에러를 반환합니다.
    }, { status: 500 });
  } finally {
    // 9. client 반환 (항상 실행)
    if (client) {
        client.release();
    }
  }
}
