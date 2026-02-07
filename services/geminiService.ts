
import { GoogleGenAI } from "@google/genai";
import { FinancialData, DistributionResult } from "../types";

export const getCFOAnalysis = async (data: FinancialData, result: DistributionResult, periodLabel: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Erro: Chave de API não configurada.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Atue como o CFO Virtual da ONEBRIDGE STALWART, uma LLC de Wyoming.
    
    CONTEXTO DO PERÍODO:
    Período de Referência: ${periodLabel}

    RESULTADOS FINANCEIROS CONSOLIDADOS:
    - Receita Bruta Total: $${result.grossTotalBookkeeping.toFixed(2)}
    - Custo Operacional (OpEx): $${result.totalOpEx.toFixed(2)}
    - Resultado Líquido: $${result.safetyMargin.toFixed(2)}
    - Reserva Retida pela Empresa (12%): $${result.companyReserve.toFixed(2)}
    - Valor Total Distribuído aos Sócios: $${(result.finalPayouts.evandro + result.finalPayouts.juliaSamuel + result.finalPayouts.walter).toFixed(2)}

    SUA TAREFA:
    Forneça um parecer executivo sobre este fechamento específico (${periodLabel}).
    1. Comente se a margem líquida está saudável para o período.
    2. Alerte sobre desequilíbrios entre entrada e saída se houver.
    3. Se houver lucro, valide a eficiência da distribuição. Se houver prejuízo, sugira ajuste de caixa.
    4. Seja direto, executivo e mantenha o tom profissional. Máximo 3 parágrafos curtos.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Análise indisponível no momento.";
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro na conexão com o motor de IA do CFO.";
  }
};
