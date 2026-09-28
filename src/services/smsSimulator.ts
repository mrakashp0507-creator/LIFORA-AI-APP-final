// Android In-App SMS Notification & Gateway Broadcaster
export interface IncomingSms {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  otp?: string;
  recipientMobile: string;
}

type SmsListener = (sms: IncomingSms) => void;

class SmsNotificationService {
  private listeners: Set<SmsListener> = new Set();
  private history: IncomingSms[] = [];

  public subscribe(listener: SmsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notifyIncomingSms(sms: Omit<IncomingSms, 'id' | 'timestamp'>) {
    const entry: IncomingSms = {
      ...sms,
      id: `sms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.history.unshift(entry);
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (err) {
        console.error(err);
      }
    });
  }

  public getHistory(): IncomingSms[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
  }
}

export const smsNotificationService = new SmsNotificationService();
