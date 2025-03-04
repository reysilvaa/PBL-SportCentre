export interface Endpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    description: string;
    category: string;
    requiredParams?: string[];
    optionalParams?: string[];
    tags?: string[];
    authentication: 'public' | 'user' | 'admin';
    version: string;
    responseType?: string;
    errorHandling?: string[];
  }