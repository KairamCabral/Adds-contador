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
  id?: number;
  descricao?: string;
  quantidade?: number | string;
  valor_unitario?: number | string;
  valorUnitario?: number | string;
  valor_total?: number | string;
  valorTotal?: number | string;
  codigo?: string;
  sku?: string;
  unidade?: string;
  produto?: {
    id?: number;
    sku?: string;
    descricao?: string;
    codigo?: string;
    unidade?: string;
    preco?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type TinyPedidoDetalhe = {
  id: number;
  numero?: string | number;
  numeroPedido?: string | number;
  numero_pedido?: string | number;
  data?: string;
  data_pedido?: string;
  dataPedido?: string;
  dataPrevista?: string;
  dataPrevisao?: string;
  data_prevista?: string;
  situacao?: string | number;
  cliente?: {
    id?: number;
    nome?: string;
    cpf_cnpj?: string;
    cpfCnpj?: string;
    [key: string]: unknown;
  };
  itens?: TinyPedidoItem[];
  forma_pagamento?: string;
  formaPagamento?: string;
  observacoes?: string;
  vendedor?: {
    id?: number;
    nome?: string;
    [key: string]: unknown;
  } | null;
  pagamento?: {
    formaPagamento?: {
      nome?: string;
      [key: string]: unknown;
    };
    forma_pagamento?: {
      nome?: string;
      [key: string]: unknown;
    };
    meioPagamento?: {
      nome?: string;
      [key: string]: unknown;
    };
    meio_pagamento?: {
      nome?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  ecommerce?: {
    nome?: string;
    [key: string]: unknown;
  };
  deposito?: {
    nome?: string;
    [key: string]: unknown;
  };
  valor?: number | string;
  desconto?: number | string;
  total?: number | string;
  valorTotal?: number | string;
  valor_total?: number | string;
  valorTotalPedido?: number | string;
  valor_total_pedido?: number | string;
  [key: string]: unknown;
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
  sku?: string;
  nome: string;
  descricao?: string;
  preco: number;
  preco_custo?: number;
  unidade?: string;
  categoria?: string;
  estoque?: number;
  estoque_minimo?: number;
  saldo?: number;
  saldoFisico?: number;
  custoMedio?: number;
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

