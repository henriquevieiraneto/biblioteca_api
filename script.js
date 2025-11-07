// script.js

import { fazerRequisicao, logout } from './auth.js';
const API_URL = '/livros';

// Elementos do DOM
const listaContainer = document.getElementById('lista-container');
const formAdicionar = document.getElementById('form-adicionar');
const formMensagem = document.getElementById('form-mensagem');
const carregandoMsg = document.getElementById('carregando');
const filtrosForm = document.getElementById('filtros-form');

// Funções globais para uso no HTML
window.logout = logout;

// Cria o elemento HTML (Card) para cada livro
function criarCardLivro(livro) {
    const div = document.createElement('div');
    div.className = 'livro-card';
    div.setAttribute('data-id', livro.id);

    const statusClass = livro.disponivel ? 'disponivel' : 'indisponivel';
    const statusTexto = livro.disponivel ? 'Disponível' : 'Emprestado';

    div.innerHTML = `
        <div class="livro-info">
            <h3>${livro.titulo}</h3>
            <p><strong>Autor:</strong> ${livro.autor}</p>
            <p><strong>Ano:</strong> ${livro.ano_publicacao}</p>
            <p><strong>ISBN:</strong> ${livro.isbn || 'N/A'}</p>
            <span class="livro-status ${statusClass}">${statusTexto}</span>
        </div>
        <div class="livro-acoes">
            <button class="btn-toggle" onclick="toggleDisponibilidade(${livro.id}, ${livro.disponivel})">
                ${livro.disponivel ? 'Emprestar' : 'Devolver'}
            </button>
            <button class="btn-delete" onclick="deletarLivro(${livro.id})">Deletar</button>
        </div>
    `;
    return div;
}

// 1. LISTAR TODOS OS LIVROS (GET /livros)
async function listarLivros(filtros = {}) {
    carregandoMsg.style.display = 'block';
    listaContainer.innerHTML = '';
    
    const params = new URLSearchParams();
    if (filtros.autor) params.append('autor', filtros.autor);
    if (filtros.titulo) params.append('titulo', filtros.titulo);
    if (filtros.disponivel !== undefined) params.append('disponivel', filtros.disponivel);

    const url = `${API_URL}?${params.toString()}`;
    const data = await fazerRequisicao(url, 'GET');

    carregandoMsg.style.display = 'none';

    if (data.erro) {
        listaContainer.innerHTML = `<p class="erro-msg">${data.erro}</p>`;
        return;
    }

    if (data.total === 0) {
        listaContainer.innerHTML = '<p>Nenhum livro encontrado com os filtros aplicados.</p>';
        return;
    }

    data.livros.forEach(livro => {
        const card = criarCardLivro(livro);
        listaContainer.appendChild(card);
    });
}

// Lógica de Filtro
filtrosForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const filtros = {
        autor: document.getElementById('filtro-autor').value,
        titulo: document.getElementById('filtro-titulo').value,
        disponivel: document.getElementById('filtro-disponibilidade').value
    };
    
    if (filtros.disponivel === 'todos') delete filtros.disponivel;
    else filtros.disponivel = filtros.disponivel === 'true';

    listarLivros(filtros);
});

document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
    filtrosForm.reset();
    listarLivros({});
});

// 2. ADICIONAR NOVO LIVRO (POST /livros)
formAdicionar.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMensagem.textContent = '';
    formMensagem.style.color = 'red';

    const novoLivro = {
        titulo: document.getElementById('titulo').value,
        autor: document.getElementById('autor').value,
        ano_publicacao: parseInt(document.getElementById('ano_publicacao').value),
        isbn: document.getElementById('isbn').value || null,
        disponivel: true 
    };

    if (novoLivro.isbn === '') novoLivro.isbn = null;

    const result = await fazerRequisicao(API_URL, 'POST', novoLivro);

    if (result.erro) {
        formMensagem.textContent = `Erro ao cadastrar: ${result.erro}`;
    } else {
        formMensagem.textContent = `✅ ${result.mensagem}`;
        formMensagem.style.color = '#1e7e34';
        formAdicionar.reset(); 
        listarLivros(); 
    }
});

// 3. ALTERAR DISPONIBILIDADE (PUT /livros/{id})
async function toggleDisponibilidade(id, disponivelAtual) {
    const novoStatus = !disponivelAtual;
    const data = { disponivel: novoStatus };

    const result = await fazerRequisicao(`${API_URL}/${id}`, 'PUT', data);

    if (result.erro) {
        alert(`Erro ao atualizar o status do livro: ${result.erro}`);
    } else {
        listarLivros();
    }
}

// 4. DELETAR LIVRO (DELETE /livros/{id})
async function deletarLivro(id) {
    if (!confirm('Tem certeza que deseja remover este livro do catálogo?')) return;

    const result = await fazerRequisicao(`${API_URL}/${id}`, 'DELETE');

    if (result.erro) {
        alert(`Erro ao deletar o livro: ${result.erro}`);
    } else {
        listarLivros();
    }
}

// Exporta as funções para serem acessíveis pelo HTML (onclick)
window.toggleDisponibilidade = toggleDisponibilidade;
window.deletarLivro = deletarLivro;

// Inicializa a listagem ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    listarLivros();
});