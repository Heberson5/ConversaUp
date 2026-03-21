export type UserRole = 'admin' | 'agent' | 'master';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  queues?: string[]; // IDs das filas que este agente atende
}

export interface MenuOption {
  id: string;
  key: string; // Tecla que o cliente digita (1, 2, 3...)
  label: string; // Nome da opção (Vendas, Suporte...)
  assignedAgents: string[]; // IDs dos usuários designados
  closingMessage?: string;
}

export interface AutomationConfig {
  welcomeMessage: string;
  acceptanceTime: number;
  menus: MenuOption[];
  isSurveyEnabled: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  status: 'waiting' | 'active' | 'finished' | 'transferred';
  assignedQueueId?: string;
  assignedTo?: string;
  unreadCount: number;
}