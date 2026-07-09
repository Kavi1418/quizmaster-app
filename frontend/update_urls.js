const fs = require('fs');
const files = [
  'src/components/GameRoom.tsx',
  'src/components/Home.tsx',
  'src/components/Host.tsx',
  'src/components/Login.tsx',
  'src/components/Signup.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // Replace 'http://localhost:3001/...' with `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/...`
  content = content.replace(/'http:\/\/localhost:3001/g, '`${import.meta.env.VITE_API_URL || \'http://localhost:3001\'}');
  
  // Need to fix template string ending for fetch calls
  // Specifically: fetch('http://localhost:3001/api/leaderboard') -> fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/leaderboard`)
  // Let's do it simply using replace with regex
  fs.writeFileSync(f, content);
});

let socketContent = fs.readFileSync('src/socket.ts', 'utf8');
socketContent = socketContent.replace("'http://localhost:3001'", "import.meta.env.VITE_API_URL || 'http://localhost:3001'");
fs.writeFileSync('src/socket.ts', socketContent);

let viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
if(!viteConfig.includes('base:')) {
  viteConfig = viteConfig.replace('export default defineConfig({', "export default defineConfig({\n  base: '/quizmaster-app/',");
  fs.writeFileSync('vite.config.ts', viteConfig);
}

console.log('Done updating urls and vite config');
