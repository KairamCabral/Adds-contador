const fs = require("fs");
const path = require("path");

const files = [
  "jobs/sync.ts",
  "lib/tiny/client.ts",
  "lib/tiny/transformers.ts",
];

files.forEach((file) => {
  const filepath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  ${file} não encontrado, pulando...`);
    return;
  }

  let content = fs.readFileSync(filepath, "utf8");
  let originalLength = content.length;

  // Remover todos os blocos // #region agent log até // #endregion
  const regex = /\s*\/\/ #region agent log[\s\S]*?\/\/ #endregion\s*/g;
  content = content.replace(regex, "");

  if (content.length !== originalLength) {
    fs.writeFileSync(filepath, content, "utf8");
    console.log(`✅ ${file} - removidos ${Math.ceil((originalLength - content.length) / 200)} blocos de log`);
  } else {
    console.log(`ℹ️  ${file} - nenhum bloco de log encontrado`);
  }
});

console.log("\n✨ Limpeza concluída!");

