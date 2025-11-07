// index.js (Versão MySQL)

const express = require('express');
const mysql = require('mysql2/promise'); // Usando promessas para async/await
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 5000;

// --- CONFIGURAÇÃO DO BANCO DE DADOS MYSQL ---
const dbConfig = {
    host: 'localhost',      // Mantenha 'localhost' se o MySQL estiver na sua máquina
    user: 'root',           // Seu usuário do MySQL (altere se for diferente)
    password: 'senai',  // SUA SENHA DO MYSQL WORKBENCH/ROOT (Obrigatório alterar)
    database: 'biblioteca_db'
};

let pool; // Pool de conexões para eficiência

// Função de Hashing Simples
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// --- Inicialização da Conexão e do Servidor ---
async function initializeServer() {
    try {
        // Cria o pool de conexões MySQL
        pool = mysql.createPool(dbConfig);
        console.log('✅ Pool de conexões MySQL criado com sucesso.');

        // ----------------------------------------------------
        // CONFIGURAÇÃO DO MIDDLEWARE
        // ----------------------------------------------------
        app.use(cors());
        app.use(express.json());

        // ----------------------------------------------------
        // ROTAS DE AUTENTICAÇÃO
        // ----------------------------------------------------

        // Rota de Cadastro
        app.post('/cadastro', async (req, res) => {
            const { email, senha } = req.body;
            if (!email || !senha) return res.status(400).json({ erro: "Email e senha são obrigatórios." });

            const senha_hash = hashPassword(senha);

            try {
                // MySQL: INSERT INTO ...
                const [result] = await pool.execute(
                    "INSERT INTO usuarios (email, senha_hash) VALUES (?, ?)",
                    [email, senha_hash]
                );
                res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!", id: result.insertId });
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ erro: "Este email já está cadastrado." });
                }
                console.error("Erro no cadastro:", err);
                res.status(500).json({ erro: "Erro interno ao cadastrar usuário." });
            }
        });

        // Rota de Login
        app.post('/login', async (req, res) => {
            const { email, senha } = req.body;
            if (!email || !senha) return res.status(400).json({ erro: "Email e senha são obrigatórios." });

            const senha_hash = hashPassword(senha);

            try {
                // MySQL: SELECT
                const [rows] = await pool.execute(
                    "SELECT id FROM usuarios WHERE email = ? AND senha_hash = ?",
                    [email, senha_hash]
                );
                
                if (rows.length === 0) {
                    return res.status(401).json({ erro: "Credenciais inválidas." });
                }
                
                res.status(200).json({ 
                    mensagem: "Login realizado com sucesso!",
                    token: rows[0].id 
                });
            } catch (err) {
                console.error("Erro no login:", err);
                res.status(500).json({ erro: "Erro interno no servidor." });
            }
        });


        // ----------------------------------------------------
        // ROTAS DE LIVROS (CRUD com Filtros)
        // ----------------------------------------------------
        
        // 1. CRIAR LIVRO (POST /livros)
        app.post('/livros', async (req, res) => {
            const livro = req.body; 
            if (!livro.titulo || !livro.autor || !livro.ano_publicacao) {
                return res.status(400).json({ erro: "Campos obrigatórios faltando." });
            }

            const disponivel = livro.disponivel !== undefined ? !!livro.disponivel : true;
            const isbn = livro.isbn || null;

            try {
                const [result] = await pool.execute(
                    "INSERT INTO livros (titulo, autor, ano_publicacao, isbn, disponivel) VALUES (?, ?, ?, ?, ?)",
                    [livro.titulo, livro.autor, livro.ano_publicacao, isbn, disponivel]
                );
                
                // Buscar o livro recém-criado (opcional, mas bom para validação)
                const [rows] = await pool.execute("SELECT * FROM livros WHERE id = ?", [result.insertId]);
                const responseLivro = rows[0];

                res.status(201).json({ ...responseLivro, mensagem: "Livro cadastrado com sucesso!" });
            } catch (err) {
                console.error("Erro ao criar livro:", err);
                res.status(500).json({ erro: `Erro interno: ${err.message}` });
            }
        });

        // 2. LISTAR TODOS OS LIVROS (GET /livros) - COM FILTROS
        app.get('/livros', async (req, res) => {
            const { autor, titulo, disponivel } = req.query;
            let sql = "SELECT * FROM livros";
            const params = [];
            const conditions = [];

            if (autor) { conditions.push("autor LIKE ?"); params.push(`%${autor}%`); }
            if (titulo) { conditions.push("titulo LIKE ?"); params.push(`%${titulo}%`); }
            if (disponivel !== undefined) {
                const dispValue = (disponivel === 'true' || disponivel === '1');
                conditions.push("disponivel = ?"); params.push(dispValue);
            }
            
            if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");

            try {
                const [rows] = await pool.execute(sql, params);
                
                // MySQL retorna 0/1 para booleano, mapeamos para true/false
                const livros = rows.map(row => ({ ...row, disponivel: !!row.disponivel }));

                res.status(200).json({ total: livros.length, livros: livros });
            } catch (err) {
                console.error("Erro ao listar livros:", err);
                res.status(500).json({ erro: `Erro interno ao buscar livros: ${err.message}` });
            }
        });

        // 3. BUSCAR UM LIVRO ESPECÍFICO (GET /livros/{id})
        app.get('/livros/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const [rows] = await pool.execute("SELECT * FROM livros WHERE id = ?", [id]);
                
                if (rows.length === 0) return res.status(404).json({ erro: "Livro não encontrado" });
                
                const livro = { ...rows[0], disponivel: !!rows[0].disponivel };
                res.status(200).json(livro);
            } catch (err) {
                console.error("Erro ao buscar livro:", err);
                res.status(500).json({ erro: `Erro interno: ${err.message}` });
            }
        });

        // 4. ATUALIZAR UM LIVRO (PUT /livros/{id})
        app.put('/livros/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            let updates = [];
            let params = [];
            
            for (const key in data) {
                if (['titulo', 'autor', 'ano_publicacao', 'isbn', 'disponivel'].includes(key)) {
                    updates.push(`${key} = ?`);
                    params.push(data[key]); // MySQL cuida de converter booleanos para 0/1
                }
            }
            if (updates.length === 0) return res.status(400).json({ erro: "Nenhum campo de atualização válido fornecido." });

            const sql = `UPDATE livros SET ${updates.join(', ')} WHERE id = ?`;
            params.push(id);

            try {
                const [result] = await pool.execute(sql, params);
                if (result.affectedRows === 0) return res.status(404).json({ erro: "Livro não encontrado" });

                const [rows] = await pool.execute("SELECT * FROM livros WHERE id = ?", [id]);
                const responseLivro = { ...rows[0], disponivel: !!rows[0].disponivel };

                res.status(200).json({ ...responseLivro, mensagem: "Livro atualizado com sucesso!" });
            } catch (err) {
                console.error("Erro ao atualizar livro:", err);
                res.status(500).json({ erro: `Erro interno ao atualizar o livro: ${err.message}` });
            }
        });

        // 5. DELETAR UM LIVRO (DELETE /livros/{id})
        app.delete('/livros/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const [result] = await pool.execute("DELETE FROM livros WHERE id = ?", [id]);
                if (result.affectedRows === 0) return res.status(404).json({ erro: "Livro não encontrado" });

                res.status(200).json({ mensagem: "Livro removido com sucesso!" });
            } catch (err) {
                console.error("Erro ao deletar livro:", err);
                res.status(500).json({ erro: `Erro interno ao remover o livro: ${err.message}` });
            }
        });

        // --- INICIALIZAÇÃO DO SERVIDOR ---
        app.listen(PORT, () => {
            console.log(`\n📚 API REST da Biblioteca rodando em http://localhost:${PORT}`);
            console.log('✅ Conectado ao MySQL.');
            console.log('Abra o index.html no navegador.');
        });

    } catch (err) {
        console.error("❌ ERRO CRÍTICO NA CONEXÃO COM O MYSQL:", err);
        process.exit(1);
    }
}

// Inicia o servidor e a conexão
initializeServer();