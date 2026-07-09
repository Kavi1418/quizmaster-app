const fs = require('fs');

const configContent = "export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';\n";
fs.writeFileSync('src/config.ts', configContent);

const files = [
  'src/components/GameRoom.tsx',
  'src/components/Home.tsx',
  'src/components/Host.tsx',
  'src/components/Login.tsx',
  'src/components/Signup.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  if (!content.includes('API_URL')) {
    content = 'import { API_URL } from "../config";\n' + content;
  }

  // Handle fetch('http://localhost:3001...')
  content = content.replace(/'http:\/\/localhost:3001(.*?)'/g, '`${API_URL}$1`');
  // Handle fetch(`http://localhost:3001...`)
  content = content.replace(/`http:\/\/localhost:3001(.*?)`/g, '`${API_URL}$1`');
  
  fs.writeFileSync(f, content);
});

let socketContent = fs.readFileSync('src/socket.ts', 'utf8');
socketContent = socketContent.replace("'http://localhost:3001'", "import.meta.env.VITE_API_URL || 'http://localhost:3001'");
fs.writeFileSync('src/socket.ts', socketContent);

let viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
if (!viteConfig.includes('base:')) {
  viteConfig = viteConfig.replace('export default defineConfig({', "export default defineConfig({\n  base: '/quizmaster-app/',");
  fs.writeFileSync('vite.config.ts', viteConfig);
}

console.log('Update finished!');
