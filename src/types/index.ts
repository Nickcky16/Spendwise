export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  totalIncome: number;
  currency: string;
  updatedAt: any;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: any;
  description: string;
  userId: string;
  createdAt: any;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  period: string;
  userId: string;
  updatedAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
