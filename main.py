
import os
import uuid
import json
from datetime import datetime
from typing import List, Dict, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# Carrega variáveis de ambiente (.env)
load_dotenv()

# Configuração da Gemini API
GEMINI_API_KEY = "AIzaSyAAkNudagOwmPFLwVi4DmdRBlMtelpK2a4"
genai.configure(api_key=GEMINI_API_KEY)
class Partner:
    EVANDRO = 'Evandro (Profiscal)'
    JULIA_SAMUEL = 'Julia/Samuel (Elevated)'
    WALTER = 'Walter (Moraes D\'Angelo)'
    NONE = 'Nenhum (Orgânico)'

class Transaction:
    def __init__(self, 
                 description: str, 
                 gross_revenue: float = 0, 
                 gov_taxes: float = 0, 
                 external_commission: float = 0, 
                 provisions: float = 0, 
                 originator: str = Partner.NONE,
                 is_revenue: bool = True):
        self.id = str(uuid.uuid4())
        self.date = datetime.now().isoformat()
        self.description = description
        self.gross_revenue = gross_revenue if is_revenue else 0
        self.gov_taxes = gov_taxes
        self.external_commission = external_commission
        self.provisions = provisions
        self.originator = originator
        self.is_revenue = is_revenue

    def get_net_deal(self) -> float:
        deductions = self.gov_taxes + self.external_commission + self.provisions
        if self.is_revenue:
            return max(0, self.gross_revenue - deductions)
        return -deductions

class CFOEngine:
    SHARES = {
        'evandro': 0.3334,
        'julia_samuel': 0.3333,
        'walter': 0.3333
    }
    RATES = {
        'origination': 0.10,
        'reserve': 0.12
    }

    def __init__(self, transactions: List[Transaction]):
        self.transactions = transactions

    def calculate(self) -> Dict:
        total_gross = 0
        total_opex = 0
        revenue_pool = 0
        origination_by_partner = {Partner.EVANDRO: 0, Partner.JULIA_SAMUEL: 0, Partner.WALTER: 0}

        for t in self.transactions:
            deductions = t.gov_taxes + t.external_commission + t.provisions
            
            if t.is_revenue:
                total_gross += t.gross_revenue
                deal_net = max(0, t.gross_revenue - deductions)
                revenue_pool += deal_net
                
                if t.originator in origination_by_partner:
                    fee = deal_net * self.RATES['origination']
                    origination_by_partner[t.originator] += fee
            else:
                total_opex += deductions

        global_net = revenue_pool - total_opex
        total_origination = sum(origination_by_partner.values())
        base_for_distribution = max(0, global_net - total_origination)
        
        company_reserve = base_for_distribution * self.RATES['reserve']
        distributable = max(0, base_for_distribution - company_reserve)

        return {
            "gross_total": total_gross,
            "total_expenses": total_opex,
            "net_income": global_net,
            "company_reserve": company_reserve,
            "payouts": {
                "evandro": (distributable * self.SHARES['evandro']) + origination_by_partner[Partner.EVANDRO],
                "julia_samuel": (distributable * self.SHARES['julia_samuel']) + origination_by_partner[Partner.JULIA_SAMUEL],
                "walter": (distributable * self.SHARES['walter']) + origination_by_partner[Partner.WALTER],
                "reserve": company_reserve
            }
        }

    def get_ai_analysis(self, result: Dict) -> str:
        prompt = f"""
        Você é o CFO Virtual da ONEBRIDGE STALWART LLC.
        Analise os resultados do período:
        - Receita Bruta: ${result['gross_total']:.2f}
        - Despesas: ${result['total_expenses']:.2f}
        - Resultado Líquido: ${result['net_income']:.2f}
        
        Forneça um parecer executivo curto (2-3 parágrafos) sobre a saúde financeira e próximos passos.
        """
        
        model = genai.GenerativeModel('gemini-3-flash-preview')
        response = model.generate_content(prompt)
        return response.text

if __name__ == "__main__":
    # Exemplo de uso
    sample_data = [
        Transaction("Abertura Wyoming - Cliente A", gross_revenue=1500, gov_taxes=100, originator=Partner.EVANDRO),
        Transaction("Compliance Delaware - Cliente B", gross_revenue=2000, external_commission=200, originator=Partner.WALTER),
        Transaction("Apostilamento e Tradução - Custo", provisions=450, is_revenue=False)
    ]

    cfo = CFOEngine(sample_data)
    results = cfo.calculate()
    
    print("--- RELATÓRIO FINANCEIRO ONEBRIDGE ---")
    print(f"Receita Bruta: ${results['gross_total']:.2f}")
    print(f"Resultado Líquido: ${results['net_income']:.2f}")
    print(f"Reserva OneBridge: ${results['payouts']['reserve']:.2f}")
    print("-" * 38)
    print(f"Payout Evandro: ${results['payouts']['evandro']:.2f}")
    print(f"Payout Elevated: ${results['payouts']['julia_samuel']:.2f}")
    print(f"Payout Walter: ${results['payouts']['walter']:.2f}")
    
    print("\n--- PARECER DO CFO VIRTUAL (AI) ---")
    print(cfo.get_ai_analysis(results))
