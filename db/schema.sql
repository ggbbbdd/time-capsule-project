
CREATE TABLE "USERS" (
    "user_id"       SERIAL PRIMARY KEY,
    "username"      VARCHAR(100) NOT NULL UNIQUE,
    "hashed_password"      VARCHAR(255) NOT NULL,
    "email"         VARCHAR(255) NOT NULL UNIQUE,
    "join_date"     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. 캡슐 테이블
CREATE TABLE "CAPSULE" (
    "capsule_id"    SERIAL PRIMARY KEY,
    "owner_id"      INT NOT NULL REFERENCES "USERS"("user_id"), -- "USERS" 참조
    "title"         VARCHAR(255) NOT NULL,
    "content"       TEXT,
    "status"        VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'pending_sign', 'sealed', 'unlocked')),
    "unlock_date"   TIMESTAMPTZ NOT NULL,
    "created_at"    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. 캡슐 참여 역할 테이블
CREATE TABLE "CAPSULE_ROLE" (
    "capsule_id"    INT NOT NULL REFERENCES "CAPSULE"("capsule_id") ON DELETE CASCADE,
    "user_id"       INT NOT NULL REFERENCES "USERS"("user_id") ON DELETE CASCADE, -- "USERS" 참조
    "role_type"     VARCHAR(20) NOT NULL CHECK (role_type IN ('creator', 'co-signer', 'verifier', 'successor')),
    PRIMARY KEY ("capsule_id", "user_id")
);

-- 4. 캡슐 서명 테이블
CREATE TABLE "CAPSULE_SIGN" (
    "sign_id"       SERIAL PRIMARY KEY,
    "capsule_id"    INT NOT NULL REFERENCES "CAPSULE"("capsule_id") ON DELETE CASCADE,
    "signer_id"     INT NOT NULL REFERENCES "USERS"("user_id"), -- "USERS" 참조
    "sign_status"   VARCHAR(10) NOT NULL CHECK (sign_status IN ('pending', 'approved', 'rejected')),
    "reason"        TEXT,
    UNIQUE("capsule_id", "signer_id")
);

-- 5. 인증 메모 테이블
CREATE TABLE "VERIFICATION_NOTE" (
    "note_id"       SERIAL PRIMARY KEY,
    "capsule_id"    INT NOT NULL REFERENCES "CAPSULE"("capsule_id"),
    "verifier_id"   INT NOT NULL REFERENCES "USERS"("user_id"), -- "USERS" 참조
    "note"          TEXT NOT NULL,
    "created_at"    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. 소유권 이전 요청 테이블
CREATE TABLE "OWNERSHIP_REQUEST" (
    "request_id"    SERIAL PRIMARY KEY,
    "capsule_id"    INT NOT NULL REFERENCES "CAPSULE"("capsule_id"),
    "successor_id"  INT NOT NULL REFERENCES "USERS"("user_id"), -- "USERS" 참조
    "request_date"  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "approved"      BOOLEAN DEFAULT false,
    UNIQUE("capsule_id", "successor_id")
);

-- 7. 알림 테이블
CREATE TABLE "NOTIFICATION" (
    "notif_id"      SERIAL PRIMARY KEY,
    "user_id"       INT NOT NULL REFERENCES "USERS"("user_id"), -- "USERS" 참조
    "message"       TEXT NOT NULL,
    "sent_at"       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);