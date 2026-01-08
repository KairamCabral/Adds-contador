/**
 * Tipos da API Tiny ERP V3
 * Baseado na documentação oficial: https://api.tiny.com.br/swagger
 */

// ============================================
// TIPOS COMUNS
// ============================================

export type TinyPaginatedResponse<T> = {
  itens: T[];
  pagina: number;
  numero_paginas: number;
  total_itens?: number;
};

export type TinyDateRange = {
  dataInicial?: string; // DD/MM/YYYY ou YYYY-MM-DD
  dataFinal?: string;
};

// ============================================
// PEDIDOS / VENDAS
// ============================================

export type TinyPedidoResumo = {
  id: number;
  numero: string;
  data_pedido: string;
  data_prevista?: string;
  cliente: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
  };
  situacao: string;
  valor: number;
  id_vendedor?: number;
  nome_vendedor?: string;
};

export type TinyPedidoItem = {
  id: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
  codigo?: string;
  unidade?: string;
};

export type TinyPedidoDetalhe = {
  id: number;
  numero: string;
  data_pedido: string;
  situacao: string;
  cliente: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
  };
  itens: TinyPedidoItem[];
  forma_pagamento?: string;
  observacoes?: string;
  vendedor?: {
    id: number;
    nome: string;
  };
  valor: number;
  desconto?: number;
  total?: number;
};

// ============================================
// CONTAS A RECEBER
// ============================================

export type TinyContaReceber = {
  id: number;
  numero_documento?: string;
  cliente: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
  };
  data_emissao: string;
  data_vencimento: string;
  valor: number;
  valor_recebido?: number;
  situacao: string;
  categoria?: string;
  centro_custo?: string;
  forma_pagamento?: string;
  observacoes?: string;
  data_pagamento?: string;
  desconto?: number;
  juros?: number;
  multa?: number;
  conta_bancaria?: string;
};

// ============================================
// CONTAS A PAGAR
// ============================================

export type TinyContaPagar = {
  id: number;
  numero_documento?: string;
  fornecedor: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
  };
  data_emissao: string;
  data_vencimento: string;
  valor: number;
  valor_pago?: number;
  situacao: string;
  categoria?: string;
  centro_custo?: string;
  forma_pagamento?: string;
  observacoes?: string;
  data_pagamento?: string;
  desconto?: number;
  juros?: number;
  multa?: number;
  conta_bancaria?: string;
};

// ============================================
// PRODUTOS E ESTOQUE
// ============================================

export type TinyProduto = {
  id: number;
  codigo?: string;
  nome: string;
  preco: number;
  preco_custo?: number;
  unidade?: string;
  categoria?: string;
  estoque?: number;
  estoque_minimo?: number;
};

export type TinyEstoque = {
  produto: {
    id: number;
    codigo?: string;
    nome: string;
  };
  deposito?: string;
  saldo: number;
  reservado?: number;
  disponivel?: number;
  custo_medio?: number;
};

// ============================================
// CONTATOS (CLIENTES/FORNECEDORES)
// ============================================

export type TinyContato = {
  id: number;
  codigo?: string;
  nome: string;
  fantasia?: string;
  tipo_pessoa: "F" | "J";
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
};

// ============================================
// PARÂMETROS DE BUSCA
// ============================================

export type TinyPedidoSearchParams = {
  dataInicial?: string;
  dataFinal?: string;
  situacao?: string;
  idCliente?: number;
  pagina?: number;
};

export type TinyContaSearchParams = {
  dataInicial?: string;
  dataFinal?: string;
  situacao?: string; // "aberto", "pago", "parcial", "cancelado"
  pagina?: number;
};

export type TinyEstoqueSearchParams = {
  deposito?: string;
  pagina?: number;
};

