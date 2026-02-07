
# OneBridge CFO Virtual - Python Engine

Este repositório contém o motor financeiro da **OneBridge Stalwart LLC**, desenvolvido para automação de cálculos de distribuição de lucros (Waterfall) e análise estratégica via IA.

## Funcionalidades
- **Cálculo Automático**: Distribuição conforme Operating Agreement.
- **Taxas de Originação**: 10% para o sócio originador.
- **Reserva de Capital**: Retenção automática de 12%.
- **Análise Gemini**: Geração de parecer executivo usando `gemini-3-flash-preview`.

## Como usar
1. Clone o repositório.
2. Crie um arquivo `.env` com sua `API_KEY`.
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Execute o motor:
   ```bash
   python main.py
   ```

## Estrutura da Distribuição
- **Evandro (Profiscal)**: 33.34%
- **Julia/Samuel (Elevated)**: 33.33%
- **Walter (Moraes D'Angelo)**: 33.33%
