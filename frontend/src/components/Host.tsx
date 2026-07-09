import { API_URL } from "../config";
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Copy, Users, Plus, CheckCircle2, Save, Edit3, Trash2, ArrowLeft, BarChart2, X, Sparkles, Download } from 'lucide-react'
import { socket } from '../socket'
import { useAuth } from '../context/AuthContext'
import { sound } from '../utils/sound'
import { QRCodeSVG } from 'qrcode.react'
import Papa from 'papaparse'

type Question = {
  questionText: string;
  imageUrl?: string;
  options: string[];
  correctOptionIndex: number;
  type?: string;
  correctText?: string;
};

type SavedQuiz = {
  id: string;
  title: string;
  createdAt: string;
  questions: any[];
}

export default function Host() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0: Dashboard, 1: Create, 2: Settings, 3: Lobby
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  
  const [quizTitle, setQuizTitle] = useState('Untitled Quiz');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>([
    { questionText: '', imageUrl: '', options: ['', '', '', ''], correctOptionIndex: 0, type: 'MULTIPLE_CHOICE' }
  ]);
  const [isAutoStart, setIsAutoStart] = useState(false);
  const [gameMode, setGameMode] = useState('classic');
  
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showResultsQuizId, setShowResultsQuizId] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // AI Generator States
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Theme Selector State
  const [selectedTheme, setSelectedTheme] = useState('default');

  useEffect(() => {
    if (step === 0 && token) {
      fetch(`${API_URL}/api/quizzes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSavedQuizzes(data.quizzes);
        }
      })
      .catch(err => console.error("Error fetching quizzes:", err));
    }
  }, [step, token]);

  useEffect(() => {
    socket.on('player_joined', (player) => {
      sound.playClick();
      setPlayers((prev) => {
        if (prev.find(p => p.username === player.username)) return prev;
        return [...prev, player];
      });
    });

    socket.on('player_score_updated', (updatedPlayer) => {
      sound.playCorrect();
      setPlayers((prev) => 
        prev.map(p => p.username === updatedPlayer.username ? { ...p, score: updatedPlayer.score } : p)
      );
    });

    return () => {
      socket.off('player_joined');
      socket.off('player_score_updated');
    };
  }, []);

  const handleSaveQuiz = async () => {
    sound.playClick();
    setIsSaving(true);
    const url = editingQuizId 
      ? `${API_URL}/api/quizzes/${editingQuizId}` 
      : `${API_URL}/api/quizzes`;
    const method = editingQuizId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: quizTitle,
          questions
        })
      });
      const data = await res.json();
      if (data.success) {
        sound.playFinished();
        setStep(0); 
      } else {
        sound.playWrong();
        alert(data.error);
      }
    } catch (err) {
      sound.playWrong();
      alert('Failed to save quiz');
    }
    setIsSaving(false);
  };

  const handleEditQuiz = (quiz: SavedQuiz) => {
    sound.playClick();
    setEditingQuizId(quiz.id);
    setQuizTitle(quiz.title);
    setQuestions(quiz.questions.map(q => ({
      questionText: q.text,
      imageUrl: q.imageUrl || '',
      options: q.options || [],
      correctOptionIndex: q.correctOption || 0,
      type: q.type || 'MULTIPLE_CHOICE',
      correctText: q.correctText || ''
    })));
    setStep(1);
  };

  const handleCreateNew = () => {
    sound.playClick();
    setEditingQuizId(null);
    setQuizTitle('Untitled Quiz');
    setQuestions([{ questionText: '', imageUrl: '', options: ['', '', '', ''], correctOptionIndex: 0, type: 'MULTIPLE_CHOICE' }]);
    setStep(1);
  };

  const handleHostSettings = (quiz: SavedQuiz) => {
    sound.playClick();
    setEditingQuizId(quiz.id);
    setQuizTitle(quiz.title);
    setQuestions(quiz.questions.map(q => ({
      questionText: q.text,
      imageUrl: q.imageUrl || '',
      options: q.options || [],
      correctOptionIndex: q.correctOption || 0,
      type: q.type || 'MULTIPLE_CHOICE',
      correctText: q.correctText || ''
    })));
    setStep(2);
  };

  const handleViewResults = async (quiz: SavedQuiz) => {
    sound.playClick();
    setShowResultsQuizId(quiz.id);
    setIsLoadingResults(true);
    try {
      const res = await fetch(`${API_URL}/api/quizzes/${quiz.id}/results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuizResults(data.results);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoadingResults(false);
  };

  const handleCreateRoom = () => {
    sound.playClick();
    socket.connect();
    socket.emit('create_room', { hostName: user?.username || 'Host', questions, isAutoStart, quizId: editingQuizId, theme: selectedTheme, gameMode }, (response: any) => {
      if (response?.roomCode) {
        setRoomCode(response.roomCode);
        setStep(3);
      }
    });
  };

  const handleStartQuiz = () => {
    sound.playClick();
    if (roomCode) {
      socket.emit('start_quiz', { roomCode });
      navigate(`/game/${roomCode}`, { state: { isHost: true, initialQuestions: questions, username: 'Host', theme: selectedTheme, gameMode } });
    }
  };

  const handleGenerateAI = async () => {
    sound.playClick();
    if (!aiTopic) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic })
      });
      const data = await res.json();
      if (data.success && data.questions) {
        sound.playFinished();
        setQuestions(data.questions.map((q: any) => ({
          questionText: q.text,
          imageUrl: '',
          options: q.options,
          correctOptionIndex: q.correctOption,
          type: 'MULTIPLE_CHOICE'
        })));
        setShowAIModal(false);
        setAiTopic('');
      }
    } catch (err) {
      console.error(err);
      sound.playWrong();
      alert('Failed to generate quiz');
    }
    setIsGenerating(false);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQuestions = [...questions];
    if (field === 'text') newQuestions[index].questionText = value;
    if (field === 'imageUrl') newQuestions[index].imageUrl = value;
    if (field === 'correct') {
      sound.playClick();
      newQuestions[index].correctOptionIndex = value;
    }
    if (field === 'type') {
      newQuestions[index].type = value;
      if (value === 'TRUE_FALSE') {
         newQuestions[index].options = ['True', 'False'];
         newQuestions[index].correctOptionIndex = 0;
      } else if (value === 'MULTIPLE_CHOICE') {
         newQuestions[index].options = ['', '', '', ''];
         newQuestions[index].correctOptionIndex = 0;
      } else {
         newQuestions[index].correctText = '';
      }
    }
    if (field === 'correctText') newQuestions[index].correctText = value;
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[optIndex] = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    sound.playClick();
    setQuestions([...questions, { questionText: '', imageUrl: '', options: ['', '', '', ''], correctOptionIndex: 0, type: 'MULTIPLE_CHOICE' }]);
  };

  // Parser logic same as before...
  const handleSmartPaste = (qIndex: number, text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedQuestions: Question[] = [];
    let currentQ: Question | null = null;
    let isAnswerKeyMode = false;

    lines.forEach(line => {
      const isOption = /^([a-d]|[1-4])[\.\)]\s+/i.test(line);
      const isInlineAnswer = line.toLowerCase().startsWith('answer:');
      const isQuestionNumber = /^(?:Q?\d+[\.\)\-])\s+/i.test(line);
      const isAnswerKeyHeader = line.toLowerCase().includes('answer key') || line.toLowerCase() === 'answers:';

      if (isAnswerKeyHeader) {
         isAnswerKeyMode = true;
         if (currentQ) { parsedQuestions.push(currentQ); currentQ = null; }
         return; 
      }

      if (isAnswerKeyMode) {
         const match = line.match(/^(?:Q|Question|Ans|Answer)?\s*(\d+)\s*[\.\)\-:]?\s*(?:Answer|Option|Ans)?\s*[:\-]?\s*([a-d1-4])\b/i);
         if (match) {
            const qNum = parseInt(match[1], 10) - 1;
            const ansLetter = match[2].toUpperCase();
            if (qNum >= 0 && qNum < parsedQuestions.length) {
               let cIndex = 0;
               if (ansLetter === 'A' || ansLetter === '1') cIndex = 0;
               if (ansLetter === 'B' || ansLetter === '2') cIndex = 1;
               if (ansLetter === 'C' || ansLetter === '3') cIndex = 2;
               if (ansLetter === 'D' || ansLetter === '4') cIndex = 3;
               parsedQuestions[qNum].correctOptionIndex = cIndex;
            }
         }
         return;
      }

      const filledOptions = currentQ ? currentQ.options.filter(o => o !== '').length : 0;

      if (!currentQ || (isQuestionNumber && filledOptions > 0) || (filledOptions === 4 && !isOption && !isInlineAnswer)) {
        if (currentQ) parsedQuestions.push(currentQ);
        currentQ = { questionText: line.replace(/^(?:Q?\d+[\.\)\-]\s*)/i, ''), imageUrl: '', options: ['', '', '', ''], correctOptionIndex: 0 };
      } else if (isInlineAnswer) {
         const ansStr = line.replace(/^answer:\s*/i, '').trim().toUpperCase();
         const ansLetter = ansStr[0];
         if (ansLetter === 'A' || ansLetter === '1') currentQ.correctOptionIndex = 0;
         if (ansLetter === 'B' || ansLetter === '2') currentQ.correctOptionIndex = 1;
         if (ansLetter === 'C' || ansLetter === '3') currentQ.correctOptionIndex = 2;
         if (ansLetter === 'D' || ansLetter === '4') currentQ.correctOptionIndex = 3;
      } else if (isOption) {
         const emptyIdx = currentQ.options.findIndex(o => o === '');
         if (emptyIdx !== -1) currentQ.options[emptyIdx] = line.replace(/^([a-d]|[1-4])[\.\)]\s*/i, '');
      } else {
         if (filledOptions === 0) {
             currentQ.questionText += '\n' + line;
         } else {
             if (currentQ) parsedQuestions.push(currentQ);
             currentQ = { questionText: line, imageUrl: '', options: ['', '', '', ''], correctOptionIndex: 0 };
         }
      }
    });

    if (currentQ) parsedQuestions.push(currentQ);

    if (parsedQuestions.length > 0) {
      sound.playFinished();
      if (questions.length === 1 && questions[0].questionText === '') {
        setQuestions(parsedQuestions);
      } else {
        const newQuestions = [...questions];
        newQuestions.splice(qIndex, 1, ...parsedQuestions);
        setQuestions(newQuestions);
      }
    }
  };

  const handleAnswerKeyPaste = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newQuestions = [...questions];
    let matchedAny = false;
    lines.forEach(line => {
       const match = line.match(/^(?:Q|Question|Ans|Answer)?\s*(\d+)\s*[\.\)\-:]?\s*(?:Answer|Option|Ans)?\s*[:\-]?\s*([a-d1-4])\b/i);
       if (match) {
          const qNum = parseInt(match[1], 10) - 1;
          const ansLetter = match[2].toUpperCase();
          if (qNum >= 0 && qNum < newQuestions.length) {
             let cIndex = 0;
             if (ansLetter === 'A' || ansLetter === '1') cIndex = 0;
             if (ansLetter === 'B' || ansLetter === '2') cIndex = 1;
             if (ansLetter === 'C' || ansLetter === '3') cIndex = 2;
             if (ansLetter === 'D' || ansLetter === '4') cIndex = 3;
             newQuestions[qNum] = { ...newQuestions[qNum], correctOptionIndex: cIndex };
             matchedAny = true;
          }
       }
    });
    if (matchedAny) {
      sound.playFinished();
      setQuestions(newQuestions);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col items-center py-12 px-4 relative overflow-y-auto text-slate-800">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none fixed">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-300/20 rounded-full blur-[100px] animate-bounce-subtle"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-cyan-300/20 rounded-full blur-[100px] animate-bounce-subtle" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="z-10 w-full max-w-4xl animate-slide-up">
        
        {/* STEP 0: DASHBOARD */}
        {step === 0 && (
          <div className="glass p-8 rounded-[2rem]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">
                  Welcome back, {user?.username}!
                </h1>
                <p className="text-slate-500 mt-2 font-medium">Manage your quizzes and host games.</p>
              </div>
              <button 
                onClick={handleCreateNew}
                className="bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-200 flex items-center gap-2 transform active:scale-95"
              >
                <Plus className="w-5 h-5" /> Create New Quiz
              </button>
            </div>

            <h2 className="text-xl font-bold mb-6 text-slate-700 border-b border-slate-200/50 pb-3">Your Saved Quizzes</h2>
            
            {savedQuizzes.length === 0 ? (
              <div className="text-center py-16 bg-white/40 rounded-2xl border border-dashed border-slate-300">
                <p className="text-slate-500 mb-4 font-medium text-lg">You haven't created any quizzes yet.</p>
                <button onClick={handleCreateNew} className="text-indigo-600 hover:text-indigo-500 font-bold flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" /> Create your first quiz
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {savedQuizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-white/80 border border-slate-200 p-6 rounded-2xl flex flex-col justify-between hover:border-indigo-300 transition-all hover:shadow-xl hover:shadow-indigo-100 group">
                    <div>
                      <h3 className="text-xl font-extrabold mb-2 text-slate-800 truncate">{quiz.title}</h3>
                      <p className="text-slate-500 text-sm mb-6 font-medium bg-slate-100/50 inline-block px-3 py-1 rounded-full">{quiz.questions.length} Questions • Created {new Date(quiz.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleHostSettings(quiz)}
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-200 transform active:scale-95"
                      >
                        <Play className="w-5 h-5 fill-current" /> Host Now
                      </button>
                      <button 
                        onClick={() => handleViewResults(quiz)}
                        title="View Results"
                        className="px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold flex items-center justify-center transition hover:text-indigo-600 transform active:scale-95"
                      >
                        <BarChart2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleEditQuiz(quiz)}
                        title="Edit Quiz"
                        className="px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold flex items-center justify-center transition hover:text-indigo-600 transform active:scale-95"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* RESULTS MODAL */}
            {showResultsQuizId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowResultsQuizId(null)}></div>
                <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 border border-white/50 animate-slide-up flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                      <BarChart2 className="w-6 h-6 text-indigo-500" />
                      Quiz History
                    </h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const csv = Papa.unparse(quizResults.map((r: any) => ({ Name: r.playerName, Score: r.score, Date: new Date(r.createdAt).toLocaleString() })));
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `results_${showResultsQuizId}.csv`;
                          a.click();
                        }}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg flex items-center gap-2 font-bold text-sm transition"
                      >
                        <Download className="w-4 h-4" /> Download CSV
                      </button>
                      <button onClick={() => setShowResultsQuizId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                  
                  {isLoadingResults ? (
                    <div className="py-12 text-center text-slate-400 font-medium animate-pulse">Loading results...</div>
                  ) : quizResults.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                      No one has played this quiz yet.
                    </div>
                  ) : (
                    <>
                      <div className="bg-indigo-50 text-indigo-700 p-4 rounded-2xl mb-6 font-bold flex justify-between items-center">
                        <span>Total Plays</span>
                        <span className="text-2xl">{quizResults.length}</span>
                      </div>
                      <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                        <ul className="space-y-3">
                          {quizResults.map((result: any, i: number) => (
                            <li key={i} className="bg-white px-5 py-4 rounded-xl font-bold text-lg flex items-center justify-between border border-slate-200 shadow-sm">
                              <span className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md text-sm">
                                  {result.playerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-slate-800 text-base">{result.playerName}</span>
                                  <span className="text-slate-400 text-xs font-medium">{new Date(result.createdAt).toLocaleString()}</span>
                                </div>
                              </span>
                              <span className="text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200 text-base">{result.score} pts</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: CREATE / EDIT QUIZ */}
        {step === 1 && (
          <div className="glass p-8 rounded-[2rem]">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => { sound.playClick(); setStep(0); }} className="p-2 bg-white/50 hover:bg-white border border-slate-200 rounded-xl text-slate-600 transition shadow-sm">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <input 
                type="text" 
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Quiz Title"
                className="text-3xl font-extrabold bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none px-2 py-1 w-full text-slate-800 transition-colors"
              />
              <button 
                onClick={handleSaveQuiz}
                disabled={isSaving}
                className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white font-bold py-3 px-8 rounded-xl transition flex items-center gap-2 shrink-0 disabled:opacity-50 shadow-lg shadow-emerald-200 transform active:scale-95"
              >
                <Save className="w-5 h-5" /> {isSaving ? 'Saving...' : 'Save Quiz'}
              </button>
            </div>
            
            <div className="flex justify-between items-center bg-indigo-50/80 border border-indigo-100 text-indigo-700 p-4 rounded-xl mb-8 shadow-sm">
              <span className="font-medium">Tip: You can manually create questions or use AI!</span>
              <button 
                onClick={() => { sound.playClick(); setShowAIModal(true); }}
                className="bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-400 hover:to-purple-400 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-md transform active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4" /> Auto-Generate with AI
              </button>
            </div>
            
            {/* AI MODAL */}
            {showAIModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isGenerating && setShowAIModal(false)}></div>
                <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 border border-white/50 animate-slide-up flex flex-col">
                  <h2 className="text-2xl font-bold mb-2 text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-fuchsia-500" /> AI Quiz Generator
                  </h2>
                  <p className="text-slate-500 mb-6 font-medium">Enter a topic and let AI do the work!</p>
                  
                  <input 
                    type="text" 
                    placeholder="e.g. World War II, Basic Python, Solar System..." 
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-400/20"
                  />
                  
                  <div className="flex gap-3 justify-end">
                    <button 
                      onClick={() => !isGenerating && setShowAIModal(false)}
                      className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !aiTopic}
                      className="bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg disabled:opacity-50 transition transform active:scale-95 flex items-center gap-2"
                    >
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="bg-white/70 p-8 rounded-[1.5rem] mb-6 border border-slate-200 shadow-sm relative group transition-all hover:shadow-md">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-700 bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-200">Question {qIndex + 1}</h2>
                    <select 
                      value={q.type || 'MULTIPLE_CHOICE'}
                      onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="TYPE_ANSWER">Type Answer</option>
                    </select>
                  </div>
                  {questions.length > 1 && (
                    <button onClick={() => { sound.playClick(); setQuestions(questions.filter((_, i) => i !== qIndex))}} className="text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition border border-transparent hover:border-rose-200">
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  )}
                </div>
                
                <textarea 
                  placeholder="Paste question from ChatGPT here..." 
                  value={q.questionText}
                  onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handleSmartPaste(qIndex, e.clipboardData.getData('text'));
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 mb-4 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 resize-none h-28 text-lg font-medium text-slate-800 shadow-inner placeholder:text-slate-400 transition-all"
                />

                <input 
                  type="text" 
                  placeholder="Image or YouTube URL (optional)" 
                  value={q.imageUrl || ''}
                  onChange={(e) => updateQuestion(qIndex, 'imageUrl', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 mb-6 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 text-slate-800 shadow-inner placeholder:text-slate-400 transition-all"
                />
                
                {q.type === 'TYPE_ANSWER' ? (
                  <div className="mb-4">
                    <p className="text-sm font-bold text-slate-500 mb-2">Accepted Answer:</p>
                    <input 
                      type="text" 
                      placeholder="Type the exact answer..." 
                      value={q.correctText || ''}
                      onChange={(e) => updateQuestion(qIndex, 'correctText', e.target.value)}
                      className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 focus:outline-none focus:border-emerald-400 text-emerald-800 font-bold placeholder:text-emerald-300"
                    />
                  </div>
                ) : (
                  <div className={`grid gap-4 ${q.type === 'TRUE_FALSE' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {q.options.map((opt, optIndex) => (
                      <div 
                        key={optIndex} 
                        onClick={() => updateQuestion(qIndex, 'correct', optIndex)}
                        className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          q.correctOptionIndex === optIndex 
                            ? 'border-emerald-400 bg-emerald-50/50 shadow-sm shadow-emerald-100' 
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                        }`}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 font-bold shadow-sm ${q.correctOptionIndex === optIndex ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {q.correctOptionIndex === optIndex ? <CheckCircle2 className="w-5 h-5" /> : (q.type === 'TRUE_FALSE' ? (optIndex === 0 ? 'T' : 'F') : String.fromCharCode(65 + optIndex))}
                        </div>
                        {q.type === 'TRUE_FALSE' ? (
                           <span className="font-bold text-slate-700 text-lg">{opt}</span>
                        ) : (
                          <input 
                            type="text" 
                            placeholder={`Option ${optIndex + 1}`} 
                            value={opt}
                            onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                            className="w-full bg-transparent focus:outline-none text-slate-800 font-medium placeholder:text-slate-400"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="bg-white/40 p-8 rounded-[1.5rem] border border-dashed border-slate-300 mb-8">
               <h3 className="text-lg font-bold mb-2 text-slate-700">Bulk Answer Key</h3>
               <p className="text-sm text-slate-500 mb-4 font-medium">You can paste or type your Answer Key here to automatically select the correct options above.</p>
               <textarea 
                  placeholder="e.g.&#10;1. A&#10;2. B&#10;3. C" 
                  onChange={(e) => handleAnswerKeyPaste(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl px-5 py-4 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 resize-none h-28 text-indigo-700 font-bold shadow-inner placeholder:text-slate-400 placeholder:font-normal transition-all"
                />
            </div>

            <div className="flex justify-between mt-8">
              <button 
                onClick={addQuestion}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3.5 px-8 rounded-xl transition flex items-center gap-2 shadow-sm transform active:scale-95"
              >
                 <Plus className="w-5 h-5" /> Add Question
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SETTINGS */}
        {step === 2 && (
          <div className="glass p-12 rounded-[2rem] text-center">
            <h1 className="text-3xl font-extrabold mb-2 text-slate-800">Host: {quizTitle}</h1>
            <p className="text-slate-500 mb-10 font-medium">Choose your game mode before generating the room code.</p>
            
            <div className="mb-10 max-w-2xl mx-auto text-left">
              <h3 className="text-xl font-bold mb-4 text-slate-700">Game Mode</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  onClick={() => { sound.playClick(); setGameMode('classic'); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${gameMode === 'classic' ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                >
                  <span className="font-bold text-slate-800 block mb-1">Classic</span>
                  <span className="text-xs text-slate-500">Free for all</span>
                </div>
                <div 
                  onClick={() => { sound.playClick(); setGameMode('teams'); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${gameMode === 'teams' ? 'border-cyan-400 bg-cyan-50/50' : 'border-slate-200 bg-white hover:border-cyan-300'}`}
                >
                  <span className="font-bold text-slate-800 block mb-1">Teams</span>
                  <span className="text-xs text-slate-500">Red vs Blue</span>
                </div>
                <div 
                  onClick={() => { sound.playClick(); setGameMode('boss'); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${gameMode === 'boss' ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-white hover:border-amber-300'}`}
                >
                  <span className="font-bold text-slate-800 block mb-1">Boss Battle</span>
                  <span className="text-xs text-slate-500">Co-op Class Event</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 text-left max-w-2xl mx-auto">
              <div 
                onClick={() => { sound.playClick(); setIsAutoStart(false); }}
                className={`p-8 rounded-2xl border-2 cursor-pointer transition-all transform hover:scale-[1.02] ${!isAutoStart ? 'border-indigo-400 bg-indigo-50/80 shadow-lg shadow-indigo-100' : 'border-slate-200 bg-white/80 hover:border-indigo-300 hover:shadow-md'}`}
              >
                <h3 className="text-2xl font-extrabold mb-3 text-slate-800">Live Mode</h3>
                <p className="text-slate-600 font-medium leading-relaxed">Host manually starts the quiz. Everyone answers the same question at the same time.</p>
              </div>

              <div 
                onClick={() => { sound.playClick(); setIsAutoStart(true); }}
                className={`p-8 rounded-2xl border-2 cursor-pointer transition-all transform hover:scale-[1.02] ${isAutoStart ? 'border-cyan-400 bg-cyan-50/80 shadow-lg shadow-cyan-100' : 'border-slate-200 bg-white/80 hover:border-cyan-300 hover:shadow-md'}`}
              >
                <h3 className="text-2xl font-extrabold mb-3 text-slate-800">Self-Paced</h3>
                <p className="text-slate-600 font-medium leading-relaxed">Players join and start playing immediately without waiting for the host.</p>
              </div>
            </div>

            <div className="mb-10 max-w-2xl mx-auto text-left">
              <h3 className="text-xl font-bold mb-4 text-slate-700">Select Theme</h3>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => { sound.playClick(); setSelectedTheme('default'); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedTheme === 'default' ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                >
                  <span className="font-bold text-slate-800">Classic Light</span>
                </div>
                <div 
                  onClick={() => { sound.playClick(); setSelectedTheme('cyberpunk'); }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedTheme === 'cyberpunk' ? 'border-fuchsia-400 bg-fuchsia-50/50' : 'border-slate-200 bg-slate-900 text-white hover:border-fuchsia-300'}`}
                >
                  <span className="font-bold text-fuchsia-400">Cyberpunk Neon</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => { sound.playClick(); setStep(0); }}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-4 px-10 rounded-xl transition shadow-sm transform active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateRoom}
                className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white font-bold py-4 px-12 rounded-xl shadow-lg shadow-emerald-200 transform transition active:scale-95 text-xl"
              >
                Generate Room Code
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LOBBY */}
        {step === 3 && (
          <div className="glass p-12 rounded-[2rem] text-center">
            <h1 className="text-3xl font-extrabold mb-6 text-slate-800">Host Dashboard: {quizTitle}</h1>
            
            {roomCode ? (
              <>
                <p className="text-slate-500 mb-3 font-medium text-lg">Ask players to join using this code or scan the QR:</p>
                <div className="bg-white/90 border-2 border-indigo-100 py-8 px-10 rounded-3xl mb-10 flex flex-col items-center justify-center gap-6 max-w-md mx-auto shadow-xl shadow-indigo-100/50 transform hover:scale-[1.02] transition-transform">
                  <div className="flex items-center gap-6 w-full justify-center">
                    <span className="text-6xl font-mono font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">
                      {roomCode}
                    </span>
                    <button 
                      onClick={() => { 
                        sound.playClick(); 
                        navigator.clipboard.writeText(roomCode); 
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="p-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl transition shadow-sm"
                    >
                      {copied ? <CheckCircle2 className="w-8 h-8 text-emerald-500" /> : <Copy className="w-8 h-8" />}
                    </button>
                  </div>
                  
                  <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-inner">
                    <QRCodeSVG value={`http://localhost:5173/?room=${roomCode}`} size={160} />
                  </div>
                </div>
                
                <div className="bg-white/60 rounded-3xl p-8 mb-10 text-left max-w-2xl mx-auto border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-slate-800">
                    <Users className="w-7 h-7 text-indigo-500" />
                    Live Leaderboard ({players.length} Players)
                  </h2>
                  {players.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-300 animate-pulse">
                      Waiting for players to join...
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {players.map((p, i) => (
                        <li key={i} className="bg-white px-5 py-4 rounded-xl font-bold text-lg flex items-center justify-between border border-slate-200 shadow-sm animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                          <span className="flex items-center gap-4">
                             <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`} alt="Avatar" className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200" />
                             <span className="truncate max-w-[120px] text-slate-800">{p.username}</span>
                          </span>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">{p.score || 0} pts</span>
                            {isAutoStart && <span className="text-slate-400 text-xs mt-1.5 font-medium">Playing...</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="max-w-md mx-auto">
                  {!isAutoStart ? (
                    <button 
                      onClick={handleStartQuiz}
                      disabled={players.length === 0}
                      className="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 transform transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-2xl tracking-wide"
                    >
                      <Play className="w-8 h-8 fill-current" />
                      Start Quiz Now
                    </button>
                  ) : (
                    <div className="p-5 bg-cyan-50 border-2 border-cyan-200 rounded-2xl text-cyan-800 font-medium text-lg shadow-sm">
                      This room is in <strong>Self-Paced</strong> mode. Players will start automatically when they join!
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-slate-500 font-medium animate-pulse text-lg">Generating room code...</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
