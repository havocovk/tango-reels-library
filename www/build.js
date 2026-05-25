const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("HATA: Vercel panelinde SUPABASE_URL veya SUPABASE_ANON_KEY tanımlanmamış!");
  process.exit(1);
}

// Orijinal config.js dosyanı oku
let configContent = fs.readFileSync('./config.js', 'utf8');

// Sadece şifrelerin olduğu ilk iki satırı Vercel'deki değişkenlerle değiştir
configContent = configContent.replace(
  /export const SUPABASE_URL = ".*?";/,
  `export const SUPABASE_URL = "${supabaseUrl}";`
);

configContent = configContent.replace(
  /export const SUPABASE_KEY = ".*?";/,
  `export const SUPABASE_KEY = "${supabaseKey}";`
);

// Güncellenmiş halini tekrar config.js olarak kaydet (Sözlüğün tek bir harfi bile değişmez)
fs.writeFileSync('./config.js', configContent);
console.log('config.js içerisindeki Supabase anahtarları Vercel değişkenleriyle güvenle güncellendi.');