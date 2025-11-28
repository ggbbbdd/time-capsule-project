'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 이미 로그인되어 있으면 대시보드로 납치
  useEffect(() => {
    if (localStorage.getItem('authToken')) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const endpoint = isRegistering ? '/api/users' : '/api/auth/login';
    const body = isRegistering ? { username, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || '오류 발생');

      if (isRegistering) {
        alert('회원가입 성공! 로그인해주세요.');
        setIsRegistering(false);
      } else {
        // 로그인 성공 시 토큰 저장 후 이동
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('username', data.username);
        router.push('/dashboard'); // 대시보드로 이동!
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-700">
          {isRegistering ? '타임캡슐 계정 생성' : '타임캡슐 로그인'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <input 
              type="text" placeholder="이름" value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full p-3 border rounded-lg" required 
            />
          )}
          <input 
            type="email" placeholder="이메일" value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full p-3 border rounded-lg" required 
          />
          <input 
            type="password" placeholder="비밀번호" value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full p-3 border rounded-lg" required 
          />
          <button 
            disabled={isLoading} 
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition-colors"
          >
            {isLoading ? '처리 중...' : (isRegistering ? '가입하기' : '로그인')}
          </button>
        </form>
        <button 
          onClick={() => setIsRegistering(!isRegistering)} 
          className="w-full mt-4 text-sm text-indigo-500 hover:underline"
        >
          {isRegistering ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </div>
    </div>
  );
}