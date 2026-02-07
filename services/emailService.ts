
export interface EmailPayload {
  to: string[];
  subject: string;
  body: string;
}

export const sendInvoiceNotification = async (invoiceNumber: string, clientName: string, amount: number): Promise<boolean> => {
  // Simulação de alerta para os sócios
  console.log(`[Email Service] Alerta de Stakeholders: ${invoiceNumber}`);
  console.log(`[Destinatários] samuel@onebridgestalwart.com, pay@onebridgestalwart.com, walter@onebridgestalwart.com`);
  
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1200);
  });
};

export const sendInvoiceToClient = async (invoiceNumber: string, clientEmail: string): Promise<boolean> => {
  // Simulação de envio para o cliente final
  console.log(`[Email Service] Enviando Invoice ${invoiceNumber} para o cliente: ${clientEmail}`);
  
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1800);
  });
};
