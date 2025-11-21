// app/page.tsx

import pool from "@/app/lib/db"; // DB Pool import
import { Fragment } from "react"; // Key prop을 위한 Fragment

// CSS 스타일을 컴포넌트 상단에 정의
const styles = {
  container: { padding: '20px', fontFamily: 'sans-serif' },
  header: { marginTop: '30px', borderBottom: '2px solid #eee', paddingBottom: '5px' },
  table: { borderCollapse: 'collapse', width: '100%', marginTop: '10px' } as const,
  th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f4f4f4', textAlign: 'left' } as const,
  td: { border: '1px solid #ddd', padding: '8px', textAlign: 'left' } as const,
};

// 페이지 컴포넌트 (서버 컴포넌트)
async function Home() {
  
  // 1. 모든 테이블의 데이터를 동시에 가져옵니다.
  const [
    usersData,
    capsulesData,
    rolesData,
    signsData,
    notesData,
    requestsData,
    notificationsData
  ] = await Promise.all([
    pool.query('SELECT * FROM "USERS" ORDER BY user_id DESC'),
    pool.query('SELECT * FROM "CAPSULE" ORDER BY capsule_id DESC'),
    pool.query('SELECT * FROM "CAPSULE_ROLE" ORDER BY capsule_id, role_type'),
    pool.query('SELECT * FROM "CAPSULE_SIGN" ORDER BY sign_id DESC'),
    pool.query('SELECT * FROM "VERIFICATION_NOTE" ORDER BY note_id DESC'),
    pool.query('SELECT * FROM "OWNERSHIP_REQUEST" ORDER BY request_id DESC'),
    pool.query('SELECT * FROM "NOTIFICATION" ORDER BY notif_id DESC')
  ]);

  // 2. 쿼리 결과를 각각의 변수에 저장합니다.
  const tables = {
    USERS: usersData.rows,
    CAPSULE: capsulesData.rows,
    CAPSULE_ROLE: rolesData.rows,
    CAPSULE_SIGN: signsData.rows,
    VERIFICATION_NOTE: notesData.rows,
    OWNERSHIP_REQUEST: requestsData.rows,
    NOTIFICATION: notificationsData.rows,
  };

  // 3. 데이터를 HTML로 렌더링합니다.
  return (
    <div style={styles.container}>
      <h1>👨‍💻 타임캡슐 프로젝트 대시보드 (메인 페이지)</h1>
      <p>(pgAdmin 대신 모든 테이블의 현재 상태를 보여줍니다)</p>

      {/* USERS 테이블 */}
      <h2 style={styles.header}>USERS ({tables.USERS.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>user_id</th>
            <th style={styles.th}>username</th>
            <th style={styles.th}>email</th>
            <th style={styles.th}>join_date</th>
          </tr>
        </thead>
        <tbody>
          {tables.USERS.map((row) => (
            <tr key={row.user_id}>
              <td style={styles.td}>{row.user_id}</td>
              <td style={styles.td}>{row.username}</td>
              <td style={styles.td}>{row.email}</td>
              <td style={styles.td}>{new Date(row.join_date).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CAPSULE 테이블 */}
      <h2 style={styles.header}>CAPSULE ({tables.CAPSULE.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>capsule_id</th>
            <th style={styles.th}>owner_id</th>
            <th style={styles.th}>title</th>
            <th style={styles.th}>status</th>
            <th style={styles.th}>unlock_date</th>
          </tr>
        </thead>
        <tbody>
          {tables.CAPSULE.map((row) => (
            <tr key={row.capsule_id}>
              <td style={styles.td}>{row.capsule_id}</td>
              <td style={styles.td}>{row.owner_id}</td>
              <td style={styles.td}>{row.title}</td>
              <td style={{...styles.td, fontWeight: 'bold'}}>{row.status}</td>
              <td style={styles.td}>{new Date(row.unlock_date).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CAPSULE_ROLE 테이블 */}
      <h2 style={styles.header}>CAPSULE_ROLE ({tables.CAPSULE_ROLE.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>capsule_id</th>
            <th style={styles.th}>user_id</th>
            <th style={styles.th}>role_type</th>
          </tr>
        </thead>
        <tbody>
          {tables.CAPSULE_ROLE.map((row, index) => (
            <tr key={`${row.capsule_id}-${row.user_id}`}>
              <td style={styles.td}>{row.capsule_id}</td>
              <td style={styles.td}>{row.user_id}</td>
              <td style={styles.td}>{row.role_type}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* CAPSULE_SIGN 테이블 */}
      <h2 style={styles.header}>CAPSULE_SIGN ({tables.CAPSULE_SIGN.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>sign_id</th>
            <th style={styles.th}>capsule_id</th>
            <th style={styles.th}>signer_id</th>
            <th style={styles.th}>sign_status</th>
            <th style={styles.th}>reason</th>
          </tr>
        </thead>
        <tbody>
          {tables.CAPSULE_SIGN.map((row) => (
            <tr key={row.sign_id}>
              <td style={styles.td}>{row.sign_id}</td>
              <td style={styles.td}>{row.capsule_id}</td>
              <td style={styles.td}>{row.signer_id}</td>
              <td style={styles.td}>{row.sign_status}</td>
              <td style={styles.td}>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* VERIFICATION_NOTE 테이블 */}
      <h2 style={styles.header}>VERIFICATION_NOTE ({tables.VERIFICATION_NOTE.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>note_id</th>
            <th style={styles.th}>capsule_id</th>
            <th style={styles.th}>verifier_id</th>
            <th style={styles.th}>note</th>
            <th style={styles.th}>created_at</th>
          </tr>
        </thead>
        <tbody>
          {tables.VERIFICATION_NOTE.map((row) => (
            <tr key={row.note_id}>
              <td style={styles.td}>{row.note_id}</td>
              <td style={styles.td}>{row.capsule_id}</td>
              <td style={styles.td}>{row.verifier_id}</td>
              <td style={styles.td}>{row.note}</td>
              <td style={styles.td}>{new Date(row.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* OWNERSHIP_REQUEST 테이블 */}
      <h2 style={styles.header}>OWNERSHIP_REQUEST ({tables.OWNERSHIP_REQUEST.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>request_id</th>
            <th style={styles.th}>capsule_id</th>
            <th style={styles.th}>successor_id</th>
            <th style={styles.th}>approved</th>
            <th style={styles.th}>request_date</th>
          </tr>
        </thead>
        <tbody>
          {tables.OWNERSHIP_REQUEST.map((row) => (
            <tr key={row.request_id}>
              <td style={styles.td}>{row.request_id}</td>
              <td style={styles.td}>{row.capsule_id}</td>
              <td style={styles.td}>{row.successor_id}</td>
              <td style={styles.td}>{String(row.approved)}</td>
              <td style={styles.td}>{new Date(row.request_date).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* NOTIFICATION 테이블 */}
      <h2 style={styles.header}>NOTIFICATION ({tables.NOTIFICATION.length}개)</h2>
      <table style={styles.table}>
        <thead>
          {/* 🚨 수정: <tr>과 <th>를 같은 줄에 붙여서 공백 제거 */}
          <tr><th style={styles.th}>notif_id</th>
            <th style={styles.th}>user_id</th>
            <th style={styles.th}>message</th>
            <th style={styles.th}>sent_at</th>
          </tr>
        </thead>
        <tbody>
          {tables.NOTIFICATION.map((row) => (
            <tr key={row.notif_id}>
              <td style={styles.td}>{row.notif_id}</td>
              <td style={styles.td}>{row.user_id}</td>
              <td style={styles.td}>{row.message}</td>
              <td style={styles.td}>{new Date(row.sent_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Home;