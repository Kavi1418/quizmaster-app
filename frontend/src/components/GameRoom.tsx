import { API_URL } from "../config";
import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { socket } from '../socket'
import { sound } from '../utils/sound'
import { Clock, Flame, Zap, Snowflake, EyeOff } from 'lucide-react'
import confetti from 'canvas-confetti'



export default function GameRoom() {
  const { roomId } = useParams();
  const location = useLocation();
  const { isHost, username, isAutoStart, initialQuestions, questions: studentQuestions, quizId, theme, gameMode = 'classic' } = location.state || {};
  
  const [gameState, setGameState] = useState<'waiting' | 'active' | 'leaderboard' | 'finished'>(
    (isAutoStart && !isHost) || isHost ? 'active' : 'waiting'
  );
  
  const [questions] = useState<any[]>(initialQuestions || studentQuestions || []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  
  // New Premium Features State
  const [timeLeft, setTimeLeft] = useState(20);
  const [streak, setStreak] = useState(0);
  const [answerCounts, setAnswerCounts] = useState<number[]>([0, 0, 0, 0]);
  const [podium, setPodium] = useState<{username: string, score: number}[]>([]);
  
  // Power-ups
  const [inventory, setInventory] = useState<string[]>(['2x', '50-50', 'freeze']); // 1 of each for demo
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [actionLog, setActionLog] = useState<string>('');
  
  // New Game Modes
  const [bossHealth, setBossHealth] = useState(10000);
  const [myTeam, setMyTeam] = useState<'red'|'blue'|null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');

  useEffect(() => {
    if (gameMode === 'teams' && !isHost) {
      setMyTeam(username.length % 2 === 0 ? 'red' : 'blue');
    }
  }, [gameMode, isHost, username]);

  useEffect(() => {
    if (theme === 'cyberpunk') {
      document.body.classList.add('theme-cyberpunk');
    }
    return () => document.body.classList.remove('theme-cyberpunk');
  }, [theme]);

  useEffect(() => {
    socket.on('quiz_started', () => {
      sound.playFinished(); 
      setGameState('active');
    });

    socket.on('player_answered', ({ optionIndex }) => {
      setAnswerCounts(prev => {
        const newCounts = [...prev];
        if (optionIndex >= 0 && optionIndex < 4) newCounts[optionIndex]++;
        return newCounts;
      });
    });

    socket.on('player_score_updated', (player) => {
      setPodium(prev => {
        const existing = prev.find(p => p.username === player.username);
        let newPodium;
        if (existing) {
          newPodium = prev.map(p => p.username === player.username ? { ...p, score: player.score } : p);
        } else {
          newPodium = [...prev, { username: player.username, score: player.score }];
        }
        return newPodium.sort((a, b) => b.score - a.score);
      });
    });

    socket.on('powerup_used', ({ username: fromUser, powerupType }) => {
      if (!isHost && powerupType === 'freeze' && fromUser !== username) {
        // Simple global freeze: if someone uses freeze, everyone else freezes!
        setIsFrozen(true);
        setActionLog(`${fromUser} froze the screen!`);
        setTimeout(() => setIsFrozen(false), 3000);
        setTimeout(() => setActionLog(''), 4000);
      }
    });

    socket.on('boss_damaged', ({ username: dmgUser, damage }) => {
      setBossHealth(prev => Math.max(0, prev - damage));
      if (!isHost) setActionLog(`${dmgUser} dealt ${damage} DMG!`);
      setTimeout(() => setActionLog(''), 2000);
    });

    return () => {
      socket.off('quiz_started');
      socket.off('player_answered');
      socket.off('player_score_updated');
      socket.off('powerup_used');
      socket.off('boss_damaged');
    };
  }, [isHost, username]);

  // Timer logic
  useEffect(() => {
    if (gameState === 'active' && timeLeft > 0 && selectedOption === null) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (gameState === 'active' && timeLeft === 0 && selectedOption === null && !isHost) {
      // Time up! Auto-wrong
      handleOptionClick(-1); // -1 means no option selected (time up)
    }
  }, [gameState, timeLeft, selectedOption, isHost]);

  // Host auto-advance logic based on timer
  useEffect(() => {
    if (isHost && gameState === 'active' && timeLeft === 0) {
      const timer = setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setTimeLeft(20);
          setAnswerCounts([0, 0, 0, 0]);
        } else {
          sound.playFinished();
          setGameState('finished');
        }
      }, 3000); // Host waits 3 seconds on results before next question
      return () => clearTimeout(timer);
    }
  }, [isHost, gameState, timeLeft, currentQuestionIndex, questions.length]);


  useEffect(() => {
    if (gameState === 'finished' && !isHost && quizId) {
      fetch(`${API_URL}/api/quizzes/${quizId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: username, score })
      }).catch(err => console.error("Failed to save score:", err));
    }
    
    // Confetti celebration if good score or first place
    if (gameState === 'finished' && !isHost) {
       setTimeout(() => {
         if (score >= 1000 || (podium[0] && podium[0].username === username)) {
           confetti({
             particleCount: 150,
             spread: 70,
             origin: { y: 0.6 },
             colors: ['#4f46e5', '#06b6d4', '#f59e0b', '#ec4899', '#10b981']
           });
         }
       }, 1000);
    }
  }, [gameState, isHost, quizId, username, score, podium]);

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null || isHost) return; 
    setSelectedOption(index);
    
    // Emit answer for host analytics
    if (index !== -1) {
      socket.emit('player_answered', { roomCode: roomId, questionIndex: currentQuestionIndex, optionIndex: index });
    }
    
    // TYPE_ANSWER validation
    let isCorrect = false;
    if (currentQ.type === 'TYPE_ANSWER') {
      isCorrect = typedAnswer.trim().toLowerCase() === (currentQ.correctText || '').trim().toLowerCase();
    } else {
      isCorrect = index === currentQ?.correctOptionIndex;
    }
    
    if (isCorrect) {
       sound.playCorrect();
       const newStreak = streak + 1;
       setStreak(newStreak);
       
       // Calculate Speed Points & Streak Bonus
       const basePoints = 500;
       const speedBonus = Math.floor((timeLeft / 20) * 500);
       let streakMult = 1;
       if (newStreak >= 5) streakMult = 2;
       else if (newStreak >= 3) streakMult = 1.5;
       
       const pointsEarned = Math.floor((basePoints + speedBonus) * streakMult * activeMultiplier);
       
       if (gameMode === 'boss') {
         socket.emit('boss_damaged', { roomCode: roomId, username, damage: pointsEarned });
       }
       
       setScore(prev => {
          const newScore = prev + pointsEarned;
          socket.emit('update_score', { roomCode: roomId, username, score: newScore });
          return newScore;
       });
    } else {
       sound.playWrong();
       setStreak(0);
       socket.emit('update_score', { roomCode: roomId, username, score }); // Sync score even if wrong to ensure they are on leaderboard
    }
  };

  const submitTypedAnswer = () => {
    if (selectedOption !== null || isHost) return;
    handleOptionClick(0); // Pass dummy index for type answer
  };

  // Student auto-advance logic
  useEffect(() => {
    if (selectedOption !== null && gameState === 'active' && !isHost) {
      const timer = setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
          setSelectedOption(null);
          setTypedAnswer('');
          setTimeLeft(20);
          setActiveMultiplier(1);
          setHiddenOptions([]);
        } else {
          sound.playFinished();
          setGameState('finished');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedOption, currentQuestionIndex, questions.length, gameState, isHost]);

  const currentQ = questions[currentQuestionIndex];

  const handleUsePowerup = (type: string) => {
    sound.playClick();
    setInventory(prev => prev.filter(p => p !== type));
    if (type === '2x') {
       setActiveMultiplier(2);
       setActionLog('2x Points Active!');
    } else if (type === '50-50') {
       const wrong = [0,1,2,3].filter(i => i !== currentQ.correctOptionIndex);
       setHiddenOptions([wrong[0], wrong[1]]);
       setActionLog('50/50 Activated!');
    } else if (type === 'freeze') {
       socket.emit('use_powerup', { roomCode: roomId, username, powerupType: 'freeze' });
       setActionLog('You froze everyone!');
    }
    setTimeout(() => setActionLog(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col items-center justify-center p-4 relative text-slate-800 overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-300/30 rounded-full blur-[100px] animate-bounce-subtle"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-cyan-300/30 rounded-full blur-[100px] animate-bounce-subtle" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="z-10 w-full max-w-4xl text-center">
        {gameState === 'waiting' && (
          <div className="glass p-16 rounded-[2rem] animate-slide-up">
            <h1 className="text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500 animate-pulse">Waiting for Host...</h1>
            <p className="text-2xl text-slate-600 font-medium">Get ready, <span className="font-bold text-indigo-600">{username}</span>! Room: {roomId}</p>
          </div>
        )}
        
        {gameState === 'active' && currentQ && (
          <div className="glass p-8 md:p-12 rounded-[2rem] animate-slide-up relative group">
            
            {/* Top Bar: Progress, Timer, Score */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-500 font-bold tracking-wider uppercase text-sm bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                Q {currentQuestionIndex + 1} / {questions.length}
              </span>
              
              <div className={`flex items-center gap-2 font-black text-2xl px-5 py-2 rounded-full shadow-sm border ${timeLeft <= 5 ? 'bg-rose-100 text-rose-600 border-rose-200 animate-pulse' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
                <Clock className="w-6 h-6" />
                {timeLeft}s
              </div>

              {!isHost && (
                <div className="flex items-center gap-3">
                  {streak >= 3 && (
                    <span className="flex items-center gap-1 text-orange-500 font-black bg-orange-50 px-3 py-1.5 rounded-full border border-orange-200 shadow-sm animate-bounce">
                      <Flame className="w-5 h-5 fill-current" /> {streak}
                    </span>
                  )}
                  <span className="text-indigo-600 font-bold bg-indigo-50 px-5 py-2 rounded-full border border-indigo-200 shadow-sm text-lg">
                    {score} pts
                  </span>
                  {gameMode === 'teams' && myTeam && (
                    <span className={`font-bold px-3 py-1.5 rounded-full border text-sm uppercase ${myTeam === 'red' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                      {myTeam} Team
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Game Mode Overlays */}
            {gameMode === 'boss' && (
              <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-black text-slate-700 text-lg flex items-center gap-2">Raid Boss</span>
                  <span className="font-bold text-rose-500">{bossHealth} / 10000 HP</span>
                </div>
                <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300" style={{ width: `${Math.max(0, (bossHealth / 10000) * 100)}%` }}></div>
                </div>
              </div>
            )}
            
            {gameMode === 'teams' && (
              <div className="mb-8 flex items-center justify-between gap-4">
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <span className="block text-red-600 font-bold text-sm uppercase">Red Team</span>
                  <span className="text-2xl font-black text-red-700">{podium.filter(p => p.username.length % 2 === 0).reduce((acc, p) => acc + p.score, 0)}</span>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <span className="block text-blue-600 font-bold text-sm uppercase">Blue Team</span>
                  <span className="text-2xl font-black text-blue-700">{podium.filter(p => p.username.length % 2 !== 0).reduce((acc, p) => acc + p.score, 0)}</span>
                </div>
              </div>
            )}

            {/* Timer Progress Bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full mb-8 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 linear ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                style={{ width: `${(timeLeft / 20) * 100}%` }}
              ></div>
            </div>
            
            {currentQ.imageUrl && (
              <div className="mb-6 flex justify-center">
                {currentQ.imageUrl.includes('youtube.com/watch?v=') || currentQ.imageUrl.includes('youtu.be/') ? (
                  <iframe 
                    width="560" 
                    height="315" 
                    src={`https://www.youtube.com/embed/${currentQ.imageUrl.includes('v=') ? currentQ.imageUrl.split('v=')[1].split('&')[0] : currentQ.imageUrl.split('youtu.be/')[1].split('?')[0]}?autoplay=1&mute=1`} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                    className="max-h-64 rounded-2xl shadow-md border-4 border-white"
                  ></iframe>
                ) : (
                  <img src={currentQ.imageUrl} alt="Question" className="max-h-64 rounded-2xl shadow-md border-4 border-white object-contain" />
                )}
              </div>
            )}

            <h2 className={`font-extrabold mb-10 leading-tight text-slate-800 ${currentQ.imageUrl ? 'text-2xl md:text-4xl' : 'text-3xl md:text-5xl'}`}>
              {currentQ.questionText}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative">
              
              {/* Frozen Overlay */}
              {isFrozen && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-cyan-100/40 backdrop-blur-[2px] rounded-2xl animate-pulse pointer-events-none">
                  <Snowflake className="w-24 h-24 text-cyan-500 animate-spin-slow" />
                </div>
              )}

              {currentQ.type === 'TYPE_ANSWER' ? (
                <div className="col-span-1 md:col-span-2">
                  {isHost ? (
                    <div className="p-8 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-center text-emerald-800 font-bold text-2xl">
                      Correct Answer: {currentQ.correctText}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <input 
                        type="text"
                        value={typedAnswer}
                        onChange={(e) => setTypedAnswer(e.target.value)}
                        disabled={selectedOption !== null || timeLeft === 0 || isFrozen}
                        placeholder="Type your answer here..."
                        className="w-full bg-white border-2 border-slate-200 rounded-2xl px-6 py-5 text-2xl font-bold focus:outline-none focus:border-indigo-400 text-slate-800 placeholder:text-slate-400 shadow-inner"
                        onKeyDown={(e) => e.key === 'Enter' && submitTypedAnswer()}
                      />
                      <button 
                        onClick={submitTypedAnswer}
                        disabled={selectedOption !== null || timeLeft === 0 || isFrozen || !typedAnswer.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition active:scale-95 text-xl"
                      >
                        Submit Answer
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {currentQ.options.map((opt: string, idx: number) => {
                    if (hiddenOptions.includes(idx)) {
                       return (
                         <div key={idx} className="p-5 md:p-6 rounded-2xl border-2 border-slate-100 bg-slate-50/50 opacity-20 flex items-center justify-center">
                            <EyeOff className="w-8 h-8 text-slate-300" />
                         </div>
                       );
                    }

                    let btnStyle = "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-100 text-slate-700";
                    
                    if (isHost) {
                      // Host view: always show correct answer if time is up
                      if (timeLeft === 0 && idx === currentQ.correctOptionIndex) {
                        btnStyle = "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-lg font-bold";
                      } else {
                        btnStyle = "bg-slate-50 border-slate-200 cursor-default";
                      }
                    } else if (selectedOption !== null || timeLeft === 0) {
                       if (idx === currentQ.correctOptionIndex) {
                          btnStyle = "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-lg shadow-emerald-100 font-bold transform scale-[1.02]";
                       } else if (idx === selectedOption) {
                          btnStyle = "bg-rose-50 border-rose-400 text-rose-700 shadow-lg shadow-rose-100 font-bold transform scale-[1.02]";
                       } else {
                          btnStyle = "bg-slate-50 border-slate-200 opacity-40 cursor-default";
                       }
                    }

                    return (
                      <button 
                        key={idx}
                        onClick={() => handleOptionClick(idx)}
                        disabled={selectedOption !== null || isHost || timeLeft === 0 || isFrozen}
                        className={`relative p-5 md:p-6 text-left rounded-2xl border-2 transition-all duration-300 text-xl font-semibold shadow-sm flex items-center overflow-hidden ${btnStyle} ${(selectedOption === null && !isHost && timeLeft > 0 && !isFrozen) && 'active:scale-95'}`}
                      >
                        {isHost && (
                          <div className="absolute inset-0 bg-indigo-100/50 z-0 transition-all duration-500" style={{ width: `${answerCounts[idx] > 0 ? (answerCounts[idx] / Math.max(...answerCounts, 1)) * 100 : 0}%` }}></div>
                        )}
                        <div className="relative z-10 flex items-center w-full">
                          <span className={`mr-4 font-black text-xl w-10 h-10 flex items-center justify-center shrink-0 rounded-full border-2 ${((selectedOption !== null || timeLeft === 0) && (idx === currentQ.correctOptionIndex || idx === selectedOption)) ? 'border-current' : 'border-slate-300 text-slate-400'}`}>
                            {currentQ.type === 'TRUE_FALSE' ? (idx === 0 ? 'T' : 'F') : String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1 break-words">{opt}</span>
                          {isHost && (
                            <span className="ml-3 text-2xl font-black text-indigo-900 bg-white/80 rounded-lg px-3 py-1 shadow-sm">
                              {answerCounts[idx]}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
            
            {!isHost && selectedOption === -1 && (
               <div className="mt-6 text-rose-500 font-bold text-xl animate-bounce">Time's up!</div>
            )}

            {/* Power-ups Inventory UI */}
            {!isHost && selectedOption === null && timeLeft > 0 && inventory.length > 0 && (
              <div className="mt-8 border-t border-slate-200 pt-6 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-500 text-sm uppercase tracking-wider">Power-ups (Click to use)</h3>
                  {actionLog && <span className="font-bold text-emerald-500 animate-pulse">{actionLog}</span>}
                </div>
                <div className="flex gap-4 justify-center">
                  {inventory.map(p => (
                    <button 
                      key={p} 
                      onClick={() => handleUsePowerup(p)}
                      disabled={isFrozen}
                      className="flex flex-col items-center gap-1 bg-white border border-slate-200 p-3 rounded-xl hover:border-indigo-400 hover:shadow-md transition active:scale-90"
                    >
                      {p === '2x' && <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white"><Zap className="w-6 h-6" /></div>}
                      {p === '50-50' && <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white"><EyeOff className="w-5 h-5" /></div>}
                      {p === 'freeze' && <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white"><Snowflake className="w-6 h-6" /></div>}
                      <span className="text-xs font-bold text-slate-600">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {gameState === 'finished' && (
          <div className="glass p-12 md:p-16 rounded-[2rem] animate-slide-up relative">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500 drop-shadow-sm">
              Final Results
            </h1>
            
            {/* Podium UI */}
            <div className="flex items-end justify-center h-64 mt-12 mb-16 gap-2 md:gap-6">
              {/* 2nd Place */}
              {podium[1] && (
                <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.4s' }}>
                  <div className="text-xl font-bold text-slate-700 mb-2 truncate max-w-[100px]">{podium[1].username}</div>
                  <div className="text-lg font-bold text-slate-500 mb-2">{podium[1].score}</div>
                  <div className="w-24 md:w-32 h-32 bg-gradient-to-t from-slate-300 to-slate-200 rounded-t-xl border-t-4 border-slate-400 flex items-center justify-center shadow-lg">
                    <span className="text-4xl font-black text-slate-500">2</span>
                  </div>
                </div>
              )}
              
              {/* 1st Place */}
              {podium[0] && (
                <div className="flex flex-col items-center animate-slide-up z-10" style={{ animationDelay: '0.8s' }}>
                  <div className="text-2xl font-black text-indigo-700 mb-1 truncate max-w-[120px] drop-shadow-sm">{podium[0].username}</div>
                  <div className="text-xl font-black text-indigo-500 mb-2">{podium[0].score}</div>
                  <div className="w-28 md:w-36 h-48 bg-gradient-to-t from-amber-400 to-yellow-300 rounded-t-xl border-t-4 border-yellow-500 flex items-start pt-6 justify-center shadow-2xl relative z-10">
                    <span className="text-6xl font-black text-yellow-700">1</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {podium[2] && (
                <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <div className="text-xl font-bold text-slate-700 mb-2 truncate max-w-[100px]">{podium[2].username}</div>
                  <div className="text-lg font-bold text-slate-500 mb-2">{podium[2].score}</div>
                  <div className="w-24 md:w-32 h-24 bg-gradient-to-t from-orange-300 to-orange-200 rounded-t-xl border-t-4 border-orange-400 flex items-center justify-center shadow-lg">
                    <span className="text-4xl font-black text-orange-600">3</span>
                  </div>
                </div>
              )}
            </div>

            {!isHost && (
              <p className="text-2xl text-slate-600 font-medium mb-10">Your final score: <span className="font-black text-indigo-600">{score}</span> points!</p>
            )}

            <button 
              onClick={() => { sound.playClick(); window.location.href = '/'; }} 
              className="bg-white hover:bg-slate-50 text-slate-700 py-4 px-10 rounded-2xl font-bold transition border border-slate-200 shadow-md transform active:scale-95 text-xl"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
