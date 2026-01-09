export type ReportView =
  | "vw_vendas"
  | "vw_contas_receber_posicao"
  | "vw_contas_pagar"
  | "vw_contas_pagas"
  | "vw_estoque"
  | "vw_contas_recebidas";

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportConfig = {
  title: string;
  dateField: string;
  statusField?: string;
  searchFields: string[];
  columns: ReportColumn[];
};

export const reports: Record<ReportView, ReportConfig> = {
  vw_vendas: {
    title: "Vendas",
    dateField: "dataHora",
    statusField: undefined,
    searchFields: ["produto", "cliente", "cnpjCliente", "vendedor"],
    columns: [
      { key: "dataHora", label: "Data/Hora" },
      { key: "produto", label: "Produto" },
      { key: "categoria", label: "Categoria" },
      { key: "quantidade", label: "Qtd" },
      { key: "valorUnitario", label: "Vlr Unit" },
      { key: "valorTotal", label: "Vlr Total" },
      { key: "formaPagamento", label: "Forma Pagamento" },
      { key: "vendedor", label: "Vendedor" },
      { key: "cliente", label: "Cliente" },
      { key: "cnpjCliente", label: "CPF/CNPJ" },
      { key: "caixa", label: "Caixa" },
      { key: "status", label: "Status" },
    ],
  },
  vw_contas_receber_posicao: {
    title: "Contas a Receber (Posição)",
    dateField: "dataVencimento",
    statusField: undefined,
    searchFields: ["cliente", "cnpj", "categoria"],
    columns: [
      { key: "tituloId", label: "ID Título" },
      { key: "cliente", label: "Cliente" },
      { key: "cnpj", label: "CNPJ" },
      { key: "categoria", label: "Categoria" },
      { key: "centroCusto", label: "Centro Custo" },
      { key: "dataEmissao", label: "Emissão" },
      { key: "dataVencimento", label: "Vencimento" },
      { key: "valor", label: "Valor" },
      { key: "dataPosicao", label: "Data Posição" },
    ],
  },
  vw_contas_pagar: {
    title: "Contas a Pagar",
    dateField: "dataVencimento",
    statusField: "status",
    searchFields: ["fornecedor", "categoria", "centroCusto"],
    columns: [
      { key: "tituloId", label: "ID Título" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "categoria", label: "Categoria" },
      { key: "centroCusto", label: "Centro Custo" },
      { key: "dataEmissao", label: "Emissão" },
      { key: "dataVencimento", label: "Vencimento" },
      { key: "valor", label: "Valor" },
      { key: "status", label: "Status" },
      { key: "formaPagto", label: "Forma Pagto" },
    ],
  },
  vw_contas_pagas: {
    title: "Contas Pagas",
    dateField: "dataPagamento",
    statusField: "status",
    searchFields: ["fornecedor", "categoria", "contaBancaria"],
    columns: [
      { key: "tituloId", label: "ID Título" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "categoria", label: "Categoria" },
      { key: "centroCusto", label: "Centro Custo" },
      { key: "dataEmissao", label: "Emissão" },
      { key: "dataVencimento", label: "Vencimento" },
      { key: "dataPagamento", label: "Pagamento" },
      { key: "valorTitulo", label: "Valor Título" },
      { key: "valorPago", label: "Valor Pago" },
      { key: "desconto", label: "Desconto" },
      { key: "juros", label: "Juros" },
      { key: "multa", label: "Multa" },
      { key: "contaBancaria", label: "Conta Bancária" },
      { key: "formaPagamento", label: "Forma Pagamento" },
      { key: "usuarioBaixa", label: "Usuário Baixa" },
      { key: "status", label: "Status" },
    ],
  },
  vw_estoque: {
    title: "Estoque (Snapshot)",
    dateField: "dataReferencia",
    statusField: undefined,
    searchFields: ["produto", "categoria"],
    columns: [
      { key: "dataReferencia", label: "Data Referência" },
      { key: "produto", label: "Produto" },
      { key: "categoria", label: "Categoria" },
      { key: "unidadeMedida", label: "Unidade" },
      { key: "estoqueInicial", label: "Estoque Inicial" },
      { key: "entradas", label: "Entradas" },
      { key: "saidas", label: "Saídas" },
      { key: "ajustes", label: "Ajustes" },
      { key: "estoqueFinal", label: "Estoque Final" },
      { key: "custoMedio", label: "Custo Médio" },
      { key: "valorTotalEstoque", label: "Valor Total" },
      { key: "fornecedorUltimaCompra", label: "Fornecedor Última Compra" },
      { key: "dataUltimaCompra", label: "Última Compra" },
    ],
  },
  vw_contas_recebidas: {
    title: "Contas Recebidas",
    dateField: "dataRecebimento",
    statusField: "status",
    searchFields: ["cliente", "cnpjCpf", "categoria", "contaBancaria"],
    columns: [
      { key: "tituloId", label: "ID Título" },
      { key: "cliente", label: "Cliente" },
      { key: "cnpjCpf", label: "CNPJ/CPF" },
      { key: "categoria", label: "Categoria" },
      { key: "centroCusto", label: "Centro Custo" },
      { key: "dataEmissao", label: "Emissão" },
      { key: "dataVencimento", label: "Vencimento" },
      { key: "dataRecebimento", label: "Recebimento" },
      { key: "valorTitulo", label: "Valor Título" },
      { key: "valorRecebido", label: "Valor Recebido" },
      { key: "desconto", label: "Desconto" },
      { key: "juros", label: "Juros" },
      { key: "multa", label: "Multa" },
      { key: "comissaoCartao", label: "Comissão cartão" },
      { key: "comissaoMktplaces", label: "Comissão mktplaces" },
      { key: "contaBancaria", label: "Conta Bancária" },
      { key: "formaRecebimento", label: "Forma Recebimento" },
      { key: "usuarioBaixa", label: "Usuário Baixa" },
      { key: "status", label: "Status" },
    ],
  },
};

