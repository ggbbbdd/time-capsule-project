-- VERIFICATION_NOTE 테이블에 중복 승인 방지를 위한 UNIQUE 제약 추가
-- 같은 인증자가 같은 캡슐에 대해 여러 번 승인하는 것을 방지

ALTER TABLE "VERIFICATION_NOTE"
ADD CONSTRAINT "verification_note_unique_capsule_verifier" 
UNIQUE ("capsule_id", "verifier_id");

-- 기존 중복 데이터가 있다면 먼저 정리해야 할 수 있습니다
-- 중복 데이터 확인 쿼리:
-- SELECT capsule_id, verifier_id, COUNT(*) 
-- FROM "VERIFICATION_NOTE" 
-- GROUP BY capsule_id, verifier_id 
-- HAVING COUNT(*) > 1;

-- 중복 데이터가 있다면, 가장 최근 것만 남기고 나머지 삭제:
-- DELETE FROM "VERIFICATION_NOTE" 
-- WHERE note_id NOT IN (
--     SELECT MAX(note_id) 
--     FROM "VERIFICATION_NOTE" 
--     GROUP BY capsule_id, verifier_id
-- );

