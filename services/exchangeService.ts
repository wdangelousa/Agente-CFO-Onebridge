interface ExchangeRateResponse {
  USDBRL: {
    code: string;
    codein: string;
    name: string;
    high: string;
    low: string;
    varBid: string;
    pctChange: string;
    bid: string;
    ask: string;
    timestamp: string;
    create_date: string;
  };
}

export const getExchangeRate = async (): Promise<number | null> => {
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!response.ok) throw new Error('Falha ao obter cotação');
    
    const data: ExchangeRateResponse = await response.json();
    // We return the 'bid' (compra) price mostly, or 'ask' (venda). 
    // For an LLC bringing money IN or paying expenses, 'ask' is usually safer for cost estimation (how much BRL costs in USD).
    // Let's use the current trade value (bid).
    return parseFloat(data.USDBRL.bid);
  } catch (error) {
    console.error('Erro na API de Câmbio:', error);
    return null;
  }
};