import { API_URL } from "../config";
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Play, LogOut, User as UserIcon, Store, ShoppingBag } from 'lucide-react'
import { socket } from '../socket'
import { useAuth } from '../context/AuthContext'
import { sound } from '../utils/sound'

const SHOP_ITEMS = [
  { id: 'border_gold', name: 'Golden Crown Border', cost: 1000, style: 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]' },
  { id: 'border_diamond', name: 'Diamond Border', cost: 5000, style: 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)]' },
  { id: 'border_fire', name: 'Fire Aura Border', cost: 10000, style: 'border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.9)]' }
];

export default function Home() {
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  })
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState<any[]>([])
  
  const [showShop, setShowShop] = useState(false)
  const [shopData, setShopData] = useState<{coins: number, unlockedItems: string[]}>({coins: 0, unlockedItems: []})
  const [equippedBorder, setEquippedBorder] = useState<string | null>(null);

  const handleJoin = () => {
    sound.playClick();
    if (!roomCode || !username) {
      setError('Please enter a room code and a nickname.');
      return;
    }
    
    socket.connect();
    socket.emit('join_room', { roomCode: roomCode.toUpperCase(), username, isHost: false }, (response: any) => {
      if (response?.success) {
        navigate(`/game/${roomCode.toUpperCase()}`, { 
           state: { 
              isHost: false, 
              username, 
              isAutoStart: response.isAutoStart,
              questions: response.questions,
              quizId: response.quizId
           } 
        });
      } else {
        setError(response?.error || 'Failed to join room');
      }
    });
  }

  const handleHostClick = () => {
    sound.playClick();
    if (user && user.role === 'HOST') {
      navigate('/host');
    } else {
      navigate('/login');
    }
  }

  const fetchLeaderboard = async () => {
    sound.playClick();
    setShowLeaderboard(true);
    try {
      const res = await fetch(`${API_URL}/api/leaderboard`);
      const data = await res.json();
      if (data.success) {
        setLeaderboardData(data.leaderboard);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const fetchShop = async () => {
    sound.playClick();
    setShowShop(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/shop`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setShopData({ coins: data.coins, unlockedItems: data.unlockedItems });
      }
    } catch (err) {
      console.error(err);
    }
  }

  const buyItem = async (itemId: string, cost: number) => {
    sound.playClick();
    if (shopData.coins < cost) return alert("Not enough coins!");
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ itemId, cost })
      });
      const data = await res.json();
      if (data.success) {
        sound.playFinished();
        setShopData({ coins: data.coins, unlockedItems: data.unlockedItems });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const currentBorderStyle = equippedBorder ? SHOP_ITEMS.find(i => i.id === equippedBorder)?.style : 'border-white';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-800 transition-colors">
      
      {/* Top Right Auth Bar */}
      <div className="absolute top-4 right-4 flex gap-4 items-center z-20">
        {user ? (
          <div className="flex items-center gap-4 glass px-5 py-2 rounded-full border border-slate-200">
            <span className="flex items-center gap-2 text-slate-700 font-medium">
              <UserIcon className="w-5 h-5 text-indigo-500" />
              {user.username}
            </span>
            <button 
              onClick={() => { sound.playClick(); logout(); }}
              className="text-rose-500 hover:text-rose-600 transition flex items-center gap-1 text-sm font-bold"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { sound.playClick(); navigate('/login'); }}
            className="bg-white/80 backdrop-blur-md hover:bg-white text-indigo-600 font-bold py-2.5 px-6 rounded-full transition border border-indigo-100 shadow-sm hover:shadow-md"
          >
            Login / Signup
          </button>
        )}
      </div>

      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-300/30 rounded-full blur-[100px] animate-bounce-subtle"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-cyan-300/30 rounded-full blur-[100px] animate-bounce-subtle" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="z-10 flex flex-col md:flex-row gap-8 w-full max-w-4xl justify-center items-stretch animate-slide-up">
        
        {/* Student Profile Dashboard (Only if logged in as Student) */}
        {user && user.role === 'STUDENT' && (
          <div className="glass p-8 rounded-[2rem] w-full md:w-1/3 flex flex-col items-center justify-center relative">
            <h2 className="text-xl font-bold text-slate-700 mb-6">Student Profile</h2>
            <img 
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`} 
              alt="Avatar" 
              className={`w-32 h-32 bg-indigo-100 rounded-full border-4 shadow-lg mb-4 transition-all duration-500 ${currentBorderStyle}`}
            />
            <h3 className="text-2xl font-black text-indigo-600 mb-2">{user.username}</h3>
            
            <div className="w-full bg-slate-100 rounded-xl p-4 text-center mb-4 border border-slate-200">
              <span className="block text-sm text-slate-500 font-bold uppercase tracking-wider">Total Score</span>
              <span className="text-3xl font-black text-slate-800">{user.totalScore || 0}</span>
            </div>

            <button 
              onClick={fetchLeaderboard}
              className="w-full mb-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transform active:scale-95 transition flex items-center justify-center gap-2"
            >
              Global Leaderboard
            </button>
            <button 
              onClick={fetchShop}
              className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transform active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Store className="w-5 h-5" /> Avatar Shop
            </button>
          </div>
        )}

        {/* Main Join Game Card */}
        <div className="glass p-10 rounded-[2rem] max-w-md w-full transform transition-all hover:scale-[1.01] relative group flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-tr from-indigo-500 to-cyan-400 p-4 rounded-2xl shadow-lg shadow-indigo-200">
              <Brain className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">
            QuizMaster
          </h1>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-center font-medium animate-fade-in">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="Enter Room Code" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full bg-white/70 border border-slate-200 rounded-xl px-5 py-4 text-slate-800 text-lg focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 transition-all font-mono uppercase tracking-widest text-center shadow-sm placeholder:text-slate-400"
            />
            <input 
              type="text" 
              placeholder="Your Nickname" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/70 border border-slate-200 rounded-xl px-5 py-4 text-slate-800 text-lg focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all text-center shadow-sm placeholder:text-slate-400"
            />
            <button 
              onClick={handleJoin}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transform transition-all active:scale-95 flex items-center justify-center gap-2 text-xl hover:shadow-cyan-200"
            >
              <Play className="w-6 h-6 fill-current" />
              Join Game
            </button>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200/50 text-center">
            <p className="text-slate-500 mb-3 font-medium">Teachers: Create your own quiz!</p>
            <button 
              onClick={handleHostClick}
              className="text-indigo-600 hover:text-indigo-500 font-bold transition flex items-center justify-center mx-auto gap-2 group/host"
            >
              {user && user.role === 'HOST' ? 'Go to Host Dashboard' : 'Host a Quiz'}
              <span className="transform transition-transform group-hover/host:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* LEADERBOARD MODAL */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowLeaderboard(false)}></div>
          <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 border border-white/50 animate-slide-up flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-400 flex items-center gap-3">
                Global Leaderboard
              </h2>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-3">
              {leaderboardData.map((player: any, i: number) => (
                <div key={i} className={`flex items-center justify-between px-5 py-4 rounded-xl border shadow-sm ${i === 0 ? 'bg-amber-50 border-amber-200' : i === 1 ? 'bg-slate-100 border-slate-300' : i === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-xl w-8 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                      #{i + 1}
                    </span>
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-200 border border-white" />
                    <span className="font-bold text-lg text-slate-700">{player.username}</span>
                  </div>
                  <span className="font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                    {player.totalScore} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHOP MODAL */}
      {showShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowShop(false)}></div>
          <div className="relative w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 border border-white/50 animate-slide-up flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 flex items-center gap-3">
                <Store className="w-8 h-8 text-emerald-500" /> Avatar Shop
              </h2>
              <div className="flex items-center gap-4">
                <span className="font-black text-xl text-amber-500 bg-amber-50 px-4 py-2 rounded-full border border-amber-200">
                  {shopData.coins} Coins
                </span>
                <button onClick={() => setShowShop(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">✕</button>
              </div>
            </div>
            
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SHOP_ITEMS.map((item) => {
                const isUnlocked = shopData.unlockedItems.includes(item.id);
                const isEquipped = equippedBorder === item.id;
                
                return (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col items-center text-center gap-4 transition hover:shadow-md hover:border-emerald-200">
                    <div className={`w-20 h-20 rounded-full bg-slate-100 border-4 ${item.style}`}></div>
                    <div>
                      <h3 className="font-bold text-slate-800">{item.name}</h3>
                      {!isUnlocked && <p className="font-bold text-amber-500">{item.cost} Coins</p>}
                    </div>
                    
                    {isUnlocked ? (
                       <button 
                         onClick={() => setEquippedBorder(isEquipped ? null : item.id)}
                         className={`w-full py-2 rounded-xl font-bold transition ${isEquipped ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                       >
                         {isEquipped ? 'Unequip' : 'Equip'}
                       </button>
                    ) : (
                       <button 
                         onClick={() => buyItem(item.id, item.cost)}
                         disabled={shopData.coins < item.cost}
                         className="w-full py-2 rounded-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 text-white disabled:opacity-50 disabled:grayscale transition hover:shadow-lg active:scale-95"
                       >
                         <ShoppingBag className="w-4 h-4 inline mr-1 mb-0.5" /> Buy
                       </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
