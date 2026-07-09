import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Home from './components/Home'
import Host from './components/Host'
import GameRoom from './components/GameRoom'
import Login from './components/Login'
import Signup from './components/Signup'
import { AuthProvider, useAuth } from './context/AuthContext'
import { sound } from './utils/sound'
import { Volume2, VolumeX } from 'lucide-react'

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user || user.role !== 'HOST') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route 
        path="/host" 
        element={
          <ProtectedRoute>
            <Host />
          </ProtectedRoute>
        } 
      />
      <Route path="/game/:roomId" element={<GameRoom />} />
    </Routes>
  );
}

function App() {
  const [isMuted, setIsMuted] = useState(sound.isMuted);

  const toggleSound = () => {
    setIsMuted(sound.toggleMute());
  };

  return (
    <AuthProvider>
      <Router>
        <div className="relative">
          <AppRoutes />
          
          <button 
            onClick={toggleSound}
            className="fixed bottom-6 right-6 z-50 p-4 bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all transform hover:scale-110"
            title={isMuted ? "Unmute Sound & Music" : "Mute Sound & Music"}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
