// auth.js

const API_BASE_URL = 'http://127.0.0.1:5000';
const SESSION_KEY = 'authToken';

export function estaLogado() {
    return localStorage.getItem(SESSION_KEY) !== null;
}

export function login(token) {
    localStorage.setItem(SESSION_KEY, token);
    window.location.href = 'catalogo.html';
}

export function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

export function requerAutenticacao() {
    if (!estaLogado()) {
        alert("Você precisa estar logado para acessar esta página.");
        window.location.href = 'login.html';
    }
}

export async function fazerRequisicao(url, method, data = null) {
    const options = {
        method: method,
        headers: { 
            'Content-Type': 'application/json',
        },
    };
    if (data) options.body = JSON.stringify(data);

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            return { erro: result.erro || `Erro HTTP ${response.status}`, status: response.status };
        }
        return result;
    } catch (error) {
        console.error('Falha na comunicação com a API:', error);
        return { erro: 'Falha ao conectar com o servidor da API.', status: 500 };
    }
}