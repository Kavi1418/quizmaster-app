import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sound } from '../utils/sound';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        login(data.token, data.user);
        navigate('/');
      } else {
        sound.playWrong();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      sound.playWrong();
      setError('Cannot connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-800">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[30rem] h-[30rem] bg-indigo-300/20 rounded-full blur-[100px] animate-bounce-subtle"></div>
        <div className="absolute bottom-[10%] right-[20%] w-[30rem] h-[30rem] bg-cyan-300/20 rounded-full blur-[100px] animate-bounce-subtle" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="z-10 glass p-10 rounded-[2rem] shadow-2xl w-full max-w-md animate-slide-up">
        <h1 className="text-3xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">
          Welcome Back
        </h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-center font-medium animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="text-slate-600 font-medium text-sm mb-1.5 block">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 transition-all shadow-sm placeholder:text-slate-400"
              placeholder="teacher@school.com"
            />
          </div>
          <div>
            <label className="text-slate-600 font-medium text-sm mb-1.5 block">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 transition-all shadow-sm placeholder:text-slate-400"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transform transition-all active:scale-95 disabled:opacity-50 hover:shadow-cyan-200"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-slate-500 text-center mt-8 font-medium">
          Don't have a Host account?{' '}
          <Link to="/signup" onClick={() => sound.playClick()} className="text-indigo-600 hover:text-indigo-500 font-bold transition">
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
