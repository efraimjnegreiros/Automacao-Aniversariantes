import express from 'express';
import 'dotenv/config';
import pg from 'pg';
import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

const { Client } = pg;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

function getClient() {
  return new Client({
    host: process.env.DATABASE_HOST,
    port: 5432,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
}

/* ===============================
   FUNÇÃO GERAR IMAGEM
================================ */
async function gerarImagem(aniversariantes, fontSize, espacamento) {

  registerFont('./GlacialIndifference-Bold.otf', {
    family: 'GlacialBold'
  });

  const background = await loadImage('./public/padrao.png');
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(background, 0, 0);

  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px GlacialBold`;

  let yPosition = 325;

  aniversariantes.forEach(membro => {

    const nome = membro.name;

    const data = new Date(membro.date_of_birth);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');

    ctx.fillText(nome, 157, yPosition);
    ctx.fillText(`${dia}/${mes}`, 800, yPosition);

    yPosition += espacamento;
  });

  const outputPath = path.join('public', 'aniversariantes.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  return path.resolve(outputPath);
}

/* ===============================
   TELA INICIAL
================================ */
app.get('/members', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Gerador de Aniversariantes</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: 'Poppins', sans-serif;
      }

      body {
        background: linear-gradient(135deg, #667eea, #764ba2);
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .card {
        background: white;
        padding: 40px;
        border-radius: 16px;
        width: 100%;
        max-width: 500px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      }

      h1 {
        text-align: center;
        margin-bottom: 30px;
        font-weight: 600;
        color: #333;
      }

      .form-group {
        margin-bottom: 20px;
      }

      label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #555;
      }

      input {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #ddd;
        font-size: 14px;
        transition: 0.2s;
      }

      input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102,126,234,0.2);
      }

      .row {
        display: flex;
        gap: 15px;
      }

      .row .form-group {
        flex: 1;
      }

      button {
        width: 100%;
        padding: 12px;
        background: #667eea;
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 15px;
        cursor: pointer;
        transition: 0.3s;
      }

      button:hover {
        background: #5a67d8;
        transform: translateY(-2px);
      }

      .footer {
        text-align: center;
        margin-top: 15px;
        font-size: 12px;
        color: #999;
      }

    </style>
  </head>
  <body>

    <div class="card">
      <h1>Gerador de Aniversariantes</h1>

      <form method="POST" action="/members">

        <div class="form-group">
          <label>Data inicial</label>
          <input type="date" name="startDate" required />
        </div>

        <div class="form-group">
          <label>Data final</label>
          <input type="date" name="endDate" required />
        </div>

        <div class="row">
          <div class="form-group">
            <label>Tamanho da fonte</label>
            <input type="number" name="fontSize" value="40" min="10" max="100" />
          </div>

          <div class="form-group">
            <label>Espaçamento</label>
            <input type="number" name="espacamento" value="55" min="20" max="150" />
          </div>
        </div>

        <button type="submit">Gerar Imagem</button>

      </form>

      <div class="footer">
        Sistema de geração automática
      </div>
    </div>

  </body>
  </html>
  `);
});

/* ===============================
   FILTRO IGNORANDO O ANO
================================ */
app.post('/members', async (req, res) => {

  const { startDate, endDate, fontSize, espacamento } = req.body;

  const startValue = startDate.slice(5, 7) + startDate.slice(8, 10);
  const endValue   = endDate.slice(5, 7) + endDate.slice(8, 10);

  const client = getClient();

  try {
    await client.connect();

    const query = {
      text: `
        SELECT
          name,
          date_of_birth
        FROM core_member
        WHERE TO_CHAR(date_of_birth::date, 'MMDD')
              BETWEEN $1 AND $2
        ORDER BY
          TO_CHAR(date_of_birth::date, 'MMDD'),
          name;
      `,
      values: [startValue, endValue]
    };

    const result = await client.query(query);

    if (result.rows.length === 0) {
      return res.send("Nenhum aniversariante encontrado.");
    }

    const imagePath = await gerarImagem(
      result.rows,
      parseInt(fontSize) || 40,
      parseInt(espacamento) || 55
    );

    return res.sendFile(imagePath);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerar imagem.");
  } finally {
    await client.end();
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000/members');
});