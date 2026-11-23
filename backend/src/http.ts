// Rutas de la API sin depender de Express: el servidor local las monta en Express
// y la demo estática las ejecuta en el navegador contra su propia PGlite.
export interface ApiRequest {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
}
export interface ApiResponse { status: number; body?: unknown }
export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handle: (req: ApiRequest) => Promise<ApiResponse>;
}

export const reply = (status: number, body?: unknown): ApiResponse => ({ status, body });

// Busca la primera ruta cuyo método y segmentos coinciden («:id» captura un segmento).
export function matchRoute(routes: ApiRoute[], method: string, path: string) {
  const parts = path.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.method !== method) continue;
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    try {
      if (pattern.every((segment, index) => segment.startsWith(':')
        ? (params[segment.slice(1)] = decodeURIComponent(parts[index]), true)
        : segment === parts[index])) return { route, params };
    } catch { return null; } // %-codificación inválida: ninguna ruta coincide
  }
  return null;
}
